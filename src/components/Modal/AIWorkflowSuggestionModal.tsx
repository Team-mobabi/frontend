import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from "react";
import Modal from "./Modal";
import { api } from "../../lib/api";
import { createLogger } from "../../lib/logger";
import type { Id } from "../../types/api";
import type { WorkflowStep } from "../../types/git";
import { isOnlySaveRequest, isWorkflowStep, normalizeSteps, parseStepsFromActions, STEP_ICONS, SUGGESTION_STEP_LABELS } from "../../features/Workflow/workflowSteps";
import {
    analyzeWorkflow,
    branchMessageOf,
    buildWorkflowMessage,
    type LocalWorkflow,
    type SuggestedStep,
} from "../../features/Workflow/workflowSuggestion";

const log = createLogger("AIWorkflowSuggestionModal");

type Category = "save_and_share" | "code_review" | "sync" | "branch_management" | "conflict_resolution" | "full";

interface QuickOption {
    text: string;
    category?: Category;
    workflow?: SuggestedStep[];
}

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    quickOptions?: QuickOption[];
    workflow?: LocalWorkflow;
    isLoading?: boolean;
}

// 대분류 작업 옵션
const MAIN_CATEGORIES: QuickOption[] = [
    { text: "변경사항을 저장하고 공유하고 싶어요", category: "save_and_share" },
    { text: "코드 리뷰를 받고 싶어요", category: "code_review" },
    { text: "서버에서 최신 내용을 가져오고 싶어요", category: "sync" },
    { text: "브랜치를 관리하고 싶어요", category: "branch_management" },
    { text: "충돌을 해결하고 싶어요", category: "conflict_resolution" },
    { text: "전체 워크플로우를 진행하고 싶어요", category: "full" },
];

// 카테고리별 세부 질문
const CATEGORY_QUESTIONS: Record<Category, QuickOption[]> = {
    save_and_share: [
        { text: "변경사항만 저장하고 싶어요", workflow: ["add", "commit"] },
        { text: "저장하고 서버에 올리고 싶어요", workflow: ["add", "commit", "push"] },
    ],
    code_review: [
        { text: "협업하기를 만들고 싶어요", workflow: ["add", "commit", "push", "pr"] },
        { text: "새 브랜치를 만들어서 협업하기를 만들고 싶어요", workflow: ["add", "commit", "push", "pr"] },
    ],
    sync: [
        { text: "서버에서 최신 내용만 가져오고 싶어요", workflow: ["pull"] },
        { text: "가져오고 내 변경사항도 올리고 싶어요", workflow: ["pull", "add", "commit", "push"] },
    ],
    branch_management: [
        { text: "새 브랜치를 만들고 싶어요", workflow: ["branch_create"] },
        { text: "브랜치를 전환하고 싶어요", workflow: ["branch_switch"] },
        { text: "브랜치를 병합하고 싶어요", workflow: ["branch_merge"] },
        { text: "브랜치를 삭제하고 싶어요", workflow: ["branch_delete"] },
    ],
    conflict_resolution: [
        { text: "충돌이 발생했어요. 해결하고 싶어요", workflow: [] },
        { text: "충돌 해결 후 다시 올리고 싶어요", workflow: ["add", "commit", "push"] },
    ],
    full: [
        { text: "처음부터 끝까지 모든 단계를 진행하고 싶어요", workflow: ["pull", "add", "commit", "push"] },
    ],
};

const INITIAL_MESSAGES: ChatMessage[] = [
    {
        role: "assistant",
        content: "안녕하세요! 🤖 어떤 작업을 하시려고 하시나요?",
        quickOptions: MAIN_CATEGORIES,
    },
];

const PLACEHOLDER = "예: \"변경사항을 커밋하고 푸시하고 싶어요\"";
const NO_ANSWER = "답변을 생성하는 중 문제가 발생했습니다.";
const NEED_DETAIL = "어떤 작업을 하시려는지 좀 더 구체적으로 알려주시면 더 정확한 워크플로우를 추천해드릴 수 있어요.";
const AI_UNAVAILABLE = "죄송합니다. AI 서비스에 일시적인 문제가 발생했습니다. 다시 시도해주세요.";

interface AIWorkflowSuggestionModalProps {
    open: boolean;
    onClose: () => void;
    onWorkflowSuggested: (steps: WorkflowStep[]) => void;
    repoId: Id | null;
    stagingArea?: string[];
}

export default function AIWorkflowSuggestionModal({ open, onClose, onWorkflowSuggested, repoId, stagingArea = [] }: AIWorkflowSuggestionModalProps) {
    const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [suggestedWorkflow, setSuggestedWorkflow] = useState<LocalWorkflow | null>(null);
    const messagesRef = useRef<HTMLDivElement>(null);

    const hasStaged = stagingArea.length > 0;

    const addAssistant = (content: string, workflow?: LocalWorkflow) =>
        setMessages((prev) => [...prev, workflow ? { role: "assistant", content, workflow } : { role: "assistant", content }]);
    const dropLoading = () => setMessages((prev) => prev.filter((msg) => !msg.isLoading));

    // 추천 워크플로우를 저장하고 안내 메시지를 추가한다 (보여줄 단계가 없으면 fallback 문구만)
    const showWorkflow = (workflow: LocalWorkflow, content: string | null, fallback: string) => {
        setSuggestedWorkflow(workflow);
        if (content) addAssistant(content, workflow);
        else addAssistant(fallback);
    };

    useEffect(() => {
        if (!open || !repoId) return;
        setMessages(INITIAL_MESSAGES);
        setInput("");
        setSuggestedWorkflow(null);
        setBusy(true);

        // 모달이 열릴 때 자동으로 다음 할 일 제안 받기
        api.aiAssistant
            .suggestNext(repoId)
            .then((response) => {
                if (!response?.success) return;
                const aiAnswer = typeof response.answer === "string" ? response.answer : "";
                const actionSteps = parseStepsFromActions(Array.isArray(response.suggestedActions) ? response.suggestedActions : []);
                if (actionSteps.length === 0) {
                    addAssistant(aiAnswer || NO_ANSWER); // 워크플로우가 없어도 AI 답변은 표시
                    return;
                }
                // 현재 상태(이미 담긴 파일 여부)를 고려하여 워크플로우 조정
                const workflow: LocalWorkflow = { steps: normalizeSteps(actionSteps, { hasStaged }), suggestions: [] };
                showWorkflow(workflow, buildWorkflowMessage(workflow.steps, { prefix: aiAnswer }), aiAnswer || NO_ANSWER);
            })
            .catch((error) => {
                // 에러 발생 시 기본 메시지만 표시
                log.error("다음 할 일 제안 실패:", error);
            })
            .finally(() => setBusy(false));
    }, [open, repoId]);

    useEffect(() => {
        if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }, [messages, open]);

    const handleSend = async (text?: string, workflowSteps?: SuggestedStep[]) => {
        const trimmed = text || input.trim() || "";
        if (busy) return;

        setMessages((prev) => [...prev, { role: "user", content: trimmed }, { role: "assistant", content: "...", isLoading: true }]);
        setInput("");
        setBusy(true);

        try {
            // 브랜치 관련 빠른 선택은 일반 워크플로우가 아니므로 안내만 (API 호출 전에 체크)
            const quickBranchMessage = branchMessageOf(workflowSteps);
            if (quickBranchMessage) {
                dropLoading();
                addAssistant(quickBranchMessage);
                return;
            }

            // repoId가 없으면 API 실패와 동일하게 로컬 분석으로 대체된다
            if (!repoId) throw new Error("저장소가 선택되지 않았습니다.");
            const response = await api.aiAssistant.ask(repoId, trimmed);
            dropLoading();

            if (!response?.success) {
                // API가 실패 응답이면 로컬 키워드 분석 사용
                const local = analyzeWorkflow(trimmed);
                const workflow = { ...local, steps: normalizeSteps(local.steps, { hasStaged }) };
                showWorkflow(workflow, buildWorkflowMessage(workflow.steps, { suggestions: workflow.suggestions }), NEED_DETAIL);
                return;
            }

            const aiAnswer = (typeof response.answer === "string" && response.answer) || NO_ANSWER;
            const actionSteps = parseStepsFromActions(Array.isArray(response.suggestedActions) ? response.suggestedActions : []);

            // AI 제안 > 빠른 선택 버튼 > 로컬 키워드 분석 순으로 워크플로우를 정하고 상태에 맞게 보정
            let workflow: LocalWorkflow;
            if (actionSteps.length > 0) {
                workflow = { steps: normalizeSteps(actionSteps, { hasStaged, onlySave: isOnlySaveRequest(trimmed) }), suggestions: [] };
            } else if (workflowSteps && workflowSteps.length > 0) {
                workflow = { steps: normalizeSteps(workflowSteps, { hasStaged }), suggestions: [] };
            } else {
                const local = analyzeWorkflow(trimmed);
                workflow = { ...local, steps: normalizeSteps(local.steps, { hasStaged }) };
            }

            const branchMessage = branchMessageOf(workflow.steps);
            if (branchMessage) {
                addAssistant(branchMessage);
                return;
            }
            showWorkflow(workflow, buildWorkflowMessage(workflow.steps, { prefix: aiAnswer }), aiAnswer);
        } catch (error) {
            // API 호출 실패 시 로컬 키워드 분석 사용
            log.error("API 호출 실패:", error);
            dropLoading();
            const workflow = analyzeWorkflow(trimmed);
            showWorkflow(workflow, buildWorkflowMessage(workflow.steps, { suggestions: workflow.suggestions }), AI_UNAVAILABLE);
        } finally {
            setBusy(false);
        }
    };

    const handleQuickOption = (option: QuickOption) => {
        if (option.category) {
            // 대분류 선택 - 세부 질문 표시
            const detailMessage: ChatMessage = {
                role: "assistant",
                content: `좋아요! "${option.text}"를 선택하셨네요. 더 구체적으로 알려주세요:`,
                quickOptions: CATEGORY_QUESTIONS[option.category] || [],
            };
            setMessages((prev) => [...prev, { role: "user", content: option.text }, detailMessage]);
        } else {
            // 세부 옵션 선택 - 워크플로우 적용
            handleSend(option.text, option.workflow);
        }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key !== "Enter" || event.shiftKey) return;
        event.preventDefault();
        event.stopPropagation();
        if (!busy && input.trim()) handleSend(input.trim());
    };

    const handleApplyWorkflow = () => {
        if (!suggestedWorkflow || suggestedWorkflow.steps.length === 0) return;
        // 브랜치 단계는 튜토리얼 대상이 아니므로 제외하고 넘긴다
        onWorkflowSuggested(suggestedWorkflow.steps.filter(isWorkflowStep));
        // 상태 업데이트가 완료될 때까지 약간의 지연 후 모달 닫기
        setTimeout(onClose, 100);
    };

    // 이전 메시지로 돌아가기 (첫 워크플로우 제안 메시지와 그 직전 사용자 메시지 제거)
    const handleAskAgain = () => {
        setMessages((prev) => {
            const next = [...prev];
            const workflowIndex = next.findIndex((msg) => msg.workflow && msg.workflow.steps.length > 0);
            if (workflowIndex !== -1) {
                if (workflowIndex >= 1) next.splice(workflowIndex - 1, 2);
                else next.splice(workflowIndex, 1);
            }
            return next;
        });
        setSuggestedWorkflow(null);
    };

    return (
        <Modal
            open={open}
            title="AI 워크플로우 제안"
            onClose={onClose}
            busy={busy}
            width="600px"
            style={{ maxWidth: "90vw" }}
            bodyStyle={{ display: "grid", gap: 12, flex: 1 }}
        >
            <div className="ai-chat-messages" ref={messagesRef}>
                {messages.map((message, index) => {
                    const steps = message.workflow?.steps.filter(isWorkflowStep) ?? [];
                    return (
                        <div key={`${message.role}-${index}`} className="ai-chat-message-wrapper">
                            <div className={`ai-chat-message ${message.role === "user" ? "from-user" : "from-assistant"}`}>
                                {message.isLoading ? (
                                    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                                        <span>생각 중</span>
                                        <span className="typing-dots">
                                            <span>.</span>
                                            <span>.</span>
                                            <span>.</span>
                                        </span>
                                    </div>
                                ) : (
                                    <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>
                                )}
                            </div>
                            {message.quickOptions && (
                                <div className="quick-options-container">
                                    {message.quickOptions.map((option, optIndex) => (
                                        <button key={optIndex} className="quick-option-chip" onClick={() => handleQuickOption(option)}>
                                            {option.text}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {message.workflow && message.workflow.steps.length > 0 && (
                                <div className="workflow-suggestion-box" style={{ marginTop: "12px" }}>
                                    <div className="workflow-steps-visualization">
                                        {steps.map((step, stepIndex) => (
                                            <Fragment key={step}>
                                                <div className="workflow-step-item">
                                                    <div className="workflow-step-number">{stepIndex + 1}</div>
                                                    <div className="workflow-step-icon">{STEP_ICONS[step]}</div>
                                                    <div className="workflow-step-label">{SUGGESTION_STEP_LABELS[step]}</div>
                                                </div>
                                                {stepIndex < steps.length - 1 && <div className="workflow-step-arrow">→</div>}
                                            </Fragment>
                                        ))}
                                    </div>
                                    <div
                                        className="workflow-suggestion-actions"
                                        style={{ marginTop: "12px", display: "flex", gap: "8px", justifyContent: "flex-end" }}
                                    >
                                        <button className="btn btn-ghost" onClick={handleAskAgain} style={{ color: "var(--text-secondary)" }}>
                                            ← 다른 질문하기
                                        </button>
                                        <button className="btn btn-primary" onClick={handleApplyWorkflow}>
                                            이 워크플로우로 진행하기
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="ai-chat-input-area">
                <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKeyDown} placeholder={PLACEHOLDER} />
                <div className="ai-chat-input-actions">
                    <button className="btn" onClick={onClose} disabled={busy}>
                        닫기
                    </button>
                    <button className="btn btn-primary" onClick={() => handleSend()}>
                        {busy ? "생각 중..." : "보내기"}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
