import React, { useState, useEffect, useRef } from "react";
import { api } from "../API";
import { useGit } from "../GitCore/GitContext";
import DiffContentDisplay from "./DiffContentDisplay";

const StagedDiffView = React.memo(function StagedDiffView() {
    const { state } = useGit();
    
    // 필요한 값만 추출
    const repoId = state.selectedRepoId;
    const gitStatusCounter = state.gitStatusCounter;
    const stagingAreaLength = state.stagingArea?.length || 0;

    const [diffContent, setDiffContent] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const lastFetchRef = useRef({ repoId: null, counter: null, length: null });
    const fetchTimeoutRef = useRef(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (!repoId) {
            if (isMountedRef.current) {
                setLoading(false);
                setError("저장소 정보가 필요합니다.");
            }
            return;
        }

        // 이미 같은 조건으로 fetch한 경우 스킵 (초기 로딩 제외)
        const isInitialLoad = lastFetchRef.current.repoId === null;
        if (
            !isInitialLoad &&
            lastFetchRef.current.repoId === repoId &&
            lastFetchRef.current.counter === gitStatusCounter &&
            lastFetchRef.current.length === stagingAreaLength
        ) {
            return;
        }

        // 이전 timeout 취소
        if (fetchTimeoutRef.current) {
            clearTimeout(fetchTimeoutRef.current);
        }

        // debounce: 100ms 후에 fetch (초기 로딩은 즉시)
        const delay = isInitialLoad ? 0 : 100;
        fetchTimeoutRef.current = setTimeout(async () => {
            if (!isMountedRef.current) return;
            
            setLoading(true);
            setError(null);
            try {
                const data = await api.repos.diffStaged(repoId);
                
                if (!isMountedRef.current) return;
                
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
                
                // fetch 성공 시 마지막 fetch 정보 업데이트
                lastFetchRef.current = {
                    repoId,
                    counter: gitStatusCounter,
                    length: stagingAreaLength
                };

            } catch (err) {
                if (!isMountedRef.current) return;
                setError(err.message || "올릴 예정인 변경사항을 불러오는 데 실패했습니다.");
                setDiffContent("");
            } finally {
                if (isMountedRef.current) {
                    setLoading(false);
                }
            }
        }, delay);

        return () => {
            if (fetchTimeoutRef.current) {
                clearTimeout(fetchTimeoutRef.current);
            }
        };
    }, [repoId, gitStatusCounter, stagingAreaLength]);

    if (loading) {
        return <div>변경사항 로딩 중...</div>;
    }

    if (error) {
        return <div style={{ color: "var(--danger)" }}>{error}</div>;
    }

    return <DiffContentDisplay diffContent={diffContent} />;
});

export default StagedDiffView;