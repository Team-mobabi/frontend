import React, { useEffect, useMemo, useRef, useState } from "react";
import { useGit } from "../../features/GitCore/GitContext";
import { api } from "../../features/API";
import { calculateCommitPositions } from "../../features/GitCore/gitUtils";

export default function RepositoryView() {
    const { state } = useGit();
    const selectedRepoId = state.selectedRepoId ? String(state.selectedRepoId) : "";
    const repoIdRef = useRef("");
    useEffect(() => { repoIdRef.current = selectedRepoId; }, [selectedRepoId]);

    const [graph, setGraph] = useState({ local: null, remote: null });
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");

    const hasRepo = selectedRepoId !== "";

    useEffect(() => {
        if (!hasRepo) {
            setGraph({ local: null, remote: null });
            setErr("");
            return;
        }
        let on = true;
        setLoading(true);
        setErr("");
        (async () => {
            try {
                const rid = repoIdRef.current;
                const g = await api.repos.graph(rid);
                if (!on) return;
                const local = g?.local ?? g?.workspace ?? g?.localRepo ?? null;
                const remote = g?.remote ?? g?.origin ?? g?.remoteRepo ?? null;
                setGraph({ local, remote });
            } catch (e) {
                if (!on) return;
                setErr(e?.message || "그래프를 불러오지 못했습니다.");
                setGraph({ local: null, remote: null });
            } finally {
                if (on) setLoading(false);
            }
        })();
        return () => { on = false; };
    }, [hasRepo, selectedRepoId]);

    const localPos = useMemo(() => calculateCommitPositions(graph.local), [graph.local]);
    const remotePos = useMemo(() => calculateCommitPositions(graph.remote), [graph.remote]);

    if (!hasRepo) {
        return (
            <div className="repo-view">
                <div className="empty">레포지토리를 선택하면 그래프가 표시됩니다.</div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="repo-view">
                <div className="loading">그래프 불러오는 중…</div>
            </div>
        );
    }

    if (err) {
        return (
            <div className="repo-view">
                <div className="error">{err}</div>
            </div>
        );
    }

    return (
        <div className="repo-view">
            <div className="graph-section">
                <h4>Local</h4>
                <GraphCanvas positions={localPos} />
            </div>
            <div className="graph-section">
                <h4>Remote</h4>
                <GraphCanvas positions={remotePos} />
            </div>
        </div>
    );
}

function GraphCanvas({ positions }) {
    const entries = Object.entries(positions);
    if (entries.length === 0) {
        return <div className="empty">표시할 커밋이 없습니다.</div>;
    }
    return (
        <div className="graph-canvas">
            {entries.map(([hash, node]) => (
                <div
                    key={hash}
                    className="commit-node"
                    style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
                    title={`${hash} @ ${node.branch}`}
                >
                    <div className="dot" />
                    <div className="label">{hash}</div>
                </div>
            ))}
        </div>
    );
}
