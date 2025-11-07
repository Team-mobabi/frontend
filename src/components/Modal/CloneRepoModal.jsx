import React, { useEffect, useState } from "react";
import JSZip from "jszip";
import { api } from "../../features/API.js";
import { repoIdOf } from "../../features/GitCore/gitUtils.js";

const UPLOAD_BATCH_SIZE = 40;

// [삭제] extractRepoId 함수가 더 이상 필요하지 않아 삭제했습니다.

function findCommonFolderPrefix(paths) {
    if (!paths.length) return "";
    const splitPaths = paths.map((p) => p.split("/").filter(Boolean));
    if (!splitPaths.every((segments) => segments.length)) return "";

    const prefix = [];
    for (let i = 0; ; i += 1) {
        const segment = splitPaths[0][i];
        if (!segment) break;
        if (splitPaths.every((segments) => segments[i] === segment)) {
            prefix.push(segment);
        } else {
            break;
        }
    }

    if (!prefix.length) return "";

    const prefixLength = prefix.length;
    const allHaveMore = splitPaths.every((segments) => segments.length > prefixLength);
    if (!allHaveMore) return "";

    return `${prefix.join("/")}/`;
}

// [수정] props로 sourceRepoId와 sourceRepoName을 받습니다.
export default function CloneRepoModal({
                                           open,
                                           onClose,
                                           onRepoCloned,
                                           sourceRepoId,
                                           sourceRepoName = "" // 원본 저장소 이름 (선택 사항, UI 표시에 사용)
                                       }) {
    // [삭제] source state를 삭제했습니다.
    // const [source, setSource] = useState("");
    const [name, setName] = useState("");
    const [defaultBranch, setDefaultBranch] = useState("main");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [progress, setProgress] = useState("");

    // [수정] 모달이 열릴 때 상태를 초기화하고, 새 저장소 이름을 제안합니다.
    useEffect(() => {
        if (open) {
            setName(sourceRepoName ? `${sourceRepoName}-copy` : ""); // 예: "MyRepo-copy"
            setDefaultBranch("main");
            setError("");
            setBusy(false);
            setProgress("");
        }
    }, [open, sourceRepoName]); // 의존성 배열에 sourceRepoName 추가

    if (!open) return null;

    // [삭제] resolveName 함수를 handleClone 내부 로직으로 단순화했습니다.

    const handleClone = async () => {
        // [수정] sourceRepoId를 props에서 직접 사용합니다.
        const repoIdentifier = sourceRepoId;
        if (!repoIdentifier) {
            setError("복제할 원본 저장소 ID가 없습니다. (sourceRepoId prop 누락)");
            return;
        }

        // [수정] 이름 유효성 검사를 단순화합니다.
        const repoName = (name || "").trim();
        if (!repoName) {
            setError("새 레포지토리 이름을 입력하세요.");
            return;
        }

        const branchName = (defaultBranch || "").trim();

        setBusy(true);
        setError("");
        setProgress("원본 저장소 다운로드 중…");

        let succeeded = false;

        try {
            let archiveBlob;
            let lastDownloadError = null;

            try {
                // [수정 없음] ID만 있으면 기존 로직이 동작합니다.
                archiveBlob = await api.repos.downloadRepo(repoIdentifier);
            } catch (downloadErr) {
                lastDownloadError = downloadErr;
                console.warn("[CloneRepoModal] downloadRepo 실패, downloadFile로 재시도합니다.", downloadErr);
                setProgress("전체 다운로드가 실패하여 파일 다운로드 API로 재시도합니다…");

                const fallbackCalls = [
                    () => api.repos.downloadFile(repoIdentifier),
                    () => api.repos.downloadFile(repoIdentifier, { path: "" }),
                    () => api.repos.downloadFile(repoIdentifier, { path: "/" }),
                ];

                for (const call of fallbackCalls) {
                    try {
                        archiveBlob = await call();
                        if (archiveBlob) break;
                    } catch (fallbackErr) {
                        lastDownloadError = fallbackErr;
                    }
                }

                if (!archiveBlob) {
                    throw lastDownloadError || downloadErr;
                }
            }

            // ... (압축 해제 로직은 동일) ...
            setProgress("압축 해제 준비 중…");
            const zip = await JSZip.loadAsync(archiveBlob);
            const fileEntries = Object.values(zip.files).filter((entry) => !entry.dir && !entry.name.endsWith("/"));

            if (!fileEntries.length) {
                throw new Error("원본 저장소에서 가져올 파일을 찾을 수 없습니다.");
            }

            const prefixToStrip = findCommonFolderPrefix(fileEntries.map((entry) => entry.name));
            const files = [];

            for (let i = 0; i < fileEntries.length; i += 1) {
                const entry = fileEntries[i];
                let relativePath = prefixToStrip ? entry.name.replace(prefixToStrip, "") : entry.name;
                if (!relativePath) continue;
                if (relativePath.startsWith("__MACOSX/")) continue;

                const fileBlob = await entry.async("blob");
                const filename = relativePath.split("/").pop() || "file";
                const file = new File([fileBlob], filename, { type: fileBlob.type || "application/octet-stream" });
                Object.defineProperty(file, "webkitRelativePath", { value: relativePath, configurable: true });
                files.push(file);

                if ((i + 1) % 10 === 0 || i + 1 === fileEntries.length) {
                    setProgress(`파일 추출 중… ${i + 1}/${fileEntries.length}`);
                }
            }
            // ... (파일 생성 로직 끝) ...

            setProgress("새 저장소 생성 중…");
            const createPayload = { name: repoName };
            if (branchName) {
                createPayload.defaultBranch = branchName;
            }

            const createdRepo = await api.repos.create(createPayload);
            const newRepoId = repoIdOf(createdRepo);
            if (!newRepoId) {
                throw new Error("새 저장소 ID를 확인할 수 없습니다.");
            }

            try {
                await api.repos.addLocalRemote(newRepoId, { name: "origin" });
            } catch (remoteErr) {
                console.warn("[CloneRepoModal] addLocalRemote 실패:", remoteErr);
            }

            const uploadedPaths = [];
            if (files.length) {
                for (let i = 0; i < files.length; i += UPLOAD_BATCH_SIZE) {
                    const batch = files.slice(i, i + UPLOAD_BATCH_SIZE);
                    setProgress(`파일 업로드 중… ${Math.min(i + UPLOAD_BATCH_SIZE, files.length)}/${files.length}`);
                    const result = await api.repos.upload(newRepoId, batch);
                    let saved = (result && (result.uploadedFiles?.map((f) => f.path) || result.saved || result.paths || result.files)) || [];
                    if (!Array.isArray(saved)) saved = [];
                    uploadedPaths.push(...saved);
                }

                if (uploadedPaths.length) {
                    setProgress("파일 스테이징 중…");
                    await api.repos.add(newRepoId, uploadedPaths);
                    try {
                        setProgress("초기 커밋 작성 중…");
                        // [수정] 커밋 메시지에 원본 이름을 사용합니다.
                        const commitMessage = `Clone from ${sourceRepoName || repoIdentifier}`;
                        await api.repos.commit(newRepoId, commitMessage);
                    } catch (commitErr) {
                        console.warn("[CloneRepoModal] 초기 커밋에 실패했습니다.", commitErr);
                    }
                }
            } else {
                setProgress("원본 저장소가 비어 있습니다. 빈 저장소를 생성합니다.");
            }

            succeeded = true;
            onRepoCloned?.({ ...createdRepo, id: newRepoId, name: createdRepo?.name || repoName });
            onClose?.();
        } catch (e) {
            console.error("[CloneRepoModal] 복제 실패:", e);
            const msg = (e?.data?.message || e?.message || "저장소 복제에 실패했습니다.").toString();
            setError(Array.isArray(msg) ? msg.join("\n") : msg);
        } finally {
            setBusy(false);
            if (succeeded) {
                setProgress("");
            }
        }
    };

    return (
        <div className="modal-backdrop" onClick={() => !busy && onClose?.()}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 480 }}>
                <div className="modal-head">
                    {/* [수정] 목적에 맞게 "저장소 복제"로 변경 (선택 사항) */}
                    <h4>저장소 복제</h4>
                    <button className="modal-close" onClick={() => !busy && onClose?.()}>×</button>
                </div>
                <div className="modal-body" style={{ display: "grid", gap: 12 }}>

                    {/* [추가] 원본 저장소를 표시해줍니다. */}
                    <label className="input-label">
                        원본 저장소
                        <div className="input" style={{ backgroundColor: "var(--bg-inset)", cursor: "default" }}>
                            {sourceRepoName || sourceRepoId}
                        </div>
                    </label>

                    {/* [삭제] "복제할 저장소 ID..." 입력창 삭제 */}

                    <label className="input-label">
                        새 레포지토리 이름
                        <input
                            className="input"
                            // [수정] placeholder 변경
                            placeholder="새 저장소의 이름을 입력하세요."
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={busy}
                        />
                    </label>

                    <label className="input-label">
                        기본 브랜치 이름
                        <input
                            className="input"
                            placeholder="예: main"
                            value={defaultBranch}
                            onChange={(e) => setDefaultBranch(e.target.value)}
                            disabled={busy}
                        />
                    </label>

                    {/* [수정] 도움말 텍스트 변경 */}
                    <div className="panel-sub" style={{ lineHeight: 1.5 }}>
                        <strong>{sourceRepoName || sourceRepoId}</strong> 저장소의 파일을 복사하여
                        독립적인 새 저장소를 생성합니다. 원본과의 연결(Fork) 관계는 생성되지 않습니다.
                    </div>

                    {progress && (
                        <div style={{ fontSize: 12, color: "var(--primary)", whiteSpace: "pre-line" }}>
                            {progress}
                        </div>
                    )}

                    {error && (
                        <div style={{ color: "var(--danger)", fontSize: 12, whiteSpace: "pre-line" }}>
                            {error}
                        </div>
                    )}
                </div>
                <div className="modal-actions">
                    <button className="btn" onClick={() => !busy && onClose?.()} disabled={busy}>
                        취소
                    </button>
                    <button className="btn btn-primary" onClick={handleClone} disabled={busy}>
                        {busy ? "복제 중…" : "복제하기"}
                    </button>
                </div>
            </div>
        </div>
    );
}