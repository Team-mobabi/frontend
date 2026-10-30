// 서버 버전에 따라 diff가 문자열/배열/{ diff } 형태로 온다
export function toDiffText(data: unknown): string {
    if (typeof data === "string") return data;
    if (Array.isArray(data)) {
        return data
            .map((item: unknown) => (typeof item === "string" ? item : (item as { diff?: string } | null)?.diff || ""))
            .join("\n");
    }
    if (data && typeof (data as { diff?: unknown }).diff === "string") return (data as { diff: string }).diff;
    return "";
}
