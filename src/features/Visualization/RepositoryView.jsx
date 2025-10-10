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
                commitPositions[h] = { x, y: cy, branch: branchName, message: c.message || "", files: c.files || [] };
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

    useEffect(() => {
        if (!repoId) { setGraph({ local:null, remote:null }); setErr(""); return; }
        let on = true;
        setLoading(true); setErr("");
        (async () => {
            try {
                const g = await api.repos.graph(repoId);
                if (!on) return;
                setGraph({
                    local: normGraph(g?.local ?? g?.workspace ?? g?.localRepo ?? null),
                    remote: normGraph(g?.remote ?? g?.origin ?? g?.remoteRepo ?? null)
                });
            } catch (e) {
                if (!on) return;
                setErr(e?.message || "그래프를 불러오지 못했습니다.");
                setGraph({ local:null, remote:null });
            } finally {
                if (on) setLoading(false);
            }
        })();
        return () => { on = false; };
    }, [repoId, state.graphVersion, state.animationTick]);

    // 실제 그래프 + 임시 그래프 합성
    const localMerged = useMemo(() => {
        const base = graph.local || { branches:{} };
        const temp = buildTempGraph(state.transferSnapshot, "local");
        return { branches: { ...base.branches, ...temp.branches } };
    }, [graph.local, state.transferSnapshot]);

    const remoteMerged = useMemo(() => {
        const base = graph.remote || { branches:{} };
        const temp = buildTempGraph(state.transferSnapshot, "remote");
        return { branches: { ...base.branches, ...temp.branches } };
    }, [graph.remote, state.transferSnapshot]);

    const localPos = useMemo(() => calcPositions(localMerged), [localMerged]);
    const remotePos = useMemo(() => calcPositions(remoteMerged), [remoteMerged]);
    const localBranches = useMemo(() => linesFrom(localPos), [localPos]);
    const remoteBranches = useMemo(() => linesFrom(remotePos), [remotePos]);

    const emptyLocal = Object.keys(localPos).length === 0;
    const emptyRemote = Object.keys(remotePos).length === 0;

    const animClass = state.animationMode === "push" ? "moving push"
        : state.animationMode === "pull" ? "moving pull"
            : "";

    if (!repoId) return <div className="panel"><div className="empty">레포지토리를 선택하면 그래프가 표시됩니다.</div></div>;
    if (loading) return <div className="panel"><div className="empty">그래프 불러오는 중…</div></div>;
    if (err) return <div className="panel"><div className="error">{err}</div></div>;

    return (
        <div className="visualization-area">
            <AnimationEngine />
            <div className="stage">
                <div className="panel">
                    <h3>Local</h3>
                    <div className="commit-graph">
                        <BranchLine branches={localBranches} />
                        {emptyLocal && <div className="empty">표시할 커밋이 없습니다.</div>}
                        {!emptyLocal && Object.entries(localPos).map(([hash, node]) => (
                            <CommitNode
                                key={`l-${hash}`}
                                commit={{ hash, message: node.message, files: node.files }}
                                position={{ x: node.x, y: node.y }}
                                isHead={false}
                                className={state.transferSnapshot?.type === "push" ? animClass : ""}
                            />
                        ))}
                    </div>
                </div>

                <div className="panel">
                    <h3>Remote</h3>
                    <div className="commit-graph">
                        <BranchLine branches={remoteBranches} remote />
                        {emptyRemote && <div className="empty">표시할 커밋이 없습니다.</div>}
                        {!emptyRemote && Object.entries(remotePos).map(([hash, node]) => (
                            <CommitNode
                                key={`r-${hash}`}
                                commit={{ hash, message: node.message, files: node.files }}
                                position={{ x: node.x, y: node.y }}
                                isHead={false}
                                className={state.transferSnapshot?.type === "pull" ? animClass : ""}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
