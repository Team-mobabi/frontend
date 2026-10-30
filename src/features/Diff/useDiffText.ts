import { useEffect, useRef, useState } from "react";
import { errorMessage } from "../../lib/api";
import type { Id } from "../../types/api";
import { toDiffText } from "./diffText";

interface UseDiffTextOptions {
    repoId: Id | null | undefined;
    // 모듈 수준의 안정된 함수(api.repos.diffWorking 등)를 넘긴다
    load: (repoId: Id) => Promise<unknown>;
    // 값이 바뀌면 다시 불러온다
    reloadKey?: string | number;
    emptyText: string;
    errorText: string;
    // 첫 로딩 이후 재요청을 이 시간만큼 늦춘다(연속 변경 묶기)
    debounceMs?: number;
    initialLoading?: boolean;
}

export interface DiffTextState {
    diffText: string;
    loading: boolean;
    error: string | null;
}

// 저장소 diff를 불러와 텍스트로 정규화한다 (loading / error / diffText)
export function useDiffText({
    repoId,
    load,
    reloadKey,
    emptyText,
    errorText,
    debounceMs = 0,
    initialLoading = false,
}: UseDiffTextOptions): DiffTextState {
    const [diffText, setDiffText] = useState("");
    const [loading, setLoading] = useState(initialLoading);
    const [error, setError] = useState<string | null>(null);
    const loadedOnceRef = useRef(false);

    useEffect(() => {
        if (!repoId) {
            setLoading(false);
            setError("저장소 정보가 필요합니다.");
            return;
        }

        let cancelled = false;
        const delay = loadedOnceRef.current ? debounceMs : 0;
        loadedOnceRef.current = true;

        const timer = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await load(repoId);
                if (cancelled) return;
                setDiffText(toDiffText(data) || emptyText);
            } catch (err) {
                if (cancelled) return;
                setError(errorMessage(err, errorText));
                setDiffText("");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, delay);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [repoId, load, reloadKey, emptyText, errorText, debounceMs]);

    return { diffText, loading, error };
}
