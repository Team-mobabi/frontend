import React, { useState, useEffect, useRef } from "react";
import { useGit } from "../GitCore/GitContext";
import { api } from "../API";

export default function DiffStatsView() {
    const { state } = useGit();
    const { selectedRepoId, graphVersion, stagingArea = [] } = state;

    const [stats, setStats] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // 레이스/캐시 보호
    const lastRepoRef = useRef(null);
    const inFlightRepoRef = useRef(null);

    useEffect(() => {
        if (!selectedRepoId) {
            setStats(null);
            lastRepoRef.current = null;
            return;
        }

        if (lastRepoRef.current && lastRepoRef.current !== selectedRepoId) {
            setStats(null);
        }

        setError("");
        setLoading(true);

        const repoAtCall = selectedRepoId;
        inFlightRepoRef.current = repoAtCall;

        api.repos.diffStats(repoAtCall)
            .then((data) => {
                if (inFlightRepoRef.current !== repoAtCall) return;

                const n = {
                    filesChanged: data?.files || data?.filesChanged || 0,
                    totalInsertions: data?.additions || data?.insertions || data?.totalInsertions || 0,
                    totalDeletions: data?.deletions || data?.totalDeletions || 0,
                };
                setStats(n);
                lastRepoRef.current = repoAtCall;
            })
            .catch((err) => {
                setError(err.message || "Diff 통계를 불러올 수 없습니다.");
                setStats(null);
            })
            .finally(() => setLoading(false));
    }, [selectedRepoId, graphVersion, stagingArea]);

    if (loading) return <div className="diff-stats-panel">변경 사항 계산 중...</div>;
    if (!stats || (!stats.totalInsertions && !stats.totalDeletions && !stats.filesChanged)) return null;

    return (
        <div className="diff-stats-panel">
            <div className="diff-stats-title">현재 변경 사항 요약</div>
            {error && <div className="diff-error">{error}</div>}

            <div className="stats-container">
                <div className="stat-item files">
                    <div className="label">파일 변경됨</div>
                    <strong>{stats.filesChanged || 0}</strong>
                </div>
                <div className="stat-item insertions">
                    <div className="label">추가된 라인</div>
                    <strong>+{stats.totalInsertions || 0}</strong>
                </div>
                <div className="stat-item deletions">
                    <div className="label">삭제된 라인</div>
                    <strong>-{stats.totalDeletions || 0}</strong>
                </div>
            </div>
        </div>
    );
}
