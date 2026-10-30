import { api } from "./api";
import { createLogger } from "./logger";
import { stripGitFromArchive } from "../utils/archiveUtils";
import type { Id } from "../types/api";

const log = createLogger("download");

// Blob을 파일로 저장하도록 브라우저 다운로드를 트리거한다
export function saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// 저장소 전체를 zip으로 받되, 초보자가 혼동하지 않도록 .git 폴더는 제거한다
export async function downloadRepoArchive(repoId: Id, repoName?: string): Promise<void> {
    const blob = await api.repos.download(repoId);
    let archive = blob;
    try {
        archive = await stripGitFromArchive(blob);
    } catch (err) {
        log.warn("Failed to strip .git directory, downloading original archive.", err);
    }
    saveBlob(archive, `${repoName || `repo-${repoId}`}.zip`);
}
