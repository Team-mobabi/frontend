import type { CSSProperties } from "react";

export type DiffLineKind = "add" | "del" | "hunk" | "meta" | "context";

// diff 한 줄의 종류 판별 (+ 추가, - 삭제, @@ 헝크 헤더, diff --git/index 파일 헤더)
export function diffLineKind(line: string): DiffLineKind {
    if (line.startsWith("+")) return "add";
    if (line.startsWith("-")) return "del";
    if (line.startsWith("@@")) return "hunk";
    if (line.startsWith("diff --git") || line.startsWith("index")) return "meta";
    return "context";
}

export type DiffLineTheme = Partial<Record<DiffLineKind, CSSProperties>> & { base?: CSSProperties };

// 일반 diff 화면 (DiffContentDisplay)
export const DEFAULT_DIFF_THEME: DiffLineTheme = {
    base: { display: "block" },
    add: { color: "green", backgroundColor: "#e6ffed" },
    del: { color: "red", backgroundColor: "#ffeef0" },
    hunk: { color: "#007acc", backgroundColor: "#f0f8ff" },
    meta: { color: "#888", fontWeight: "bold" },
};

// 변경 요청 상세 화면: CSS 변수 색상 + 줄바꿈 허용, 파일 헤더 강조 없음
export const PR_DIFF_THEME: DiffLineTheme = {
    base: { display: "block", whiteSpace: "pre-wrap" },
    add: { color: "var(--success)", backgroundColor: "rgba(40, 167, 69, 0.1)" },
    del: { color: "var(--danger)", backgroundColor: "rgba(220, 53, 69, 0.1)" },
    hunk: { color: "var(--info)" },
};
