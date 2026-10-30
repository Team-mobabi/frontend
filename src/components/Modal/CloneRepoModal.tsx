import { useEffect, useState } from "react";
import JSZip from "jszip";
import { api, errorMessage } from "../../lib/api";
import { createLogger } from "../../lib/logger";
import { repoIdOf } from "../../features/GitCore/gitUtils";
import type { CreateRepoPayload, Id, Repo } from "../../types/api";
import Modal from "./Modal";
import CopyableId from "../common/CopyableId";
import ErrorText from "../common/ErrorText";

const log = createLogger("CloneRepoModal");

const UPLOAD_BATCH_SIZE = 40;

type StepId = "download" | "extract" | "create" | "upload" | "commit";
type StepStatus = "idle" | "active" | "done" | "skipped" | "error";

interface CloneStep {
    id: StepId;
    label: string;
    status: StepStatus;
    message: string;
}

type ClonedRepo = Repo & { fileCount: number };

interface CloneRepoModalProps {
    open: boolean;
    onClose?: () => void;
    onRepoCloned?: (repo: Repo) => void;
    sourceRepoId?: Id | null;
    sourceRepoName?: string;
    onManageCollaborators?: (repoId: Id | null | undefined) => void;
}

const buildStepState = (): CloneStep[] => ([
    { id: "download", label: "원본 저장소 다운로드", status: "idle", message: "" },
    { id: "extract", label: "압축 해제 및 파일 준비", status: "idle", message: "" },
    { id: "create", label: "새 저장소 생성", status: "idle", message: "" },
    { id: "upload", label: "파일 업로드 및 스테이징", status: "idle", message: "" },
    { id: "commit", label: "초기 커밋 완료", status: "idle", message: "" },
]);

const STATUS_BADGE: Record<StepStatus, { icon: string; color: string; bg: string; border: string }> = {
    idle: { icon: "○", color: "var(--muted)", bg: "transparent", border: "var(--line)" },
    active: { icon: "⏳", color: "var(--primary)", bg: "rgba(75,90,228,0.1)", border: "rgba(75,90,228,0.35)" },
    done: { icon: "✔", color: "#22c55e", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.4)" },
    skipped: { icon: "⤴", color: "var(--muted)", bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.35)" },
    error: { icon: "⚠️", color: "var(--danger)", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.4)" },
};

// zip 내부 파일들이 공통 최상위 폴더(예: repo-main/) 안에 있으면 그 접두어를 찾는다
function findCommonFolderPrefix(paths: string[]): string {
    if (!paths.length) return "";
    const splitPaths = paths.map((p) => p.split("/").filter(Boolean));
    if (!splitPaths.every((segments) => segments.length)) return "";

    const prefix: string[] = [];
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

export default function CloneRepoModal({
    open,
    onClose,
    onRepoCloned,
    sourceRepoId,
    sourceRepoName = "",
    onManageCollaborators,
}: CloneRepoModalProps) {
    const [name, setName] = useState("");
    const [defaultBranch, setDefaultBranch] = useState("main");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [steps, setSteps] = useState<CloneStep[]>(buildStepState);
    const [successRepo, setSuccessRepo] = useState<ClonedRepo | null>(null);

    // 모달이 열릴 때 상태를 초기화하고 새 저장소 이름을 제안한다 (예: "MyRepo-copy")
    useEffect(() => {
        if (open) {
            setName(sourceRepoName ? `${sourceRepoName}-copy` : "");
            setDefaultBranch("main");
            setError("");
            setBusy(false);
            setSteps(buildStepState());
            setSuccessRepo(null);
        }
    }, [open, sourceRepoName]);

    const updateStep = (id: StepId, patch: { status?: StepStatus; message?: string }) => {
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

    const handleClone = async () => {
        if (busy) return;
        const repoIdentifier = sourceRepoId;
        if (!repoIdentifier) {
            setError("복제할 원본 저장소 ID가 없습니다. (sourceRepoId prop 누락)");
            return;
        }

        const repoName = (name || "").trim();
        if (!repoName) {
            setError("새 저장소 이름을 입력하세요.");
            return;
        }

        const branchName = (defaultBranch || "").trim();

        setBusy(true);
        setError("");
        setSteps(buildStepState());
        setSuccessRepo(null);

        // 클로저 안에서 갱신되므로 null로 좁혀지지 않도록 단언으로 선언
        let activeStepId = null as StepId | null;

        const startStep = (id: StepId, message: string) => {
            activeStepId = id;
            updateStep(id, { status: "active", message });
        };
        const completeStep = (id: StepId, message: string) => {
            updateStep(id, { status: "done", message });
            if (activeStepId === id) activeStepId = null;
        };
        const failStep = (id: StepId, message: string) => {
            updateStep(id, { status: "error", message });
            if (activeStepId === id) activeStepId = null;
        };
        const skipStep = (id: StepId, message: string) => {
            updateStep(id, { status: "skipped", message });
            if (activeStepId === id) activeStepId = null;
        };
        const pulseStep = (id: StepId, message: string) => updateStep(id, { message });

        try {
            let archiveBlob: Blob | null = null;

            try {
                startStep("download", "원본 저장소 아카이브를 다운로드 중…");
                archiveBlob = await api.repos.download(repoIdentifier);
                completeStep("download", "원본 저장소 다운로드 완료");
            } catch (downloadErr) {
                let lastDownloadError: unknown = downloadErr;
                log.warn("download 실패, downloadFile로 재시도합니다.", downloadErr);
                pulseStep("download", "전체 다운로드가 실패해 파일 단위 API로 재시도합니다…");

                const fallbackCalls = [
                    () => api.repos.downloadFile(repoIdentifier, {}),
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
                    failStep("download", errorMessage(lastDownloadError, "다운로드에 실패했습니다."));
                    throw lastDownloadError;
                }
                completeStep("download", "원본 저장소 다운로드 완료");
            }

            startStep("extract", "압축 파일 구조를 분석하는 중…");
            const zip = await JSZip.loadAsync(archiveBlob);
            const fileEntries = Object.values(zip.files).filter((entry) => !entry.dir && !entry.name.endsWith("/"));

            if (!fileEntries.length) {
                completeStep("extract", "복제할 파일이 없습니다.");
                skipStep("upload", "업로드할 파일이 없어 건너뜀");
                skipStep("commit", "저장할 변경이 없어 건너뜀");
                throw new Error("원본 저장소에서 가져올 파일을 찾을 수 없습니다.");
            }

            const prefixToStrip = findCommonFolderPrefix(fileEntries.map((entry) => entry.name));
            const files: File[] = [];

            for (let i = 0; i < fileEntries.length; i += 1) {
                const entry = fileEntries[i];
                const relativePath = prefixToStrip ? entry.name.replace(prefixToStrip, "") : entry.name;
                if (!relativePath) continue;
                if (relativePath.startsWith("__MACOSX/")) continue;

                const fileBlob = await entry.async("blob");
                const filename = relativePath.split("/").pop() || "file";
                const file = new File([fileBlob], filename, { type: fileBlob.type || "application/octet-stream" });
                // 업로드 시 폴더 구조를 유지하기 위해 상대 경로를 심어둔다
                Object.defineProperty(file, "webkitRelativePath", { value: relativePath, configurable: true });
                files.push(file);

                if ((i + 1) % 10 === 0 || i + 1 === fileEntries.length) {
                    pulseStep("extract", `파일을 준비하는 중… ${i + 1}/${fileEntries.length}`);
                }
            }
            completeStep("extract", `${files.length}개 파일 준비 완료`);

            startStep("create", "새 저장소 정보를 생성하는 중…");
            const createPayload: CreateRepoPayload & { defaultBranch?: string } = { name: repoName };
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
                log.warn("addLocalRemote 실패", remoteErr);
            }

            const uploadedPaths: string[] = [];
            if (files.length) {
                startStep("upload", "파일 업로드 중…");
                for (let i = 0; i < files.length; i += UPLOAD_BATCH_SIZE) {
                    const batch = files.slice(i, i + UPLOAD_BATCH_SIZE);
                    pulseStep(
                        "upload",
                        `파일 업로드 중… ${Math.min(i + UPLOAD_BATCH_SIZE, files.length)}/${files.length}`
                    );
                    const result = await api.repos.upload(newRepoId, batch);
                    uploadedPaths.push(...result.saved);
                }

                if (uploadedPaths.length) {
                    pulseStep("upload", "파일 스테이징 중…");
                    await api.repos.add(newRepoId, uploadedPaths);
                    try {
                        completeStep("upload", `${uploadedPaths.length}개 파일 업로드 및 스테이징 완료`);
                        startStep("commit", "초기 커밋 작성 중…");
                        const commitMessage = `Clone from ${sourceRepoName || repoIdentifier}`;
                        await api.repos.commit(newRepoId, commitMessage);
                        completeStep("commit", `저장 메시지: "${commitMessage}"`);
                    } catch (commitErr) {
                        log.warn("초기 저장에 실패했습니다.", commitErr);
                        failStep("commit", "초기 저장에 실패했습니다. 준비만 완료되었습니다.");
                    }
                }
            } else {
                skipStep("upload", "복제할 파일이 없어 건너뜁니다.");
                skipStep("commit", "저장할 변경이 없어 건너뜁니다.");
                pulseStep("create", "원본 저장소가 비어 있어 빈 저장소만 생성했습니다.");
            }

            setSuccessRepo({
                ...createdRepo,
                id: newRepoId,
                name: createdRepo?.name || repoName,
                defaultBranch: createdRepo?.defaultBranch || branchName || "main",
                fileCount: files.length,
            });
            onRepoCloned?.({ ...createdRepo, id: newRepoId, name: createdRepo?.name || repoName });
        } catch (e) {
            log.error("복제 실패", e);
            setError(errorMessage(e, "저장소 복제에 실패했습니다."));
            if (activeStepId) {
                failStep(activeStepId, errorMessage(e, "오류가 발생했습니다."));
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

    const renderStatusBadge = (status: StepStatus) => {
        const config = STATUS_BADGE[status] ?? STATUS_BADGE.idle;

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
        <Modal
            open={open}
            title="저장소 복제"
            onClose={handleClose}
            busy={busy}
            width={520}
            bodyStyle={{ display: "grid", gap: 14 }}
            footer={
                !successRepo ? (
                    <>
                        <button className="btn" onClick={handleClose}>
                            취소
                        </button>
                        <button className="btn btn-primary" onClick={handleClone}>
                            {busy ? "복제 중…" : "복제하기"}
                        </button>
                    </>
                ) : (
                    <>
                        <button className="btn btn-ghost" onClick={handleOpenCollaborators}>
                            협업자 관리 열기
                        </button>
                        <div style={{ flexGrow: 1 }} />
                        <button className="btn btn-primary" onClick={handleClose}>
                            완료
                        </button>
                    </>
                )
            }
        >
            {!successRepo && (
                <>
                    <label className="input-label">
                        원본 저장소
                        <div className="input" style={{ backgroundColor: "var(--bg-inset)", display: "flex", flexDirection: "column", gap: 6, cursor: "default" }}>
                            <div style={{ fontWeight: 600 }}>{sourceLabel}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 12, color: "var(--muted)" }}>ID:</span>
                                <CopyableId value={sourceRepoId} copyLabel="원본 저장소 ID" />
                            </div>
                        </div>
                    </label>

                    <label className="input-label">
                        새 저장소 이름
                        <input
                            className="input"
                            placeholder="새 저장소의 이름을 입력하세요."
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </label>

                    <label className="input-label">
                        기본 가지 이름
                        <input
                            className="input"
                            placeholder="예: main"
                            value={defaultBranch}
                            onChange={(e) => setDefaultBranch(e.target.value)}
                        />
                    </label>

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
                        <CopyableId value={successRepoId} copyLabel="새 저장소 ID" />
                    </div>
                    <div>기본 가지: <strong>{successRepo.defaultBranch || "main"}</strong></div>
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

            <ErrorText>{error}</ErrorText>
        </Modal>
    );
}