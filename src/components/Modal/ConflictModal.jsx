import React, { useState, useEffect } from "react";
import { useGit } from "../../features/GitCore/GitContext.jsx";
import { api } from "../../features/API.js";

/** 아주 가벼운 markdown-lite 렌더 (번호/불릿/제목/볼드/줄바꿈) */
function mdLite(text = "") {
    const esc = (s) =>
        s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
    const lines = esc(text).split(/\r?\n/);

    const out = [];
    let inUl = false, inOl = false;

    const flush = () => {
        if (inUl) { out.push("</ul>"); inUl = false; }
        if (inOl) { out.push("</ol>"); inOl = false; }
    };

    for (const raw of lines) {
        const line = raw.trim();

        // 제목 (#, ##, ###)
        const h = line.match(/^(#{1,3})\s+(.*)$/);
        if (h) { flush(); out.push(`<h${h[1].length}>${h[2]}</h${h[1].length}>`); continue; }

        // 번호 목록: "1. " 또는 "1) "
        if (/^\d+[.)]\s+/.test(line)) {
            if (!inOl) { flush(); out.push("<ol>"); inOl = true; }
            out.push(`<li>${line.replace(/^\d+[.)]\s+/, "")}</li>`);
            continue;
        }

        // 불릿 목록: "- " 또는 "* "
        if (/^[-*]\s+/.test(line)) {
            if (!inUl) { flush(); out.push("<ul>"); inUl = true; }
            out.push(`<li>${line.replace(/^[-*]\s+/, "")}</li>`);
            continue;
        }

        // 빈 줄 → 단락 구분
        if (line === "") { flush(); out.push("<br/>"); continue; }

        // **bold**
        const bold = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        out.push(`<p>${bold}</p>`);
    }
    flush();
    return out.join("\n");
}

export default function ConflictModal() {
    const { state, dispatch } = useGit();
    const open = state.conflictInfo?.open || false;
    const repoId = state.selectedRepoId;

    const [status, setStatus] = useState("loadingList");
    const [error, setError] = useState("");
    const [conflicts, setConflicts] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [suggestion, setSuggestion] = useState(null);

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

    const normalizeConflictFiles = (payload) => {
        const candidates = [payload?.conflicts, payload?.conflictFiles, payload?.files].find(Array.isArray);
        return Array.isArray(candidates) ? candidates : [];
    };

    const fetchConflictList = async () => {
        try {
            setStatus("loadingList");
            setError("");

            const conflictData = await api.repos.conflicts(repoId);
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
            setError(e?.message || "충돌 정보를 가져오는 데 실패했습니다.");
            setStatus("error");
        }
    };

    const handleFileSelect = async (filePath) => {
        setSelectedFile(filePath);
        setSuggestion(null);
        setStatus("loadingSuggestion");
        setError("");
        setShowFullExpl(false);
        try {
            const aiData = await api.repos.aiSuggest(repoId, filePath);
            setSuggestion(aiData);
            setStatus("suggestionReady");
        } catch (e) {
            setError(`'${filePath}' 파일 분석 중 오류: ${e?.message || e}`);
            setStatus("fileSelection");
        }
    };

    const handleResolve = async () => {
        if (!suggestion || !selectedFile) return;
        setStatus("resolving");
        setError("");
        try {
            await api.repos.resolve(repoId, {
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
            setError(e?.message || "충돌 해결에 실패했습니다.");
            setStatus("suggestionReady");
        }
    };

    const handleFinalizeMerge = async () => {
        try {
            await api.repos.commit(repoId, mergeMessage || "Merge");
            dispatch({ type: "GRAPH_DIRTY" });
            dispatch({ type: "CLOSE_CONFLICT_MODAL" });
        } catch (e) {
            setError(e?.message || "병합 마무리 커밋에 실패했습니다.");
            setStatus("readyToCommit");
        }
    };

    const handleAbortMerge = async () => {
        if (!window.confirm("병합 작업을 중단하고 이전 상태로 되돌리시겠습니까?")) return;
        setStatus("aborting");
        setError("");
        try {
            await api.repos.abortMerge(repoId);
            dispatch({ type: "GRAPH_DIRTY" });
            dispatch({ type: "CLOSE_CONFLICT_MODAL" });
        } catch (e) {
            setError(e?.message || "병합 중단에 실패했습니다.");
            setStatus("error");
        }
    };

    const handleClose = () => {
        if (status !== "resolving" && status !== "aborting") {
            dispatch({ type: "CLOSE_CONFLICT_MODAL" });
        }
    };

    if (!open) return null;

    return (
        <div className="modal-backdrop" onClick={handleClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: "min(920px, 92vw)" }}>
                <div className="modal-head">
                    <h4>🚨 병합 충돌 발생! (AI 해결사)</h4>
                    <button className="modal-close" onClick={handleClose}>×</button>
                </div>

                <div className="modal-body">
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
                                <strong>병합 준비 완료</strong><br />
                                충돌이 모두 해결되었고 <code>MERGE_HEAD</code> 상태입니다. 병합을 <strong>마무리 커밋</strong>으로 완료하세요.
                            </div>
                            <label style={{ fontSize: 12, color: "var(--sub)" }}>커밋 메시지</label>
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
                                        disabled={status === "loadingSuggestion" || status === "resolving" || status === "aborting"}
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
                </div>

                <div className="modal-actions">
                    <button
                        className="btn"
                        onClick={handleAbortMerge}
                        disabled={status === "resolving" || status === "aborting"}
                        style={{ marginRight: "auto" }}
                    >
                        {status === "aborting" ? "중단 중..." : "병합 중단"}
                    </button>

                    <button className="btn" onClick={handleClose}>나중에 해결</button>

                    {status === "readyToCommit" ? (
                        <button className="btn btn-primary" onClick={handleFinalizeMerge}>병합 마무리 커밋</button>
                    ) : (
                        <button
                            className="btn btn-success"
                            onClick={handleResolve}
                            disabled={status !== "suggestionReady" || status === "resolving" || status === "aborting"}
                        >
                            {status === "resolving" ? "적용 중..." : "이 제안 적용하기"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
