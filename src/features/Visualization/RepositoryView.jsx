import React, { useEffect, useMemo, useRef, useState } from "react";
import { useGit } from "../GitCore/GitContext.jsx";
import { api } from "../API";
import CommitNode from "./CommitNode";
import BranchLine from "./BranchLine";
import AnimationEngine from "./AnimationEngine";

const Y = 70;
const X = 150;

function normGraph(raw) {
    if (!raw) return { branches: {} };
    if (raw.branches && typeof raw.branches === "object") return { branches: raw.branches };
    const arr = raw.commits || raw.history || raw.log || [];
    const name = raw.currentBranch || raw.head || raw.branch || "main";
    return { branches: { [name]: Array.isArray(arr) ? arr : [] } };
}

function calcPositions(repoState) {
    const commitPositions = {};
    const branchMap = repoState?.branches || {};
    let y = 50, x = 120;
    Object.entries(branchMap).forEach(([branchName, commits]) => {
        let cy = y;
        (commits || []).forEach((c, i) => {
            const h = c.hash || c.id || c.sha || c.oid || `tmp-${branchName}-${i}`;
            if (!commitPositions[h]) {
                commitPositions[h] = {
                    x,
                    y: cy,
                    branch: branchName,
                    message: c.message || "",
                    files: c.files || [],
                };
                cy += Y;
            }
        });
        x += X;
    });
    return commitPositions;
}

function linesFrom(pos) {
    const by = {};
    for (const [, v] of Object.entries(pos)) {
        const b = v.branch || "main";
        (by[b] ||= { points: [] }).points.push({ x: v.x, y: v.y });
    }
    Object.values(by).forEach(b => b.points.sort((a, b) => a.y - b.y));
    return by;
}

// 임시 노드(transferSnapshot) → 로컬/원격에 가짜로 꽂아 미니 그래프 구성
function buildTempGraph(transfer, side) {
    if (!transfer) return { branches: {} };
    const b = transfer.branch || "main";
    const base = (transfer.commits || []).map((c, i) => ({
        hash: c.hash || `temp-${side}-${i}`,
        message: c.message || (side === "local" ? "Staged change" : "Remote update"),
        files: c.files || [],
    }));
    // push 전: local에만 임시 노드, pull 전: remote에만 임시 노드
    if (transfer.type === "push" && side === "local") return { branches: { [b]: base } };
    if (transfer.type === "pull" && side === "remote") return { branches: { [b]: base } };
    return { branches: {} };
}

export default function RepositoryView() {
    const { state } = useGit();
    const repoId = state?.selectedRepoId ? String(state.selectedRepoId) : "";
    const [graph, setGraph] = useState({ local: null, remote: null });
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");

    // tooltip 상태
    const [tip, setTip] = useState({ show: false, x: 0, y: 0, lines: [] });
    const stageRef = useRef(null);

    useEffect(() => {
        if (!repoId) { setGraph({ local: null, remote: null }); setErr(""); return; }
        let on = true;
        setLoading(true); setErr("");
        (async () => {
            try {
                const g = await api.repos.graph(repoId);
                if (!on) return;
                setGraph({
                    local: normGraph(g?.local ?? g?.workspace ?? g?.localRepo ?? null),
                    remote: normGraph(g?.remote ?? g?.origin ?? g?.remoteRepo ?? null),
                });
            } catch (e) {
                if (!on) return;
                setErr(e?.message || "그래프를 불러오지 못했습니다.");
                setGraph({ local: null, remote: null });
            } finally {
                if (on) setLoading(false);
            }
        })();
        return () => { on = false; };
    }, [repoId, state.graphVersion, state.animationTick]);

    // 실제 그래프 + 임시 그래프 합성
    const localMerged = useMemo(() => {
        const base = graph.local || { branches: {} };
        const temp = buildTempGraph(state.transferSnapshot, "local");
        return { branches: { ...base.branches, ...temp.branches } };
    }, [graph.local, state.transferSnapshot]);

    const remoteMerged = useMemo(() => {
        const base = graph.remote || { branches: {} };
        const temp = buildTempGraph(state.transferSnapshot, "remote");
        return { branches: { ...base.branches, ...temp.branches } };
    }, [graph.remote, state.transferSnapshot]);

    const localPos = useMemo(() => calcPositions(localMerged), [localMerged]);
    const remotePos = useMemo(() => calcPositions(remoteMerged), [remoteMerged]);
    const localBranches = useMemo(() => linesFrom(localPos), [localPos]);
    const remoteBranches = useMemo(() => linesFrom(remotePos), [remotePos]);

    const emptyLocal = Object.keys(localPos).length === 0;
    const emptyRemote = Object.keys(remotePos).length === 0;

    const animClass =
        state.animationMode === "push"
            ? "moving push"
            : state.animationMode === "pull"
                ? "moving pull"
                : "";

    // 브랜치 라벨 위치: 각 브랜치의 첫 포인트 x, 최상단 y 기준으로 라벨 표시
    const branchLabelsLocal = useMemo(() => {
        const labels = [];
        for (const [name, b] of Object.entries(localBranches)) {
            if (!b.points.length) continue;
            const x = b.points[0].x;
            const yTop = Math.min(...b.points.map(p => p.y)) - 32;
            labels.push({ name, x, y: yTop });
        }
        return labels;
    }, [localBranches]);

    const branchLabelsRemote = useMemo(() => {
        const labels = [];
        for (const [name, b] of Object.entries(remoteBranches)) {
            if (!b.points.length) continue;
            const x = b.points[0].x;
            const yTop = Math.min(...b.points.map(p => p.y)) - 32;
            labels.push({ name, x, y: yTop });
        }
        return labels;
    }, [remoteBranches]);

    // 툴팁 헬퍼
    const showTip = (evt, lines) => {
        const stage = stageRef.current;
        let offsetX = 0, offsetY = 0;
        if (stage) {
            const r = stage.getBoundingClientRect();
            offsetX = r.left + window.scrollX;
            offsetY = r.top + window.scrollY;
        }
        setTip({
            show: true,
            x: (evt.pageX ?? 0) - offsetX + 14,
            y: (evt.pageY ?? 0) - offsetY + 14,
            lines: lines.filter(Boolean),
        });
    };
    const hideTip = () => setTip(s => ({ ...s, show: false }));

    if (!repoId) return <div className="panel"><div className="empty">레포지토리를 선택하면 그래프가 표시됩니다.</div></div>;
    if (loading) return <div className="panel"><div className="empty">그래프 불러오는 중…</div></div>;
    if (err) return <div className="panel"><div className="error">{err}</div></div>;

    return (
        <div className="visualization-area" ref={stageRef} style={{ position: "relative" }}>
            <AnimationEngine />

            <div className="stage">
                {/* LOCAL */}
                <div className="panel">
                    <h3>Local</h3>
                    <div className="commit-graph" style={{ position: "relative" }}>
                        <BranchLine branches={localBranches} />
                        {/* 브랜치 라벨 */}
                        {branchLabelsLocal.map(b => (
                            <div
                                key={`lb-${b.name}`}
                                style={{
                                    position: "absolute",
                                    left: b.x - 24,
                                    top: b.y,
                                    fontSize: 12,
                                    padding: "2px 6px",
                                    borderRadius: 8,
                                    background: "#eef2ff",
                                    border: "1px solid #c7d2fe",
                                    pointerEvents: "none",
                                }}
                            >
                                {b.name}
                            </div>
                        ))}

                        {emptyLocal && <div className="empty">표시할 커밋이 없습니다.</div>}

                        {!emptyLocal &&
                            Object.entries(localPos).map(([hash, node]) => {
                                const message = node.message || "";
                                const files = Array.isArray(node.files) ? node.files : [];
                                const shortId = hash.slice(0, 7);

                                // CommitNode 자체에 정확한 좌표를 전달 (★ 중요)
                                return (
                                    <React.Fragment key={`l-${hash}`}>
                                        <CommitNode
                                            commit={{ hash, message, files, branch: node.branch }}
                                            position={{ x: node.x, y: node.y }}
                                            isHead={false}
                                            className={state.transferSnapshot?.type === "push" ? animClass : ""}
                                        />
                                        {/* 호버 핫스팟(CommitNode 위에 얇은 오버레이) */}
                                        <div
                                            style={{
                                                position: "absolute",
                                                left: node.x - 12,
                                                top: node.y - 12,
                                                width: 24,
                                                height: 24,
                                                borderRadius: "50%",
                                                // background: "rgba(0,0,0,0.001)", // 필요시 히트박스 디버그
                                                cursor: "default",
                                            }}
                                            onMouseEnter={(e) =>
                                                showTip(e, [
                                                    `Commit: ${hash}`,
                                                    files.length ? `Files: ${files.join(", ")}` : "Files: (none)",
                                                    `Branch: ${node.branch}`,
                                                    message ? `Message: ${message}` : "",
                                                ])
                                            }
                                            onMouseMove={(e) =>
                                                showTip(e, [
                                                    `Commit: ${hash}`,
                                                    files.length ? `Files: ${files.join(", ")}` : "Files: (none)",
                                                    `Branch: ${node.branch}`,
                                                    message ? `Message: ${message}` : "",
                                                ])
                                            }
                                            onMouseLeave={hideTip}
                                        />
                                        {/* 커밋 메시지 + 브랜치 뱃지 */}
                                        <div
                                            style={{
                                                position: "absolute",
                                                left: node.x - 80,
                                                top: node.y + 18,
                                                width: 160,
                                                textAlign: "center",
                                            }}
                                        >
                                            <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                {message || "(no message)"}
                                            </div>
                                            <div style={{ display: "inline-flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                        <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 8, background: "#f1f5f9", border: "1px solid #e2e8f0" }}>
                          {node.branch}
                        </span>
                                                <span style={{ fontSize: 11, color: "#64748b" }}>{shortId}</span>
                                            </div>
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                    </div>
                </div>

                {/* REMOTE */}
                <div className="panel">
                    <h3>Remote</h3>
                    <div className="commit-graph" style={{ position: "relative" }}>
                        <BranchLine branches={remoteBranches} remote />
                        {/* 브랜치 라벨 */}
                        {branchLabelsRemote.map(b => (
                            <div
                                key={`rb-${b.name}`}
                                style={{
                                    position: "absolute",
                                    left: b.x - 24,
                                    top: b.y,
                                    fontSize: 12,
                                    padding: "2px 6px",
                                    borderRadius: 8,
                                    background: "#effdf5",
                                    border: "1px solid #bbf7d0",
                                    pointerEvents: "none",
                                }}
                            >
                                {b.name}
                            </div>
                        ))}

                        {emptyRemote && <div className="empty">표시할 커밋이 없습니다.</div>}

                        {!emptyRemote &&
                            Object.entries(remotePos).map(([hash, node]) => {
                                const message = node.message || "";
                                const files = Array.isArray(node.files) ? node.files : [];
                                const shortId = hash.slice(0, 7);

                                return (
                                    <React.Fragment key={`r-${hash}`}>
                                        <CommitNode
                                            commit={{ hash, message, files, branch: node.branch }}
                                            position={{ x: node.x, y: node.y }}
                                            isHead={false}
                                            className={state.transferSnapshot?.type === "pull" ? animClass : ""}
                                        />
                                        {/* 호버 핫스팟 */}
                                        <div
                                            style={{
                                                position: "absolute",
                                                left: node.x - 12,
                                                top: node.y - 12,
                                                width: 24,
                                                height: 24,
                                                borderRadius: "50%",
                                                cursor: "default",
                                            }}
                                            onMouseEnter={(e) =>
                                                showTip(e, [
                                                    `Commit: ${hash}`,
                                                    files.length ? `Files: ${files.join(", ")}` : "Files: (none)",
                                                    `Branch: ${node.branch}`,
                                                    message ? `Message: ${message}` : "",
                                                ])
                                            }
                                            onMouseMove={(e) =>
                                                showTip(e, [
                                                    `Commit: ${hash}`,
                                                    files.length ? `Files: ${files.join(", ")}` : "Files: (none)",
                                                    `Branch: ${node.branch}`,
                                                    message ? `Message: ${message}` : "",
                                                ])
                                            }
                                            onMouseLeave={hideTip}
                                        />
                                        {/* 커밋 메시지 + 브랜치 뱃지 */}
                                        <div
                                            style={{
                                                position: "absolute",
                                                left: node.x - 80,
                                                top: node.y + 18,
                                                width: 160,
                                                textAlign: "center",
                                            }}
                                        >
                                            <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                {message || "(no message)"}
                                            </div>
                                            <div style={{ display: "inline-flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                        <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 8, background: "#f1f5f9", border: "1px solid #e2e8f0" }}>
                          {node.branch}
                        </span>
                                                <span style={{ fontSize: 11, color: "#64748b" }}>{shortId}</span>
                                            </div>
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                    </div>
                </div>
            </div>

            {/* 툴팁 */}
            {tip.show && (
                <div
                    style={{
                        position: "absolute",
                        left: tip.x,
                        top: tip.y,
                        maxWidth: 420,
                        fontSize: 12,
                        lineHeight: 1.4,
                        background: "rgba(17,24,39,0.95)",
                        color: "white",
                        padding: "8px 10px",
                        borderRadius: 8,
                        boxShadow: "0 6px 20px rgba(0,0,0,.25)",
                        pointerEvents: "none",
                        zIndex: 50,
                        whiteSpace: "break-spaces",
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
