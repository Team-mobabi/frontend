import React, { useEffect, useMemo, useRef, useState } from "react";
import { useGit } from "../GitCore/GitContext";
import { api } from "../API";
import CommitNode from "./CommitNode";
import BranchLine from "./BranchLine";

const Y = 70;
const X = 150;

function hashOf(c) {
    return c?.hash || c?.sha || c?.oid || c?.id || c?.commit?.hash || "";
}
function msgOf(c) {
    return c?.message || c?.msg || c?.title || c?.commit?.message || "";
}
function filesOf(c) {
    const a = c?.files || c?.paths || c?.changed;
    if (Array.isArray(a)) return a.map(String);
    if (c?.changes && typeof c.changes === "object") return Object.keys(c.changes);
    return [];
}

function normalizeGraph(raw) {
    if (!raw) return { branches: {} };
    if (raw.branches && typeof raw.branches === "object" && !Array.isArray(raw.branches)) {
        const out = {};
        Object.entries(raw.branches).forEach(([b, arr]) => {
            out[b] = (arr || []).map(c => ({
                hash: hashOf(c),
                message: msgOf(c),
                files: filesOf(c),
            })).filter(c => c.hash);
        });
        return { branches: out };
    }
    const arr = raw.commits || raw.history || raw.log || [];
    const list = Array.isArray(arr) ? arr : [];
    const mapped = list.map(c => ({
        hash: hashOf(c),
        message: msgOf(c),
        files: filesOf(c),
    })).filter(c => c.hash);
    const name = raw.currentBranch || raw.head || raw.branch || "main";
    return { branches: { [name]: mapped } };
}

function calculateCommitPositions(repoState) {
    const commitPositions = {};
    const branchMap = repoState?.branches || {};
    let yOffset = 50;
    let xOffset = 120;
    Object.entries(branchMap).forEach(([branchName, commits]) => {
        let currentY = yOffset;
        commits.forEach((c) => {
            const h = c.hash;
            if (!commitPositions[h]) {
                commitPositions[h] = { x: xOffset, y: currentY, branch: branchName, message: c.message, files: c.files };
                currentY += Y;
            }
        });
        xOffset += X;
    });
    return commitPositions;
}

function toBranchLines(pos) {
    const by = {};
    for (const [, v] of Object.entries(pos || {})) {
        const b = v.branch || "main";
        if (!by[b]) by[b] = { points: [] };
        by[b].points.push({ x: v.x, y: v.y });
    }
    Object.values(by).forEach(b => b.points.sort((a, b) => a.y - b.y));
    return by;
}

export default function RepositoryView() {
    const { state } = useGit();
    const repoId = state?.selectedRepoId ? String(state.selectedRepoId) : "";
    const [graph, setGraph] = useState({ local: null, remote: null });
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");
    const hasRepo = !!repoId;
    const repoIdRef = useRef(""); useEffect(()=>{repoIdRef.current = repoId;},[repoId]);

    useEffect(() => {
        if (!hasRepo) { setGraph({ local:null, remote:null }); setErr(""); return; }
        let on = true;
        setLoading(true); setErr("");
        (async () => {
            try {
                const g = await api.repos.graph(repoIdRef.current);
                if (!on) return;
                setGraph({
                    local: normalizeGraph(g?.local ?? g?.workspace ?? g?.localRepo ?? null),
                    remote: normalizeGraph(g?.remote ?? g?.origin ?? g?.remoteRepo ?? null)
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
    }, [hasRepo, state?.graphVersion]);

    const localPos = useMemo(() => calculateCommitPositions(graph.local || { branches:{} }), [graph.local]);
    const remotePos = useMemo(() => calculateCommitPositions(graph.remote || { branches:{} }), [graph.remote]);
    const localBranches = useMemo(() => toBranchLines(localPos), [localPos]);
    const remoteBranches = useMemo(() => toBranchLines(remotePos), [remotePos]);

    const emptyLocal = Object.keys(localPos).length === 0;
    const emptyRemote = Object.keys(remotePos).length === 0;

    if (!hasRepo) return <div className="panel"><div className="empty">레포지토리를 선택하면 그래프가 표시됩니다.</div></div>;
    if (loading) return <div className="panel"><div className="empty">그래프 불러오는 중…</div></div>;
    if (err) return <div className="panel"><div className="error">{err}</div></div>;

    return (
        <div className="visualization-area">
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
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
