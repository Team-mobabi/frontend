import type { RepoStatus, StatusFile } from "../types/api";

// status 응답의 파일 항목(path / file / name 혼재)을 경로 문자열로 바꾼다
export function statusFilePath(f: StatusFile | string): string {
    if (typeof f === "string") return f;
    return f.path || f.file || f.name || String(f);
}

// status.files가 배열이면 경로 목록, 아니면 null
export function statusFilePaths(status: RepoStatus | null | undefined): string[] | null {
    return Array.isArray(status?.files) ? status.files.map(statusFilePath) : null;
}
