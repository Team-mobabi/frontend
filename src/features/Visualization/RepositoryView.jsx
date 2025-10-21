import React, { useEffect, useMemo, useState } from "react";
import { useGit } from "../GitCore/GitContext.jsx";
import { api } from "../API";
import CommitNode from "./CommitNode";
import BranchLine from "./BranchLine";
import AnimationEngine from "./AnimationEngine";
import StagingArea from "./StagingArea";
import MergeBranchModal from "../../components/Modal/MergeBranchModal.jsx";

const Y = 85;
const X = 180;

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
                commitPositions[h] = { x, y: cy, branch: branchName, message: c.message || "", files: c.files || [], parents: c.parents || [] };
                cy += Y;
            }
        });
        x += X;
    });
    return commitPositions;
}

function calcLineSegments(positions) {
    const segments = {};
    const colors = ['#4B5AE4', '#22c55e', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6'];
    let colorIndex = 0;

    const branchColors = {};
    Object.values(positions).forEach(node => {
        if (!branchColors[node.branch]) {
            branchColors[node.branch] = colors[colorIndex % colors.length];
            colorIndex++;
        }
    });

    Object.entries(positions).forEach(([childHash, childNode]) => {
        if (childNode.parents) {
            childNode.parents.forEach(parentHash => {
                const parentNode = positions[parentHash];
                if (parentNode) {
                    const key = `line-${parentHash}-${childHash}`;
                    segments[key] = {
                        points: [parentNode, childNode],
                        color: branchColors[childNode.branch] || '#e5e8f0'
                    };
                }
            });
        }
    });
    return segments;
}

function calcBranchLabels(positions) {
    const labels = {};
    const colors = ['#4B5AE4', '#22c55e', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6'];
    let colorIndex = 0;

    const branchNames = [...new Set(Object.values(positions).map(p => p.branch))];
    branchNames.forEach(branchName => {
        const color = colors[colorIndex % colors.length];
        colorIndex++;
        const nodesInBranch = Object.values(positions).filter(p => p.branch === branchName);
        if (nodesInBranch.length > 0) {
            nodesInBranch.sort((a,b) => a.y - b.y);
            labels[branchName] = { point: nodesInBranch[0], color: color };
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

    useEffect(() => {
        if (!repoId) { setGraph({ local: null, remote: null }); return; }
        api.repos.graph(repoId, { simplified: simplified ? 'true' : undefined })
            .then(g => setGraph({ local: normGraph(g?.local), remote: normGraph(g?.remote) }))
            .catch(() => setGraph({ local: null, remote: null }));
    }, [repoId, state.graphVersion, simplified]);

    useEffect(() => {
        // [수정] 'commit' 애니메이션이 시작될 때만 하단 패널을 보여줍니다.
        if (state.animationMode === 'commit') {
            setShowStaging(true);
        }
        // [수정] 애니메이션이 끝나면(idle) 무조건 숨깁니다.
        else if (state.animationMode === 'idle') {
            setShowStaging(false);
        }
    }, [state.animationMode]);

    const localPos = useMemo(() => calcPositions(graph.local), [graph.local]);
    const remotePos = useMemo(() => calcPositions(graph.remote), [graph.remote]);

    const localLineSegments = useMemo(() => calcLineSegments(localPos), [localPos]);
    const remoteLineSegments = useMemo(() => calcLineSegments(remotePos), [remotePos]);
    const localBranchLabels = useMemo(() => calcBranchLabels(localPos), [localPos]);
    const remoteBranchLabels = useMemo(() => calcBranchLabels(remotePos), [remotePos]);

    const handleOpenMergeModal = (sourceBranch) => setMergeModalState({ open: true, sourceBranch });
    const handleMergeConfirm = async (targetBranch) => {
        const { sourceBranch } = mergeModalState;
        setMergeModalState({ open: false, sourceBranch: null });
        if (!sourceBranch || !targetBranch) return;
        try {
            await api.repos.merge(repoId, { sourceBranch, targetBranch });
            dispatch({ type: "GRAPH_DIRTY" });
        } catch (e) {
            alert(`병합 실패: ${e.message}`);
        }
    };

    const graphHeight = useMemo(() => {
        const allPositions = [...Object.values(localPos), ...Object.values(remotePos)];
        return allPositions.length === 0 ? 260 : Math.max(...allPositions.map(p => p.y)) + 80;
    }, [localPos, remotePos]);

    const showTip = (evt, lines) => setTip({ show: true, x: evt.clientX + 15, y: evt.clientY + 15, lines: lines.filter(Boolean) });
    const hideTip = () => setTip(s => ({ ...s, show: false }));

    const stagingAnimClass =
        state.animationMode === 'commit' ? 'anim-commit' : '';

    return (
        <div className="visualization-area">
            <AnimationEngine />
            <div className="view-options">
                <label className="toggle-switch">
                    <input type="checkbox" checked={simplified} onChange={() => setSimplified(s => !s)} />
                    <span className="slider"></span>
                </label>
                <span>단순화 보기</span>
            </div>
            <div className="stage">
                <div className="panel">
                    <h3>Local</h3>
                    <div className="commit-graph" style={{ height: `${graphHeight}px` }}>

                        {showStaging && (
                            <StagingArea
                                files={state.stagingArea}
                                animationClass={stagingAnimClass}
                            />
                        )}

                        <BranchLine lineSegments={localLineSegments} />
                        {Object.entries(localBranchLabels).map(([name, info]) => (
                            <div key={`label-l-${name}`} className="branch-label" style={{ left: info.point.x, top: info.point.y, borderColor: info.color, color: info.color }} onClick={() => handleOpenMergeModal(name)}>
                                {name}
                            </div>
                        ))}
                        {Object.entries(localPos).map(([hash, node]) => {
                            const isMergeCommit = node.parents && node.parents.length > 1;
                            return (
                                <React.Fragment key={`l-${hash}`}>
                                    <CommitNode position={node} isMerge={isMergeCommit} color={(localBranchLabels[node.branch] || {}).color} />
                                    <div style={{ position: 'absolute', left: node.x, top: node.y, width: 32, height: 32, borderRadius: '50%', transform: 'translate(-50%, -50%)', cursor: 'pointer', zIndex: 2 }} onMouseEnter={(e) => showTip(e, [`Commit: ${hash}`, `Message: ${node.message}`, `Branch: ${node.branch}`])} onMouseLeave={hideTip} />
                                    <div style={{ position: 'absolute', left: node.x, top: node.y, transform: 'translateX(-50%)', paddingTop: '22px', width: 160, textAlign: 'center', pointerEvents: 'none', zIndex: 1 }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '2px 4px', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(4px)', borderRadius: '4px' }}>{node.message}</div>
                                        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginTop: 4, fontSize: 11, color: 'var(--muted)' }}><span>{hash.slice(0, 7)}</span></div>
                                    </div>
                                </React.Fragment>
                            )
                        })}
                    </div>
                </div>

                <div className="panel">
                    <h3>Remote</h3>
                    <div className="commit-graph" style={{ height: `${graphHeight}px` }}>
                        <BranchLine lineSegments={remoteLineSegments} remote />
                        {Object.entries(remoteBranchLabels).map(([name, info]) => (
                            <div key={`label-r-${name}`} className="branch-label" style={{ left: info.point.x, top: info.point.y, borderColor: info.color, color: info.color, cursor: 'default' }}>
                                {name}
                            </div>
                        ))}
                        {Object.entries(remotePos).map(([hash, node]) => {
                            const isMergeCommit = node.parents && node.parents.length > 1;
                            const originalLocalCommit = localPos[hash];
                            const originBranchName = originalLocalCommit ? originalLocalCommit.branch : null;
                            const originColor = originBranchName ? (localBranchLabels[originBranchName] || {}).color : (remoteBranchLabels[node.branch] || {}).color;
                            return (
                                <React.Fragment key={`r-${hash}`}>
                                    <CommitNode position={node} isMerge={isMergeCommit} color={originColor} />
                                    <div style={{ position: 'absolute', left: node.x, top: node.y, width: 32, height: 32, borderRadius: '50%', transform: 'translate(-50%, -50%)', cursor: 'pointer', zIndex: 2 }} onMouseEnter={(e) => showTip(e, [`Commit: ${hash}`, `Message: ${node.message}`, `Branch: ${node.branch}`])} onMouseLeave={hideTip} />
                                    <div style={{ position: 'absolute', left: node.x, top: node.y, transform: 'translateX(-50%)', paddingTop: '22px', width: 160, textAlign: 'center', pointerEvents: 'none', zIndex: 1 }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '2px 4px', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(4px)', borderRadius: '4px' }}>{node.message}</div>
                                        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginTop: 4, fontSize: 11, color: 'var(--muted)' }}><span>{hash.slice(0, 7)}</span></div>
                                    </div>
                                </React.Fragment>
                            )
                        })}
                    </div>
                </div>
            </div>
            <MergeBranchModal open={mergeModalState.open} onClose={() => setMergeModalState({ open: false, sourceBranch: null })} sourceBranch={mergeModalState.sourceBranch} targetOptions={Object.keys(localBranchLabels).filter(b => b !== mergeModalState.sourceBranch)} onConfirm={handleMergeConfirm} />
            {tip.show && (<div style={{ position: 'fixed', left: tip.x, top: tip.y, maxWidth: 420, fontSize: 12, lineHeight: 1.4, background: 'rgba(17,24,39,0.95)', color: 'white', padding: '8px 10px', borderRadius: 8, zIndex: 1250 }}>{tip.lines.map((l, i) => <div key={i}>{l}</div>)}</div>)}
        </div>
    );
}