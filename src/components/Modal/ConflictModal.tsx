import { useState, useEffect } from "react";
import { useGit } from "../../features/GitCore/GitContext";
import { api, errorMessage } from "../../lib/api";
import { mdLite } from "../../lib/markdown";
import type { ConflictSuggestion } from "../../types/api";
import Modal from "./Modal";

type ConflictStatus =
    | "loadingList"
    | "error"
    | "fileSelection"
    | "loadingSuggestion"
    | "suggestionReady"
    | "resolving"
    | "readyToCommit"
    | "aborting";

// 서버가 해결본을 suggestion 필드로 내려주는 버전 대응
type Suggestion = ConflictSuggestion & { suggestion?: string };

// conflicts 응답은 버전에 따라 필드명이 다르다
interface ConflictListPayload {
    conflicts?: unknown;
    conflictFiles?: unknown;
    files?: unknown;
    hasConflict?: boolean;
}

export default function ConflictModal() {
    const { state, dispatch } = useGit();
    const open = state.conflictInfo?.open || false;
    const repoId = state.selectedRepoId;

    const [status, setStatus] = useState<ConflictStatus>("loadingList");
    const [error, setError] = useState("");
    const [conflicts, setConflicts] = useState<string[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

    // 가독/UX
    const [showFullExpl, setShowFullExpl] = useState(false);
    const [mergeMessage, setMergeMessage] = useState("Merge: resolve conflicts");

    useEffect(() => {
        if (open && repoId) {
            fetchConflictList();
        } else {
            setStatus("loadingList");
            setError("");
            setConflicts([]);
            setSuggestion(null);
            setSelectedFile(null);
            setShowFullExpl(false);
            setMergeMessage("Merge: resolve conflicts");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, repoId]);

    const normalizeConflictFiles = (payload: ConflictListPayload | null): string[] => {
        const candidates = [payload?.conflicts, payload?.conflictFiles, payload?.files].find(Array.isArray);
        return Array.isArray(candidates) ? candidates.filter((f): f is string => typeof f === "string") : [];
    };

    const fetchConflictList = async () => {
        if (!repoId) return;
        try {
            setStatus("loadingList");
            setError("");

            const conflictData = (await api.repos.conflicts(repoId)) as ConflictListPayload | null;
            const conflictFiles = normalizeConflictFiles(conflictData);
            const hasConflict = Boolean(conflictData?.hasConflict || conflictFiles.length > 0);

            // 병합 진행 중 여부 확인
            let merging = false;
            try {
                const st = await api.repos.status(repoId);
                merging = Boolean(st?.merging || st?.isMerging || st?.mergeHead || st?.mergeInProgress);
            } catch {
                // 상태 조회 실패 시에는 넘어감
            }

            setConflicts(conflictFiles);

            if (hasConflict) {
                setStatus("fileSelection");
            } else {
                if (merging) {
                    // 충돌은 없지만 MERGE_HEAD 상태 → 마무리 커밋 단계
                    setStatus("readyToCommit");
                } else {
                    dispatch({ type: "CLOSE_CONFLICT_MODAL" });
                }
            }
        } catch (e) {
            setError(errorMessage(e, "충돌 정보를 가져오는 데 실패했습니다."));
            setStatus("error");
        }
    };

    const handleFileSelect = async (filePath: string) => {
        if (!repoId) return;
        setSelectedFile(filePath);
        setSuggestion(null);
        setStatus("loadingSuggestion");
        setError("");
        setShowFullExpl(false);
        try {
            const aiData: Suggestion = await api.repos.suggestConflictResolution(repoId, filePath);
            setSuggestion(aiData);
            setStatus("suggestionReady");
        } catch (e) {
            setError(`'${filePath}' 파일 분석 중 오류: ${errorMessage(e, String(e))}`);
            setStatus("fileSelection");
        }
    };

    const handleResolve = async () => {
        if (!repoId || !suggestion || !selectedFile) return;
        setStatus("resolving");
        setError("");
        try {
            await api.repos.resolveConflict(repoId, {
                filePath: selectedFile,
                resolution: "manual",
                manualContent: suggestion.suggestion,
            });
            // 적용 후 최신 충돌 상태 확인
            setSelectedFile(null);
            setSuggestion(null);
            setShowFullExpl(false);
            await fetchConflictList();
            dispatch({ type: "GRAPH_DIRTY" });
        } catch (e) {
            setError(errorMessage(e, "충돌 해결에 실패했습니다."));
            setStatus("suggestionReady");
        }
    };

    const handleFinalizeMerge = async () => {
        if (!repoId) return;
        try {
            await api.repos.commit(repoId, mergeMessage || "Merge");
            dispatch({ type: "GRAPH_DIRTY" });
            dispatch({ type: "CLOSE_CONFLICT_MODAL" });
        } catch (e) {
            setError(errorMessage(e, "합치기 마무리 저장에 실패했습니다."));
            setStatus("readyToCommit");
        }
    };

    const handleAbortMerge = async () => {
        if (!repoId || !window.confirm("합치기 작업을 중단하고 이전 상태로 되돌리시겠습니까?")) return;
        setStatus("aborting");
        setError("");
        try {
            await api.repos.abortMerge(repoId);
            dispatch({ type: "GRAPH_DIRTY" });
            dispatch({ type: "CLOSE_CONFLICT_MODAL" });
        } catch (e) {
            setError(errorMessage(e, "합치기 중단에 실패했습니다."));
            setStatus("error");
        }
    };

    // 적용·중단 처리 중에는 닫지 않는다
    const closing = status === "resolving" || status === "aborting";
    const handleClose = () => {
        if (!closing) dispatch({ type: "CLOSE_CONFLICT_MODAL" });
    };

    return (
        <Modal
            open={open}
            title="🚨 합치기 충돌 발생! (AI 해결사)"
            onClose={handleClose}
            busy={closing}
            width="min(920px, 92vw)"
            footer={
                <>
                    <button
                        className="btn"
                        onClick={handleAbortMerge}
                        style={{ marginRight: "auto" }}
                    >
                        {status === "aborting" ? "중단 중..." : "합치기 중단"}
                    </button>

                    <button className="btn" onClick={handleClose}>나중에 해결</button>

                    {status === "readyToCommit" ? (
                        <button className="btn btn-primary" onClick={handleFinalizeMerge}>합치기 마무리 저장</button>
                    ) : (
                        <button
                            className="btn btn-success"
                            onClick={handleResolve}
                        >
                            {status === "resolving" ? "적용 중..." : "이 제안 적용하기"}
                        </button>
                    )}
                </>
            }
        >
            {status === "loadingList" && (
                <div style={{ minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    <div className="spinner" /> 충돌 파일 목록을 불러오는 중...
                </div>
            )}

            {status === "error" && (
                <div style={{ color: "var(--danger)", minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {error}
                </div>
            )}

            {status === "readyToCommit" && (
                <div style={{ display: "grid", gap: 12 }}>
                    <div className="ai-chat-bubble ai-md">
                        <strong>합치기 준비 완료</strong><br />
                        충돌이 모두 해결되었고 <code>MERGE_HEAD</code> 상태입니다. 합치기를 <strong>마무리 저장</strong>으로 완료하세요.
                    </div>
                    <label style={{ fontSize: 12, color: "var(--sub)" }}>저장 메시지</label>
                    <input
                        className="input"
                        value={mergeMessage}
                        onChange={(e) => setMergeMessage(e.target.value)}
                        placeholder="Merge branch ..."
                    />
                </div>
            )}

            {status !== "loadingList" && status !== "error" && status !== "readyToCommit" && (
                <div className="conflict-solver-layout">
                    <div className="conflict-file-list">
                        <h5 className="conflict-title">충돌 파일 ({conflicts.length})</h5>
                        {conflicts.map((file) => (
                            <button
                                key={file}
                                className={`conflict-file-item ${file === selectedFile ? "active" : ""}`}
                                onClick={() => handleFileSelect(file)}
                                title={file}
                            >
                                {file}
                            </button>
                        ))}
                        {conflicts.length === 0 && (
                            <div className="empty" style={{ padding: "16px 0", color: "var(--muted)" }}>
                                파일 목록이 비어 있습니다.
                            </div>
                        )}
                    </div>

                    <div className="ai-suggestion-area">
                        <h5 className="conflict-title">AI 해결 제안</h5>

                        {status === "fileSelection" && (
                            <div className="empty" style={{ padding: "40px 0" }}>
                                왼쪽 목록에서 파일을 선택하면<br /> AI가 해결책을 제안합니다.
                            </div>
                        )}

                        {status === "loadingSuggestion" && (
                            <div style={{ minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                                <div className="spinner" /> <strong>{selectedFile}</strong> 분석 중...
                            </div>
                        )}

                        {status === "suggestionReady" && suggestion && (
                            <>
                                <div className="ai-chat-bubble ai-md">
                                    <div className="ai-expl-toolbar" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                        <div>🤖 <strong>AI</strong> (신뢰도: {Math.round((suggestion.confidence || 0) * 100)}%)</div>
                                        <button
                                            type="button"
                                            className="ai-expl-toggle"
                                            onClick={() => setShowFullExpl((v) => !v)}
                                            style={{
                                                marginLeft: "auto",
                                                border: "1px solid #dfe4ff",
                                                background: "#fff",
                                                color: "#3643a5",
                                                padding: "4px 8px",
                                                borderRadius: 999,
                                                cursor: "pointer",
                                                fontWeight: 700,
                                                fontSize: 12,
                                            }}
                                        >
                                            {showFullExpl ? "접기" : "펼치기"}
                                        </button>
                                    </div>

                                    <div
                                        className="ai-md"
                                        dangerouslySetInnerHTML={{
                                            __html: mdLite(
                                                showFullExpl
                                                    ? (suggestion.explanation || "설명이 없습니다.")
                                                    : (suggestion.explanation || "설명이 없습니다.").slice(0, 420) +
                                                    ((suggestion.explanation || "").length > 420 ? " …" : "")
                                            ),
                                        }}
                                    />
                                </div>

                                <pre className="pr-diff">
                                    <code>{suggestion.suggestion || "제안 내용이 없습니다."}</code>
                                </pre>
                            </>
                        )}
                    </div>
                </div>
            )}
        </Modal>
    );
}
