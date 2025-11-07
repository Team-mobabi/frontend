import React, { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { api } from "../../features/API.js";
import { repoIdOf } from "../../features/GitCore/gitUtils.js";

const UPLOAD_BATCH_SIZE = 40;

const buildStepState = () => ([
    { id: "download", label: "원본 저장소 다운로드", status: "idle", message: "" },
    { id: "extract", label: "압축 해제 및 파일 준비", status: "idle", message: "" },
    { id: "create", label: "새 저장소 생성", status: "idle", message: "" },
    { id: "upload", label: "파일 업로드 및 스테이징", status: "idle", message: "" },
    { id: "commit", label: "초기 커밋 완료", status: "idle", message: "" },
]);

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
                                            sourceRepoName = "", // 원본 저장소 이름 (선택 사항, UI 표시에 사용)
                                            onManageCollaborators,
                                       }) {
    // [삭제] source state를 삭제했습니다.
    // const [source, setSource] = useState("");
    const [name, setName] = useState("");
    const [defaultBranch, setDefaultBranch] = useState("main");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [steps, setSteps] = useState(buildStepState);
    const [successRepo, setSuccessRepo] = useState(null);
    const [copyInfo, setCopyInfo] = useState("");
    const copyTimerRef = useRef(null);

    useEffect(() => () => {
        if (copyTimerRef.current) {
            clearTimeout(copyTimerRef.current);
        }
    }, []);

    // [수정] 모달이 열릴 때 상태를 초기화하고, 새 저장소 이름을 제안합니다.
    useEffect(() => {
        if (open) {
            setName(sourceRepoName ? `${sourceRepoName}-copy` : ""); // 예: "MyRepo-copy"
            setDefaultBranch("main");
            setError("");
            setBusy(false);
            setSteps(buildStepState());
            setSuccessRepo(null);
            setCopyInfo("");
        }
    }, [open, sourceRepoName]); // 의존성 배열에 sourceRepoName 추가

    if (!open) return null;

    // [삭제] resolveName 함수를 handleClone 내부 로직으로 단순화했습니다.

    const updateStep = (id, patch) => {
        setSteps((prev) =>
            prev.map((step) => {
                if (step.id !== id) return step;
                const next = { ...step };
                if (patch.status) next.status = patch.status;
                if (patch.message !== undefined) next.message = patch.message;
                return next;
            })
        );
    };

    const handleCopy = async (value, label) => {
        if (!value) return;
        try {
            await navigator.clipboard.writeText(String(value));
            setCopyInfo(`${label}를 복사했어요.`);
        } catch (err) {
            console.warn("[CloneRepoModal] 클립보드 복사 실패:", err);
            setCopyInfo("클립보드 복사에 실패했습니다. 직접 복사해주세요.");
        }
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setCopyInfo(""), 2200);
    };

    const handleClone = async () => {
        if (busy) return;
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
        setSteps(buildStepState());
        setSuccessRepo(null);

        let succeeded = false;
        let activeStepId = null;

        const startStep = (id, message) => {
            activeStepId = id;
            updateStep(id, { status: "active", message });
        };
        const completeStep = (id, message) => {
            updateStep(id, { status: "done", message });
            if (activeStepId === id) activeStepId = null;
        };
        const failStep = (id, message) => {
            updateStep(id, { status: "error", message });
            if (activeStepId === id) activeStepId = null;
        };
        const skipStep = (id, message) => {
            updateStep(id, { status: "skipped", message });
            if (activeStepId === id) activeStepId = null;
        };
        const pulseStep = (id, message) => updateStep(id, { message });

        try {
            let archiveBlob;
            let lastDownloadError = null;

            try {
                startStep("download", "원본 저장소 아카이브를 다운로드 중…");
                // [수정 없음] ID만 있으면 기존 로직이 동작합니다.
                archiveBlob = await api.repos.downloadRepo(repoIdentifier);
                completeStep("download", "원본 저장소 다운로드 완료");
            } catch (downloadErr) {
                lastDownloadError = downloadErr;
                console.warn("[CloneRepoModal] downloadRepo 실패, downloadFile로 재시도합니다.", downloadErr);
                pulseStep("download", "전체 다운로드가 실패해 파일 단위 API로 재시도합니다…");

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
                    failStep("download", lastDownloadError?.message || downloadErr?.message || "다운로드에 실패했습니다.");
                    throw lastDownloadError || downloadErr;
                }
                completeStep("download", "원본 저장소 다운로드 완료");
            }

            // ... (압축 해제 로직은 동일) ...
            startStep("extract", "압축 파일 구조를 분석하는 중…");
            const zip = await JSZip.loadAsync(archiveBlob);
            const fileEntries = Object.values(zip.files).filter((entry) => !entry.dir && !entry.name.endsWith("/"));

            if (!fileEntries.length) {
                completeStep("extract", "복제할 파일이 없습니다.");
                skipStep("upload", "업로드할 파일이 없어 건너뜀");
                skipStep("commit", "커밋할 변경이 없어 건너뜀");
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
                    pulseStep("extract", `파일을 준비하는 중… ${i + 1}/${fileEntries.length}`);
                }
            }
            // ... (파일 생성 로직 끝) ...
            completeStep("extract", `${files.length}개 파일 준비 완료`);

            startStep("create", "새 저장소 정보를 생성하는 중…");
            const createPayload = { name: repoName };
            if (branchName) {
                createPayload.defaultBranch = branchName;
            }

            const createdRepo = await api.repos.create(createPayload);
            const newRepoId = repoIdOf(createdRepo);
            if (!newRepoId) {
                failStep("create", "새 저장소 ID를 확인할 수 없습니다.");
                throw new Error("새 저장소 ID를 확인할 수 없습니다.");
            }
            completeStep("create", `새 저장소 생성 완료 (ID: ${newRepoId})`);

            try {
                await api.repos.addLocalRemote(newRepoId, { name: "origin" });
            } catch (remoteErr) {
                console.warn("[CloneRepoModal] addLocalRemote 실패:", remoteErr);
            }

            const uploadedPaths = [];
            if (files.length) {
                startStep("upload", "파일 업로드 중…");
                for (let i = 0; i < files.length; i += UPLOAD_BATCH_SIZE) {
                    const batch = files.slice(i, i + UPLOAD_BATCH_SIZE);
                    pulseStep(
                        "upload",
                        `파일 업로드 중… ${Math.min(i + UPLOAD_BATCH_SIZE, files.length)}/${files.length}`
                    );
                    const result = await api.repos.upload(newRepoId, batch);
                    let saved = (result && (result.uploadedFiles?.map((f) => f.path) || result.saved || result.paths || result.files)) || [];
                    if (!Array.isArray(saved)) saved = [];
                    uploadedPaths.push(...saved);
                }

                if (uploadedPaths.length) {
                    pulseStep("upload", "파일 스테이징 중…");
                    await api.repos.add(newRepoId, uploadedPaths);
                    try {
                        completeStep("upload", `${uploadedPaths.length}개 파일 업로드 및 스테이징 완료`);
                        startStep("commit", "초기 커밋 작성 중…");
                        // [수정] 커밋 메시지에 원본 이름을 사용합니다.
                        const commitMessage = `Clone from ${sourceRepoName || repoIdentifier}`;
                        await api.repos.commit(newRepoId, commitMessage);
                        completeStep("commit", `커밋 메시지: "${commitMessage}"`);
                    } catch (commitErr) {
                        console.warn("[CloneRepoModal] 초기 커밋에 실패했습니다.", commitErr);
                        failStep("commit", "초기 커밋에 실패했습니다. 스테이징만 완료되었습니다.");
                    }
                }
            } else {
                skipStep("upload", "복제할 파일이 없어 건너뜁니다.");
                skipStep("commit", "커밋할 변경이 없어 건너뜁니다.");
                pulseStep("create", "원본 저장소가 비어 있어 빈 저장소만 생성했습니다.");
            }

            succeeded = true;
            const preparedRepo = {
                ...createdRepo,
                id: newRepoId,
                name: createdRepo?.name || repoName,
                defaultBranch: createdRepo?.defaultBranch || branchName || "main",
                fileCount: files.length,
            };
            setSuccessRepo(preparedRepo);
            onRepoCloned?.({ ...createdRepo, id: newRepoId, name: createdRepo?.name || repoName });
        } catch (e) {
            console.error("[CloneRepoModal] 복제 실패:", e);
            const msg = (e?.data?.message || e?.message || "저장소 복제에 실패했습니다.").toString();
            setError(Array.isArray(msg) ? msg.join("\n") : msg);
            if (activeStepId) {
                failStep(activeStepId, e?.message || "오류가 발생했습니다.");
            }
            setSuccessRepo(null);
        } finally {
            setBusy(false);
        }
    };

    const handleClose = () => {
        if (busy) return;
        onClose?.();
    };

    const handleOpenCollaborators = () => {
        if (!successRepo) {
            if (!busy) onManageCollaborators?.(sourceRepoId);
            return;
        }
        onManageCollaborators?.(successRepo.id || successRepo.repoId);
        handleClose();
    };

    const renderStatusBadge = (status) => {
        const config = {
            idle: { icon: "○", color: "var(--muted)", bg: "transparent", border: "var(--line)" },
            active: { icon: "⏳", color: "var(--primary)", bg: "rgba(75,90,228,0.1)", border: "rgba(75,90,228,0.35)" },
            done: { icon: "✔", color: "#22c55e", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.4)" },
            skipped: { icon: "⤴", color: "var(--muted)", bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.35)" },
            error: { icon: "⚠️", color: "var(--danger)", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.4)" },
        }[status] || { icon: "○", color: "var(--muted)", bg: "transparent", border: "var(--line)" };

        return (
            <span
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: config.bg,
                    border: `1px solid ${config.border}`,
                    color: config.color,
                    fontSize: 13,
                    flexShrink: 0,
                }}
            >
                {config.icon}
            </span>
        );
    };

    const sourceLabel = sourceRepoName || "이름 없는 저장소";
    const successRepoId = successRepo?.id || successRepo?.repoId;

    return (
        <div className="modal-backdrop" onClick={() => !busy && handleClose()}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 520 }}>
                <div className="modal-head">
                    {/* [수정] 목적에 맞게 "저장소 복제"로 변경 (선택 사항) */}
                    <h4>저장소 복제</h4>
                    <button className="modal-close" onClick={() => !busy && handleClose()}>×</button>
                </div>
                <div className="modal-body" style={{ display: "grid", gap: 14 }}>

                    {!successRepo && (
                        <>
                            {/* [추가] 원본 저장소를 표시해줍니다. */}
                            <label className="input-label">
                                원본 저장소
                                <div className="input" style={{ backgroundColor: "var(--bg-inset)", display: "flex", flexDirection: "column", gap: 6, cursor: "default" }}>
                                    <div style={{ fontWeight: 600 }}>{sourceLabel}</div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ fontSize: 12, color: "var(--muted)" }}>ID:</span>
                                        <code style={{ fontSize: 12, padding: "2px 6px", background: "rgba(15,23,42,0.08)", borderRadius: 4 }}>
                                            {sourceRepoId || "-"}
                                        </code>
                                        {sourceRepoId && (
                                            <button
                                                className="btn btn-ghost"
                                                style={{ padding: "2px 8px", fontSize: 12 }}
                                                onClick={() => handleCopy(sourceRepoId, "원본 저장소 ID")}
                                                disabled={busy}
                                            >
                                                복사
                                            </button>
                                        )}
                                    </div>
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
                                <strong>{sourceLabel}</strong> 저장소의 파일을 복사하여
                                독립적인 새 저장소를 생성합니다. 복제가 완료되면 상단 헤더의{" "}
                                <strong>⚙️ 협업자 관리</strong> 버튼이나 아래 안내 버튼으로 바로 협업자를 초대할 수 있습니다.
                            </div>
                        </>
                    )}

                    {successRepo && (
                        <div className="panel-sub" style={{ lineHeight: 1.5, display: "grid", gap: 6, background: "var(--bg-inset)" }}>
                            <div style={{ fontWeight: 700 }}>복제가 완료됐어요!</div>
                            <div>
                                새 저장소: <strong>{successRepo.name}</strong>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span>저장소 ID:</span>
                                <code style={{ fontSize: 12, padding: "2px 6px", background: "rgba(15,23,42,0.08)", borderRadius: 4 }}>
                                    {successRepoId}
                                </code>
                                {successRepoId && (
                                    <button
                                        className="btn btn-ghost"
                                        style={{ padding: "2px 8px", fontSize: 12 }}
                                        onClick={() => handleCopy(successRepoId, "새 저장소 ID")}
                                    >
                                        복사
                                    </button>
                                )}
                            </div>
                            <div>기본 브랜치: <strong>{successRepo.defaultBranch || "main"}</strong></div>
                            <div>준비된 파일: <strong>{successRepo.fileCount ?? 0}</strong>개</div>
                            <div style={{ fontSize: 12, color: "var(--muted)" }}>
                                상단 헤더의 <strong>⚙️ 협업자 관리</strong> 버튼을 사용하거나 아래 버튼으로 바로 협업자를 초대해 보세요.
                            </div>
                        </div>
                    )}

                    <div>
                        <div style={{ fontWeight: 600, marginBottom: 6 }}>진행 상황</div>
                        <div style={{ display: "grid", gap: 8 }}>
                            {steps.map((step) => (
                                <div
                                    key={step.id}
                                    style={{
                                        display: "flex",
                                        gap: 10,
                                        alignItems: "flex-start",
                                        padding: "8px 10px",
                                        borderRadius: 8,
                                        border: "1px solid var(--line)",
                                        background:
                                            step.status === "done"
                                                ? "rgba(34,197,94,0.06)"
                                                : step.status === "active"
                                                    ? "rgba(75,90,228,0.05)"
                                                    : step.status === "error"
                                                        ? "rgba(248,113,113,0.05)"
                                                        : "transparent",
                                    }}
                                >
                                    {renderStatusBadge(step.status)}
                                    <div style={{ display: "grid", gap: 4 }}>
                                        <div style={{ fontWeight: 600 }}>{step.label}</div>
                                        {step.message && (
                                            <div style={{ fontSize: 12, color: step.status === "error" ? "var(--danger)" : "var(--muted)" }}>
                                                {step.message}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {copyInfo && (
                        <div style={{ fontSize: 12, color: "var(--primary)" }}>
                            {copyInfo}
                        </div>
                    )}

                    {error && (
                        <div style={{ color: "var(--danger)", fontSize: 12, whiteSpace: "pre-line" }}>
                            {error}
                        </div>
                    )}
                </div>
                <div className="modal-actions">
                    {!successRepo ? (
                        <>
                            <button className="btn" onClick={() => !busy && handleClose()} disabled={busy}>
                                취소
                            </button>
                            <button className="btn btn-primary" onClick={handleClone} disabled={busy}>
                                {busy ? "복제 중…" : "복제하기"}
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                className="btn btn-ghost"
                                onClick={handleOpenCollaborators}
                                disabled={!onManageCollaborators}
                            >
                                협업자 관리 열기
                            </button>
                            <div style={{ flexGrow: 1 }} />
                            <button className="btn btn-primary" onClick={handleClose}>
                                완료
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}