import type { Branch, BranchListResponse } from "../types/api";

// 서버가 배열 또는 { [key]: 배열 } 형태로 목록을 주는 경우를 하나로 정규화한다
export function listOf<T>(res: unknown, keys: readonly string[]): T[] {
    if (Array.isArray(res)) return res as T[];
    if (res && typeof res === "object") {
        for (const key of keys) {
            const value = (res as Record<string, unknown>)[key];
            if (Array.isArray(value)) return value as T[];
        }
    }
    return [];
}

// 브랜치 목록 응답(문자열 / { name } / { branch } 혼재)을 이름 배열로 바꾼다
export function branchNamesOf(res: BranchListResponse | null | undefined): string[] {
    return listOf<Branch | string | null>(res, ["branches"])
        .map((b) => (typeof b === "string" ? b : b?.name || b?.branch))
        .filter((name): name is string => Boolean(name));
}
