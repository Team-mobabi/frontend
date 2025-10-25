import React, { useEffect, useMemo, useState } from "react";
import { useGit } from "../GitCore/GitContext.jsx";
import { api } from "../API";
import CommitNode from "./CommitNode";
import BranchLine from "./BranchLine";
import AnimationEngine from "./AnimationEngine";
import StagingArea from "./StagingArea";
import MergeBranchModal from "../../components/Modal/MergeBranchModal.jsx";
import ConflictModal from "../../components/Modal/ConflictModal.jsx";
import BeginnerHelp from "../../pages/BeginnerHelp.jsx";

const Y = 85;
const X = 180;

/** 충돌/진행중 오류 감지 */
function isConflictError(err) {
    const status = err?.status;
    const msg = (err?.data?.message || err?.message || "").toLowerCase();
    if (status === 409) return true;
    return (
        /conflict/.test(msg) ||
        /unmerged/.test(msg) ||
        /merging is not possible/.test(msg) ||
        /exiting because of an unresolved conflict/.test(msg) ||
        /merge failed/.test(msg)
    );
}
function isMergeInProgress(err) {
    const msg = (err?.data?.message || err?.message || "").toLowerCase();
    return /merge_head exists/.test(msg) || /you have not concluded your merge/.test(msg);
}

function normGraph(raw) {
    if (!raw) return { branches: {} };
    if (raw.branches && typeof raw.branches === "object") return { branches: raw.branches };
    const arr = raw.commits || [];
    const name = raw.currentBranch || "main";
    return { branches: { [name]: Array.isArray(arr) ? arr : [] } };
}

function calcPositions(repoState) {
    const commitPositions = {};
    const branchMap = repoState?.branches || {};
    let y = 50, x = 120;
    Object.entries(branchMap).forEach(([branchName, commits]) => {
        let cy = y;
        (commits || []).forEach((c, i) => {
            const h = c.hash || `tmp-${branchName}-${i}`;
            if (!commitPositions[h]) {
                commitPositions[h] = {
                    x, y: cy, branch: branchName,
                    message: c.message || "",
                    files: c.files || [],
                    parents: c.parents || [],
                };
                cy += Y;
            }
        });
        x += X;
    });
    return commitPositions;
}

/** 최근 액션 고려한 선(에지) 메타 생성 */
function calcLineSegments(positions, lastAction) {
    const segments = {};
    const colors = ["#4B5AE4", "#22c55e", "#f59e0b", "#ef4444", "#6366f1", "#8b5cf6"];
    let colorIndex = 0;

    const branchColors = {};
    Object.values(positions).forEach((node) => {
        if (!branchColors[node.branch]) {
            branchColors[node.branch] = colors[colorIndex % colors.length];
            colorIndex++;
        }
    });

    Object.entries(positions).forEach(([childHash, childNode]) => {
        const isMergeChild = (childNode.parents || []).length > 1;

        (childNode.parents || []).forEach((parentHash) => {
            const parentNode = positions[parentHash];
            if (!parentNode) return;

            const key = `line-${parentHash}-${childHash}`;
            const type = isMergeChild ? "merge" : "normal";

            const recent =
                lastAction?.type === "merge" &&
                (
                    (lastAction.commitHash && childHash === lastAction.commitHash) ||
                    (!lastAction.commitHash && childNode.branch === (lastAction.target || childNode.branch))
                );

            segments[key] = {
                points: [parentNode, childNode],
                color: branchColors[childNode.branch] || "#e5e8f0",
                type,
                recent,
            };
        });
    });
    return segments;
}

function calcBranchLabels(positions) {
    const labels = {};
    const colors = ["#4B5AE4", "#22c55e", "#f59e0b", "#ef4444", "#6366f1", "#8b5cf6"];
    let colorIndex = 0;

    const branchNames = [...new Set(Object.values(positions).map((p) => p.branch))];
    branchNames.forEach((branchName) => {
        const color = colors[colorIndex % colors.length];
        colorIndex++;
        const nodesInBranch = Object.values(positions).filter((p) => p.branch === branchName);
        if (nodesInBranch.length > 0) {
            nodesInBranch.sort((a, b) => a.y - b.y);
            labels[branchName] = { point: nodesInBranch[0], color };
        }
    });
    return labels;
}

export default function RepositoryView() {
    const { state, dispatch } = useGit();
    const repoId = state?.selectedRepoId;
    const [graph, setGraph] = useState({ local: null, remote: null });
    const [tip, setTip] = useState({ show: false, x: 0, y: 0, lines: [] });
    const [mergeModalState, setMergeModalState] = useState({ open: false, sourceBranch: null });
    const [simplified, setSimplified] = useState(false);
    const [showStaging, setShowStaging] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);

    // 🆕 최근 액션(병합) 하이라이트 상태
    const [lastAction, setLastAction] = useState(null);

    useEffect(() => {
        if (!repoId) { setGraph({ local: null, remote: null }); return; }
        api.repos
            .graph(repoId, { simplified: simplified ? "true" : undefined })
            .then((g) => setGraph({ local: normGraph(g?.local), remote: normGraph(g?.remote) }))
            .catch(() => setGraph({ local: null, remote: null }));
    }, [repoId, state.graphVersion, simplified]);

    useEffect(() => {
        if (state.animationMode === "commit") setShowStaging(true);
        else if (state.animationMode === "idle") setShowStaging(false);
    }, [state.animationMode]);

    const localPos = useMemo(() => calcPositions(graph.local), [graph.local]);
    const remotePos = useMemo(() => calcPositions(graph.remote), [graph.remote]);

    const localLineSegments = useMemo(() => calcLineSegments(localPos, lastAction), [localPos, lastAction]);
    const remoteLineSegments = useMemo(() => calcLineSegments(remotePos, lastAction), [remotePos, lastAction]);
    const localBranchLabels = useMemo(() => calcBranchLabels(localPos), [localPos]);
    const remoteBranchLabels = useMemo(() => calcBranchLabels(remotePos), [remotePos]);

    const handleOpenMergeModal = (sourceBranch) => setMergeModalState({ open: true, sourceBranch });

    const handleMergeConfirm = async (targetBranch) => {
        const { sourceBranch } = mergeModalState;
        setMergeModalState({ open: false, sourceBranch: null });
        if (!sourceBranch || !targetBranch) return;
        try {
            const mergeResult = await api.repos.merge(repoId, { sourceBranch, targetBranch });

            // 하이라이트 설정 (3초 후 자동 해제)
            setLastAction({
                type: "merge",
                fastForward: !!mergeResult?.fastForward,
                source: sourceBranch,
                target: targetBranch,
                commitHash: mergeResult?.mergeCommitHash || null,
                at: Date.now(),
            });
            setTimeout(() => setLastAction(null), 3000);

            if (mergeResult?.hasConflict) {
                dispatch({ type: "OPEN_CONFLICT_MODAL" });
            } else {
                dispatch({ type: "GRAPH_DIRTY" });
            }
        } catch (e) {
            if (isMergeInProgress(e)) {
                dispatch({ type: "OPEN_CONFLICT_MODAL" });
                return;
            }
            if (isConflictError(e)) {
                dispatch({ type: "OPEN_CONFLICT_MODAL" });
            } else {
                alert(`병합 실패: ${e?.message || "Unknown error"}`);
            }
        }
    };

    const handleReset = async (hash) => {
        const resetMode = "soft";
        if (!window.confirm(`현재 브랜치를 이 커밋(${hash.slice(0, 7)})으로 되돌리시겠습니까? (${resetMode} reset)`)) return;
        try {
            await api.repos.reset(repoId, { commitHash: hash, mode: resetMode });
            dispatch({ type: "GRAPH_DIRTY" });
        } catch (e) {
            alert(`Reset 실패: ${e?.message || "Unknown error"}`);
        }
    };

    const graphHeight = useMemo(() => {
        const allPositions = [...Object.values(localPos), ...Object.values(remotePos)];
        return allPositions.length === 0 ? 260 : Math.max(...allPositions.map((p) => p.y)) + 80;
    }, [localPos, remotePos]);

    const showTip = (evt, lines) => setTip({ show: true, x: evt.clientX + 15, y: evt.clientY + 15, lines: lines.filter(Boolean) });
    const hideTip = () => setTip((s) => ({ ...s, show: false }));

    const stagingAnimClass = state.animationMode === "commit" ? "anim-commit" : "";

    return (
        <div className="visualization-area">
            <AnimationEngine />
            <div className="view-options">
                <label className="toggle-switch">
                    <input type="checkbox" checked={simplified} onChange={() => setSimplified((s) => !s)} />
                    <span className="slider"></span>
                </label>
                <span>단순화 보기</span>
            </div>

            <div className="stage">
                {/* Local */}
                <div className="panel">
                    <h3>Local</h3>
                    <div className="commit-graph" style={{ height: `${graphHeight}px`, position: "relative" }}>

                        {showStaging && <StagingArea files={state.stagingArea} animationClass={stagingAnimClass} />}

                        <BranchLine lineSegments={localLineSegments} />
                        {Object.entries(localBranchLabels).map(([name, info]) => (
                            <div
                                key={`label-l-${name}`}
                                className="branch-label"
                                style={{ left: info.point.x, top: info.point.y, borderColor: info.color, color: info.color }}
                                onClick={() => handleOpenMergeModal(name)}
                            >
                                {name}
                            </div>
                        ))}

                        {Object.entries(localPos).map(([hash, node]) => {
                            const isMergeCommit = node.parents && node.parents.length > 1;
                            const recentNode = lastAction?.type === "merge" && lastAction?.commitHash && hash === lastAction.commitHash;

                            return (
                                <React.Fragment key={`l-${hash}`}>
                                    <CommitNode
                                        position={node}
                                        isMerge={isMergeCommit}
                                        recent={!!recentNode}
                                        color={(localBranchLabels[node.branch] || {}).color}
                                        onClick={() => handleReset(hash)}
                                        onMouseEnter={(e)=>
                                            showTip(e, [
                                                "커밋(저장 기록)입니다.",
                                                `메시지: ${node.message || "(없음)"}`,
                                                `식별자: ${hash.slice(0,7)}`
                                            ])
                                        }
                                        onMouseLeave={hideTip}
                                        title="클릭하여 이 커밋으로 Reset (soft)"
                                    />
                                    <div
                                        style={{
                                            position: "absolute",
                                            left: node.x,
                                            top: node.y,
                                            transform: "translateX(-50%)",
                                            paddingTop: "22px",
                                            width: 180,
                                            textAlign: "center",
                                            pointerEvents: "none",
                                            zIndex: 0,
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: 12,
                                                fontWeight: 600,
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                padding: "2px 4px",
                                                background: "rgba(255,255,255,0.7)",
                                                backdropFilter: "blur(4px)",
                                                borderRadius: "4px",
                                            }}
                                        >
                                            {node.message}
                                        </div>
                                        <div style={{ display: "inline-flex", gap: 6, alignItems: "center", marginTop: 4, fontSize: 11, color: "var(--muted)" }}>
                                            <span>{hash.slice(0, 7)}</span>
                                            {isMergeCommit && <span className="chip-merge">Merge</span>}
                                            {lastAction?.type === "merge" && lastAction?.fastForward && node.branch === lastAction.target && (
                                                <span className="chip-ff">FF</span>
                                            )}
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>

                {/* Remote */}
                <div className="panel">
                    <h3>Remote</h3>
                    <div className="commit-graph" style={{ height: `${graphHeight}px`, position: "relative" }}>
                        {/*<GraphLegend />*/}
                        <BranchLine lineSegments={remoteLineSegments} remote />
                        {Object.entries(remoteBranchLabels).map(([name, info]) => (
                            <div
                                key={`label-r-${name}`}
                                className="branch-label"
                                style={{ left: info.point.x, top: info.point.y, borderColor: info.color, color: info.color, cursor: "default" }}
                            >
                                {name}
                            </div>
                        ))}
                        {Object.entries(remotePos).map(([hash, node]) => {
                            const isMergeCommit = node.parents && node.parents.length > 1;
                            const originalLocalCommit = localPos[hash];
                            const originBranchName = originalLocalCommit ? originalLocalCommit.branch : null;
                            const originColor = originBranchName
                                ? (localBranchLabels[originBranchName] || {}).color
                                : (remoteBranchLabels[node.branch] || {}).color;
                            const recentNode = lastAction?.type === "merge" && lastAction?.commitHash && hash === lastAction.commitHash;

                            return (
                                <React.Fragment key={`r-${hash}`}>
                                    <CommitNode
                                        position={node}
                                        isMerge={isMergeCommit}
                                        recent={!!recentNode}
                                        color={originColor}
                                        onMouseEnter={(e) => showTip(e, [`Commit: ${hash}`, `Message: ${node.message}`, `Branch: ${node.branch}`])}
                                        onMouseLeave={hideTip}
                                    />
                                    <div
                                        style={{
                                            position: "absolute",
                                            left: node.x,
                                            top: node.y,
                                            transform: "translateX(-50%)",
                                            paddingTop: "22px",
                                            width: 180,
                                            textAlign: "center",
                                            pointerEvents: "none",
                                            zIndex: 1,
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: 12,
                                                fontWeight: 600,
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                padding: "2px 4px",
                                                background: "rgba(255,255,255,0.7)",
                                                backdropFilter: "blur(4px)",
                                                borderRadius: "4px",
                                            }}
                                        >
                                            {node.message}
                                        </div>
                                        <div style={{ display: "inline-flex", gap: 6, alignItems: "center", marginTop: 4, fontSize: 11, color: "var(--muted)" }}>
                                            <span>{hash.slice(0, 7)}</span>
                                            {isMergeCommit && <span className="chip-merge">Merge</span>}
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            </div>

            <MergeBranchModal
                open={mergeModalState.open}
                onClose={() => setMergeModalState({ open: false, sourceBranch: null })}
                sourceBranch={mergeModalState.sourceBranch}
                targetOptions={Object.keys(localBranchLabels).filter((b) => b !== mergeModalState.sourceBranch)}
                onConfirm={handleMergeConfirm}
            />

            <ConflictModal />

            <div className="view-options">
                <label className="toggle-switch">
                    <input type="checkbox" checked={simplified} onChange={() => setSimplified(s=>!s)} />
                    <span className="slider"></span>
                </label>
                <span>단순화 보기</span>
                <button className="btn btn-ghost" style={{padding:"6px 10px"}} onClick={()=>setHelpOpen(true)}>?</button>
            </div>
            {helpOpen && <BeginnerHelp onClose={()=>setHelpOpen(false)} />}

            {tip.show && (
                <div
                    style={{
                        position: "fixed",
                        left: tip.x,
                        top: tip.y,
                        maxWidth: 420,
                        fontSize: 12,
                        lineHeight: 1.4,
                        background: "rgba(17,24,39,0.95)",
                        color: "white",
                        padding: "8px 10px",
                        borderRadius: 8,
                        zIndex: 1250,
                    }}
                >
                    {tip.lines.map((l, i) => (
                        <div key={i}>{l}</div>
                    ))}
                </div>
            )}
        </div>
    );
}
