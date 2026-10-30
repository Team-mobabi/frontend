import type { PullRequest } from "../../types/api";

type PrStateSource = Pick<PullRequest, "state" | "status">;

// 서버 버전에 따라 state/status 중 하나에 대소문자 섞인 값이 온다. 비어 있으면 열린 상태로 본다.
export function normalizePrState(pr: PrStateSource | null | undefined): string {
    return String(pr?.state || pr?.status || "").trim().toUpperCase() || "OPEN";
}

// 화면 표시용 원본 라벨
export function prStateLabel(pr: PrStateSource | null | undefined): string {
    return pr?.status || pr?.state || "OPEN";
}
