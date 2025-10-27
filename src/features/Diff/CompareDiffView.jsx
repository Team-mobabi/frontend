import React, { useState } from "react";
import { api } from "../API";
import { useGit } from "../GitCore/GitContext";
import DiffContentDisplay from "./DiffContentDisplay";

export default function CompareDiffView() {
    const { state } = useGit();
    const repoId = state.selectedRepoId;

    const [refs, setRefs] = useState({ commitA: "", commitB: "" });
    const [diffContent, setDiffContent] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const onChange = (e) => {
        setRefs({ ...refs, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!repoId || !refs.commitA || !refs.commitB) {
            setError("저장소 정보와 비교할 두 개의 버전(이름 또는 ID)을 모두 입력해야 합니다.");
            return;
        }

        setLoading(true);
        setError(null);
        setDiffContent(null);

        try {
            const data = await api.repos.diffCommits(repoId, refs.commitA, refs.commitB);

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

            setDiffContent(diffText || "두 버전 간 변경 사항이 없습니다.");

        } catch (err) {
            setError(err.message || "비교 내용을 불러오는 데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="compare-diff-view">
            <form onSubmit={handleSubmit} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                    className="input"
                    name="commitA"
                    placeholder="기준 (예: main 또는 저장 ID)"
                    value={refs.commitA}
                    onChange={onChange}
                    style={{ flex: 1 }}
                />
                <span>...</span>
                <input
                    className="input"
                    name="commitB"
                    placeholder="비교 대상 (예: feature 또는 저장 ID)"
                    value={refs.commitB}
                    onChange={onChange}
                    style={{ flex: 1 }}
                />
                <button className="btn btn-primary" type="submit" disabled={loading}>
                    {loading ? "비교 중..." : "Diff 보기"}
                </button>
            </form>

            {error && <div style={{ color: "var(--danger)", marginTop: 16 }}>{error}</div>}

            {diffContent !== null && <DiffContentDisplay diffContent={diffContent} />}
        </div>
    );
}