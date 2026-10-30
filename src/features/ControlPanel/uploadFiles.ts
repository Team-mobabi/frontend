import { api, ApiError } from "../../lib/api";
import { createLogger } from "../../lib/logger";
import type { Id } from "../../types/api";

const log = createLogger("uploadFiles");

// 파일 업로드 관련 상수
const UPLOAD_BATCH_SIZE = 40; // 한 번에 업로드할 파일 개수
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 개별 파일 최대 크기: 10MB
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 전체 파일 최대 크기: 50MB

const toMB = (bytes: number, digits: number) => (bytes / (1024 * 1024)).toFixed(digits);

/**
 * 업로드 전 크기 검사. 큰 파일/전체 용량 초과 시 사용자에게 확인을 받는다.
 * 취소하면 null, 진행하면 (큰 파일을 제외한) 업로드할 파일 목록.
 */
export function confirmUploadSelection(selection: File[]): File[] | null {
    const largeFiles = selection.filter((file) => file.size > MAX_FILE_SIZE);
    const totalSize = selection.reduce((sum, file) => sum + file.size, 0);
    let result = selection;

    if (largeFiles.length > 0) {
        const fileList = largeFiles.map((f) => `- ${f.webkitRelativePath || f.name} (${toMB(f.size, 2)} MB)`).join("\n");
        if (
            !window.confirm(
                `⚠️ 큰 파일이 감지되었습니다.\n\n` +
                    `다음 파일들이 개별 파일 크기 제한(${toMB(MAX_FILE_SIZE, 0)}MB)을 초과합니다:\n\n` +
                    `${fileList}\n\n` +
                    `이 파일들은 업로드에서 제외됩니다. 계속하시겠습니까?`,
            )
        ) {
            return null;
        }
        // 큰 파일 제외
        result = selection.filter((file) => file.size <= MAX_FILE_SIZE);
    }

    if (totalSize > MAX_TOTAL_SIZE) {
        if (
            !window.confirm(
                `⚠️ 전체 파일 크기가 ${toMB(MAX_TOTAL_SIZE, 0)}MB를 초과합니다.\n\n` +
                    `현재 총 크기: ${toMB(totalSize, 2)}MB\n\n` +
                    `파일을 여러 번에 나누어 업로드합니다. 계속하시겠습니까?`,
            )
        ) {
            return null;
        }
    }
    return result;
}

async function uploadBatch(repoId: Id, batch: File[]): Promise<string[]> {
    const uploadResult = await api.repos.upload(repoId, batch);
    return Array.isArray(uploadResult?.saved) ? uploadResult.saved : [];
}

/**
 * 파일을 배치로 나누어 업로드하고 서버에 저장된 경로 목록을 돌려준다.
 * 413(용량 초과)이면 배치를 반으로 쪼개 한 번 더 시도한다.
 */
export async function uploadInBatches(repoId: Id, files: File[], onProgress: (message: string) => void): Promise<string[]> {
    const uploaded: string[] = [];
    const total = files.length;

    for (let i = 0; i < files.length; i += UPLOAD_BATCH_SIZE) {
        const batch = files.slice(i, i + UPLOAD_BATCH_SIZE);
        try {
            onProgress(`파일 업로드 중... (${Math.min(i + UPLOAD_BATCH_SIZE, total)}/${total})`);
            uploaded.push(...(await uploadBatch(repoId, batch)));
        } catch (e) {
            if (!(e instanceof ApiError && e.status === 413)) throw e;

            onProgress("파일이 너무 커서 더 작은 단위로 나누어 업로드합니다...");
            const half = Math.ceil(batch.length / 2);
            for (let j = 0; j < batch.length; j += half) {
                const smaller = batch.slice(j, j + half);
                try {
                    uploaded.push(...(await uploadBatch(repoId, smaller)));
                } catch (retryErr) {
                    log.error("작은 배치 업로드 실패:", retryErr);
                    throw new Error(`파일 업로드 실패: ${smaller.map((f) => f.name || f.webkitRelativePath).join(", ")}`);
                }
            }
        }
    }
    return uploaded;
}
