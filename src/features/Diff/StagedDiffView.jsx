import React, { useState, useEffect } from "react";
import { api } from "../API";
import { useGit } from "../GitCore/GitContext";
import DiffContentDisplay from "./DiffContentDisplay";

export default function StagedDiffView() {
    const { state } = useGit();
    const repoId = state.selectedRepoId;

    const [diffContent, setDiffContent] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!repoId) {
            setLoading(false);
            setError("저장소 정보가 필요합니다.");
            return;
        }

        const fetchDiff = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await api.repos.diffStaged(repoId);
                let diffText = "";

                if (typeof data === 'string') {
                    diffText = data;
                } else if (Array.isArray(data)) {
                    diffText = data
                        .map(item => (typeof item === 'string' ? item : item.diff || ''))
                        .join('\n');
                } else if (data && typeof data.diff === 'string') {
                    diffText = data.diff;
                }

                setDiffContent(diffText || "올릴 예정인 변경사항이 없습니다.");

            } catch (err) {
                setError(err.message || "올릴 예정인 변경사항을 불러오는 데 실패했습니다.");
                setDiffContent("");
            } finally {
                setLoading(false);
            }
        };

        fetchDiff();
    }, [repoId, state.gitStatusCounter]);

    if (loading) {
        return <div>변경사항 로딩 중...</div>;
    }

    if (error) {
        return <div style={{ color: "var(--danger)" }}>{error}</div>;
    }

    return <DiffContentDisplay diffContent={diffContent} />;
}