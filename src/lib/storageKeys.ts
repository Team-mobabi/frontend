// 마지막으로 선택한 저장소 ID (로그아웃·계정 전환 시 반드시 삭제)
export const LAST_REPO_KEY = "git_last_repo";

export function clearLastRepo(): void {
    try { localStorage.removeItem(LAST_REPO_KEY); } catch { /* storage unavailable */ }
}
