import { useState, useEffect, useRef } from "react";
import { useGit } from "../GitCore/GitContext";
import { api, errorMessage } from "../../lib/api";
import type { DiffStats, Id } from "../../types/api";

// 서버가 files를 개수(number)로 주는 버전도 있어 로컬에서 넓힌다
type DiffStatsPayload = Omit<DiffStats, "files"> & { files?: number | DiffStats["files"] };

interface NormalizedStats {
    filesChanged: number;
    totalInsertions: number;
    totalDeletions: number;
}

function countFiles(files: DiffStatsPayload["files"]): number {
    if (typeof files === "number") return files;
    return Array.isArray(files) ? files.length : 0;
}

export default function DiffStatsView() {
    const { state } = useGit();
    const { selectedRepoId, graphVersion, stagingArea } = state;
    const stagingCount = stagingArea.length;

    const [stats, setStats] = useState<NormalizedStats | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // 레이스/캐시 보호
    const lastRepoRef = useRef<Id | null>(null);
    const inFlightRepoRef = useRef<Id | null>(null);

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
            .then((res) => {
                if (inFlightRepoRef.current !== repoAtCall) return;
                const data = res as DiffStatsPayload | null;

                setStats({
                    filesChanged: countFiles(data?.files) || data?.filesChanged || 0,
                    totalInsertions: data?.additions || data?.insertions || data?.totalInsertions || 0,
                    totalDeletions: data?.deletions || data?.totalDeletions || 0,
                });
                lastRepoRef.current = repoAtCall;
            })
            .catch((err: unknown) => {
                setError(errorMessage(err, "Diff 통계를 불러올 수 없습니다."));
                setStats(null);
            })
            .finally(() => setLoading(false));
    }, [selectedRepoId, graphVersion, stagingCount]);

    if (loading) return <div className="diff-stats-panel">변경 사항 계산 중...</div>;

    return (
        <div className="diff-stats-panel">
            <div className="diff-stats-title">현재 변경 사항 요약</div>
            {error && <div className="diff-error">{error}</div>}

            {!stats || (!stats.totalInsertions && !stats.totalDeletions && !stats.filesChanged) ? (
                <div className="stats-container">
                    <div className="stat-item files">
                        <div className="label">파일 변경됨</div>
                        <strong>0</strong>
                    </div>
                    <div className="stat-item insertions">
                        <div className="label">추가된 라인</div>
                        <strong>+0</strong>
                    </div>
                    <div className="stat-item deletions">
                        <div className="label">삭제된 라인</div>
                        <strong>-0</strong>
                    </div>
                </div>
            ) : (
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
            )}
        </div>
    );
}
