import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../features/API";

const INITIAL_MESSAGES = [
    {
        role: "assistant",
        content: "안녕하세요! 🤖 무엇을 도와드릴까요? 작업 중 궁금한 점을 편하게 물어보세요.",
    },
];

export default function AIChatAssistantModal({ open, onClose, repoId }) {
    const [messages, setMessages] = useState(INITIAL_MESSAGES);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const messagesRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (open) {
            setMessages(INITIAL_MESSAGES);
            setInput("");
        }
    }, [open]);

    useEffect(() => {
        if (messagesRef.current) {
            messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
        }
    }, [messages, open]);

    const placeholder = useMemo(
        () => "예: \"브랜치가 뭔가요?\" 또는 \"지금 무엇을 해야 하나요?\"",
        [],
    );

    const handleSend = async (text = null) => {
        const trimmed = (text !== null ? text : input.trim()) || "";
        if (busy || !trimmed || !repoId) return;

        const userMessage = { role: "user", content: trimmed };
        setMessages((prev) => [...prev, userMessage]);
        // 입력창을 즉시 비우기 위해 ref를 통해 직접 설정
        if (inputRef.current) {
            inputRef.current.value = "";
        }
        setInput("");
        setBusy(true);

        try {
            const response = await api.aiAssistant.ask(repoId, trimmed);
            
            // 응답 검증 및 안전한 처리
            const answer = (response && response.answer && typeof response.answer === 'string') 
                ? response.answer 
                : "답변을 생성하는 중 오류가 발생했습니다.";
            const suggestedActions = Array.isArray(response?.suggestedActions) 
                ? response.suggestedActions 
                : [];
            const relatedConcepts = Array.isArray(response?.relatedConcepts) 
                ? response.relatedConcepts 
                : [];
            
            const assistantMessage = { 
                role: "assistant", 
                content: answer,
                suggestedActions: suggestedActions,
                relatedConcepts: relatedConcepts
            };
            setMessages((prev) => [...prev, assistantMessage]);
        } catch (error) {
            console.error("[AIChatAssistantModal] API 호출 실패:", error);
            const errorMessage = { 
                role: "assistant", 
                content: `죄송합니다. 오류가 발생했습니다: ${error?.message || "알 수 없는 오류"}` 
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setBusy(false);
        }
    };

    const handleKeyDown = (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.stopPropagation();
            if (!busy && input.trim()) {
                const textToSend = input.trim();
                // 입력창을 즉시 비우기 위해 ref를 통해 직접 설정
                if (inputRef.current) {
                    inputRef.current.value = "";
                }
                setInput("");
                handleSend(textToSend);
            }
        }
    };

    if (!open) return null;

    return (
        <div className="modal-backdrop" onClick={busy ? (e) => { e.preventDefault(); e.stopPropagation(); } : onClose}>
            <div className="modal" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 520 }}>
                <div className="modal-head">
                    <h4>AI 작업 도우미</h4>
                    <button className="modal-close" onClick={busy ? (e) => { e.preventDefault(); e.stopPropagation(); } : onClose} disabled={busy}>×</button>
                </div>
                <div className="modal-body" style={{ display: "grid", gap: 12 }}>
                    <div className="ai-chat-messages" ref={messagesRef}>
                        {messages.filter(msg => msg && msg.role).map((message, index) => (
                            <div
                                key={`${message.role}-${index}`}
                                className={`ai-chat-message ${message.role === "user" ? "from-user" : "from-assistant"}`}
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    width: "100%",
                                    maxWidth: "100%"
                                }}
                            >
                                <div style={{ 
                                    whiteSpace: "pre-wrap", 
                                    wordBreak: "break-word",
                                    wordWrap: "break-word",
                                    lineHeight: "1.6",
                                    width: "100%",
                                    overflowWrap: "break-word"
                                }}>
                                    {message.content || ""}
                                </div>
                                {message.role === "assistant" && (
                                    <>
                                        {message.suggestedActions && Array.isArray(message.suggestedActions) && message.suggestedActions.length > 0 && (
                                            <div style={{ 
                                                marginTop: "16px", 
                                                paddingTop: "16px", 
                                                borderTop: "1px solid rgba(0,0,0,0.1)",
                                                width: "100%"
                                            }}>
                                                <div style={{ 
                                                    fontSize: "13px", 
                                                    fontWeight: "600",
                                                    marginBottom: "10px",
                                                    color: "var(--text, #333)"
                                                }}>
                                                    💡 추천 작업
                                                </div>
                                                <div style={{ 
                                                    display: "flex", 
                                                    flexDirection: "column",
                                                    gap: "8px",
                                                    width: "100%"
                                                }}>
                                                    {message.suggestedActions.filter(action => action).map((action, idx) => {
                                                        const actionText = typeof action === 'string' ? action : String(action);
                                                        return (
                                                            <div 
                                                                key={idx}
                                                                style={{
                                                                    background: "rgba(59, 130, 246, 0.15)",
                                                                    border: "1px solid rgba(59, 130, 246, 0.3)",
                                                                    padding: "10px 12px",
                                                                    borderRadius: "6px",
                                                                    fontSize: "13px",
                                                                    color: "var(--text, #333)",
                                                                    transition: "all 0.2s",
                                                                    cursor: busy ? "not-allowed" : "pointer",
                                                                    opacity: busy ? 0.6 : 1
                                                                }}
                                                                onClick={() => {
                                                                    if (!busy && actionText) {
                                                                        handleSend(actionText);
                                                                    }
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    if (!busy) {
                                                                        e.currentTarget.style.background = "rgba(59, 130, 246, 0.25)";
                                                                        e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.5)";
                                                                        e.currentTarget.style.transform = "translateY(-1px)";
                                                                    }
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    e.currentTarget.style.background = "rgba(59, 130, 246, 0.15)";
                                                                    e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.3)";
                                                                    e.currentTarget.style.transform = "translateY(0)";
                                                                }}
                                                            >
                                                                {idx + 1}. {actionText}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                        {message.relatedConcepts && Array.isArray(message.relatedConcepts) && message.relatedConcepts.length > 0 && (
                                            <div style={{ 
                                                marginTop: "16px",
                                                paddingTop: "16px",
                                                borderTop: message.suggestedActions && Array.isArray(message.suggestedActions) && message.suggestedActions.length > 0 
                                                    ? "1px solid rgba(0,0,0,0.1)" 
                                                    : "none",
                                                width: "100%"
                                            }}>
                                                <div style={{ 
                                                    fontSize: "12px", 
                                                    fontWeight: "500",
                                                    marginBottom: "8px",
                                                    color: "var(--text, #333)"
                                                }}>
                                                    📚 관련 개념
                                                </div>
                                                <div style={{ 
                                                    display: "flex", 
                                                    flexWrap: "wrap", 
                                                    gap: "6px",
                                                    width: "100%"
                                                }}>
                                                    {message.relatedConcepts.filter(concept => concept).map((concept, idx) => (
                                                        <span 
                                                            key={idx}
                                                            style={{
                                                                background: "rgba(0,0,0,0.05)",
                                                                border: "1px solid rgba(0,0,0,0.1)",
                                                                padding: "6px 10px",
                                                                borderRadius: "4px",
                                                                fontSize: "12px",
                                                                color: "var(--text, #333)"
                                                            }}
                                                            >
                                                            {typeof concept === 'string' ? concept : String(concept)}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="ai-chat-input-area">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder}
                        />
                        <div className="ai-chat-input-actions">
                            <button className="btn" onClick={busy ? (e) => { e.preventDefault(); e.stopPropagation(); } : onClose} disabled={busy}>닫기</button>
                            <button className="btn btn-primary" onClick={handleSend}>
                                {busy ? "생각 중..." : "보내기"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
