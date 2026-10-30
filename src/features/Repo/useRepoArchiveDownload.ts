import { useCallback, useState } from "react";
import { errorMessage } from "../../lib/api";
import { downloadRepoArchive } from "../../lib/download";
import type { Id } from "../../types/api";

// 저장소 zip 다운로드(.git 제외) + 진행 상태. 실패 시 사용자에게 보여줄 메시지를 돌려준다
export function useRepoArchiveDownload() {
    const [downloading, setDownloading] = useState(false);

    const download = useCallback(async (repoId: Id, repoName?: string): Promise<string | null> => {
        setDownloading(true);
        try {
            await downloadRepoArchive(repoId, repoName);
            return null;
        } catch (err) {
            return errorMessage(err, "저장소 다운로드에 실패했습니다.");
        } finally {
            setDownloading(false);
        }
    }, []);

    return { downloading, download };
}
