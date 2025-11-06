import React, { useEffect, useState } from "react";
import JSZip from "jszip";
import { api } from "../../features/API.js";
import { repoIdOf } from "../../features/GitCore/gitUtils.js";

const UPLOAD_BATCH_SIZE = 40;

function extractRepoId(input) {
    const trimmed = (input || "").trim();
    if (!trimmed) return "";

    const cleaned = trimmed.split("?")[0].split("#")[0];

    try {
        const parsed = new URL(cleaned);
        const segments = parsed.pathname.split("/").filter(Boolean);
        const idx = segments.indexOf("repos");
        if (idx !== -1 && segments[idx + 1]) {
            return decodeURIComponent(segments[idx + 1]);
        }
        if (segments.length) {
            return decodeURIComponent(segments[segments.length - 1]).replace(/\.zip$/i, "");
        }
    } catch {}

    const match = cleaned.match(/repos\/([^/]+)(?:\/download|\/files)?/i);
    if (match && match[1]) {
        return decodeURIComponent(match[1]);
    }

    return cleaned.replace(/\.zip$/i, "");
}

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

export default function CloneRepoModal({ open, onClose, onRepoCloned }) {
    const [source, setSource] = useState("");
    const [name, setName] = useState("");
    const [defaultBranch, setDefaultBranch] = useState("main");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [progress, setProgress] = useState("");

    useEffect(() => {
        if (!open) {
            setSource("");
            setName("");
            setDefaultBranch("main");
            setError("");
            setBusy(false);
            setProgress("");
        }
    }, [open]);

    if (!open) return null;

    const resolveName = (value) => {
        const trimmed = value.trim();
        if (trimmed) return trimmed;

        const derived = extractRepoId(source);
        if (derived) {
            return derived.replace(/\.git$/i, "").replace(/\.zip$/i, "");
        }
        return "";
    };

    const handleClone = async () => {
        const repoIdentifier = extractRepoId(source);
        if (!repoIdentifier) {
            setError("복제할 저장소 ID 또는 다운로드 URL을 입력하세요.");
            return;
        }

        const repoName = resolveName(name);
        if (!repoName) {
            setError("생성할 레포지토리 이름을 입력하거나 자동 추출될 수 있도록 입력값을 확인해주세요.");
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
                        await api.repos.commit(newRepoId, `Clone from ${repoIdentifier}`);
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
                    <h4>Git Clone</h4>
                    <button className="modal-close" onClick={() => !busy && onClose?.()}>×</button>
                </div>
                <div className="modal-body" style={{ display: "grid", gap: 12 }}>
                    <label className="input-label">
                        복제할 저장소 ID 또는 다운로드 URL
                        <input
                            className="input"
                            placeholder="예: 12345 또는 https://api.example.com/repos/12345/download"
                            value={source}
                            onChange={(e) => setSource(e.target.value)}
                            disabled={busy}
                        />
                    </label>

                    <label className="input-label">
                        새 레포지토리 이름
                        <input
                            className="input"
                            placeholder="자동 추출 또는 직접 입력"
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

                    <div className="panel-sub" style={{ lineHeight: 1.5 }}>
                        서버에서 `/repos/{repoId}/download` API로 ZIP 아카이브를 내려받아 압축을 풀고,
                        동일한 구조로 새 저장소를 생성합니다. 필요에 따라 `/repos/{repoId}/files/download`
                        엔드포인트가 폴더 단위 다운로드에 사용됩니다.
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
