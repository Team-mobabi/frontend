import React, { useEffect, useMemo, useRef, useState } from "react";

const INITIAL_MESSAGES = [
    {
        role: "assistant",
        content: "안녕하세요! 🤖 무엇을 도와드릴까요? 작업 중 궁금한 점을 편하게 물어보세요.",
    },
];

function buildAssistantReply(rawInput) {
    const input = rawInput.toLowerCase();
    const responses = [
        {
            keywords: ["commit", "커밋"],
            message: "커밋을 만들려면 변경한 파일을 먼저 Stage한 다음 메시지를 작성해 저장하세요. 저장 후에는 그래프 탭에서 커밋 노드를 눌러 브랜치 상태를 확인할 수 있어요.",
        },
        {
            keywords: ["push", "푸시"],
            message: "푸시하기 전에 원격과 동기화 되었는지 확인해 주세요. 작업 버튼 영역의 ‘올리기’ 단계를 통해 원격 저장소로 안전하게 전송할 수 있습니다.",
        },
        {
            keywords: ["pull", "가져오기"],
            message: "서버에서 최신 내용을 가져오려면 ‘가져오기’ 단계를 실행하세요. 충돌이 나면 자동으로 충돌 해결 모달이 표시됩니다.",
        },
        {
            keywords: ["branch", "브랜치"],
            message: "브랜치를 생성하거나 전환하려면 브랜치 패널에서 새 브랜치를 만들거나 선택하세요. 그래프 탭에서는 각 브랜치의 병합 상태를 시각적으로 확인 가능합니다.",
        },
        {
            keywords: ["merge", "병합"],
            message: "병합은 그래프 화면에서 브랜치 라벨을 클릭해 시작할 수 있어요. 충돌이 발생하면 제공되는 가이드에 따라 해결한 뒤 다시 병합을 시도하세요.",
        },
        {
            keywords: ["fork", "포크"],
            message: "공개 레포 목록에서 ‘Fork’ 버튼을 누르면 복제본이 내 계정에 생성됩니다. 이후 ‘저장소 복제’ 기능으로 작업공간에 다운로드할 수 있습니다.",
        },
        {
            keywords: ["download", "다운로드", "zip"],
            message: "저장소를 다운로드하면 .git 폴더는 제외된 ZIP 파일로 제공돼요. 레포지토리 화면의 ‘⬇️ 저장소 다운로드’ 버튼을 사용해 보세요.",
        },
        {
            keywords: ["conflict", "충돌"],
            message: "충돌 경고가 뜨면 충돌 해결 모달에서 파일별로 AI 제안과 수동 편집을 활용해 주세요. 해결 후에는 다시 커밋하거나 병합을 진행할 수 있습니다.",
        },
        {
            keywords: ["pull request", "pr", "리뷰"],
            message: "Pull Request는 ‘Pull Requests’ 탭에서 생성할 수 있습니다. 비교할 브랜치를 선택한 후 설명을 적고 생성하면, 목록에서 리뷰와 병합을 진행할 수 있어요.",
        },
    ];

    const matched = responses.find(({ keywords }) =>
        keywords.some((keyword) => input.includes(keyword)),
    );

    if (matched) {
        return matched.message;
    }

    if (input.length < 5) {
        return "조금 더 자세히 어떤 작업을 하시는지 설명해 주실 수 있을까요? 예: “브랜치를 병합하고 싶은데 충돌이 나요.”";
    }

    return "상황을 좀 더 구체적으로 알려주시면 단계별로 도와드릴게요! 예를 들어 “새 브랜치를 만들고 푸시하는 방법 알려줘”처럼 물어보면 더 정확한 안내가 가능합니다.";
}

export default function AIChatAssistantModal({ open, onClose }) {
    const [messages, setMessages] = useState(INITIAL_MESSAGES);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const messagesRef = useRef(null);

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
        () => "예: \"브랜치를 새로 만든 뒤 원격에 올리는 방법 알려줘\"",
        [],
    );

    const handleSend = () => {
        const trimmed = input.trim();
        if (!trimmed || busy) return;

        const userMessage = { role: "user", content: trimmed };
        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setBusy(true);

        window.setTimeout(() => {
            const replyContent = buildAssistantReply(trimmed);
            const assistantMessage = { role: "assistant", content: replyContent };
            setMessages((prev) => [...prev, assistantMessage]);
            setBusy(false);
        }, 220);
    };

    const handleKeyDown = (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handleSend();
        }
    };

    if (!open) return null;

    return (
        <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
            <div className="modal" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 520 }}>
                <div className="modal-head">
                    <h4>AI 작업 도우미</h4>
                    <button className="modal-close" onClick={onClose} disabled={busy}>×</button>
                </div>
                <div className="modal-body" style={{ display: "grid", gap: 12 }}>
                    <div className="ai-chat-messages" ref={messagesRef}>
                        {messages.map((message, index) => (
                            <div
                                key={`${message.role}-${index}`}
                                className={`ai-chat-message ${message.role === "user" ? "from-user" : "from-assistant"}`}
                            >
                                {message.content}
                            </div>
                        ))}
                    </div>
                    <div className="ai-chat-input-area">
                        <textarea
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder}
                            disabled={busy}
                        />
                        <div className="ai-chat-input-actions">
                            <button className="btn" onClick={onClose} disabled={busy}>닫기</button>
                            <button className="btn btn-primary" onClick={handleSend} disabled={busy || !input.trim()}>
                                {busy ? "생각 중..." : "보내기"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
