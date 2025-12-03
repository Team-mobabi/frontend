import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../features/API";

// 대분류 작업 옵션
const MAIN_CATEGORIES = [
    { text: "변경사항을 저장하고 공유하고 싶어요", category: "save_and_share" },
    { text: "코드 리뷰를 받고 싶어요", category: "code_review" },
    { text: "서버에서 최신 내용을 가져오고 싶어요", category: "sync" },
    { text: "브랜치를 관리하고 싶어요", category: "branch_management" },
    { text: "충돌을 해결하고 싶어요", category: "conflict_resolution" },
    { text: "전체 워크플로우를 진행하고 싶어요", category: "full" },
];

// 카테고리별 세부 질문
const CATEGORY_QUESTIONS = {
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

const INITIAL_MESSAGES = [
    {
        role: "assistant",
        content: "안녕하세요! 🤖 어떤 작업을 하시려고 하시나요?",
        quickOptions: MAIN_CATEGORIES,
    },
];

// 워크플로우 단계 타입
const WORKFLOW_STEPS = {
    PULL: "pull",
    ADD: "add",
    COMMIT: "commit",
    PUSH: "push",
    PR: "pr",
};

// 사용자 입력을 분석하여 워크플로우 추천
function analyzeWorkflow(input) {
    const lowerInput = input.toLowerCase();
    const steps = [];
    const suggestions = [];

    // Pull 관련
    if (lowerInput.includes("가져오기") || lowerInput.includes("pull") || 
        lowerInput.includes("동기화") || lowerInput.includes("최신") ||
        lowerInput.includes("서버에서")) {
        steps.push(WORKFLOW_STEPS.PULL);
        suggestions.push("서버에서 최신 내용을 가져오는 것이 좋겠어요.");
    }

    // Add 관련
    if (lowerInput.includes("담기") || lowerInput.includes("add") || 
        lowerInput.includes("스테이징") || lowerInput.includes("파일 선택") ||
        lowerInput.includes("변경된 파일")) {
        steps.push(WORKFLOW_STEPS.ADD);
        suggestions.push("변경된 파일을 스테이징 영역에 담아야 해요.");
    }

    // Commit 관련
    if (lowerInput.includes("저장") || lowerInput.includes("commit") || 
        lowerInput.includes("커밋") || lowerInput.includes("버전 저장")) {
        steps.push(WORKFLOW_STEPS.COMMIT);
        suggestions.push("변경사항을 커밋으로 저장해야 해요.");
    }

    // Push 관련
    if (lowerInput.includes("올리기") || lowerInput.includes("push") || 
        lowerInput.includes("푸시") || lowerInput.includes("서버에 올리") ||
        lowerInput.includes("업로드")) {
        steps.push(WORKFLOW_STEPS.PUSH);
        suggestions.push("커밋을 서버에 올려야 해요.");
    }

    // PR 관련
    if (lowerInput.includes("pr") || lowerInput.includes("pull request") || 
        lowerInput.includes("리뷰") || lowerInput.includes("병합 요청") ||
        lowerInput.includes("코드 리뷰")) {
        steps.push(WORKFLOW_STEPS.PR);
        suggestions.push("협업하기를 만들어서 코드 리뷰를 받는 것이 좋겠어요.");
    }

    // 브랜치 관련 키워드 처리
    if (lowerInput.includes("브랜치") || lowerInput.includes("branch")) {
        if (lowerInput.includes("만들") || lowerInput.includes("생성") || lowerInput.includes("create")) {
            steps.push("branch_create");
            suggestions.push("새 브랜치를 만드는 것이 좋겠어요.");
        } else if (lowerInput.includes("전환") || lowerInput.includes("변경") || lowerInput.includes("switch") || lowerInput.includes("체크아웃") || lowerInput.includes("checkout")) {
            steps.push("branch_switch");
            suggestions.push("브랜치를 전환하는 것이 좋겠어요.");
        } else if (lowerInput.includes("병합") || lowerInput.includes("merge")) {
            steps.push("branch_merge");
            suggestions.push("브랜치를 병합하는 것이 좋겠어요.");
        } else if (lowerInput.includes("삭제") || lowerInput.includes("delete") || lowerInput.includes("파기")) {
            steps.push("branch_delete");
            suggestions.push("브랜치를 삭제하는 것이 좋겠어요.");
        }
    }

    // "만 저장" 또는 "저장만" 패턴 인식 - push 제외
    const isOnlySave = lowerInput.includes("만 저장") || lowerInput.includes("저장만") || 
                       lowerInput.includes("only save") || lowerInput.includes("save only") ||
                       (lowerInput.includes("저장") && (lowerInput.includes("만") || lowerInput.includes("only")) && 
                        !lowerInput.includes("공유") && !lowerInput.includes("올리기") && !lowerInput.includes("push") && !lowerInput.includes("푸시"));
    
    // "저장하고 공유" 같은 패턴 인식 (push 포함)
    const isSaveAndShare = (lowerInput.includes("저장") || lowerInput.includes("save") || lowerInput.includes("커밋") || lowerInput.includes("commit")) && 
                           (lowerInput.includes("공유") || lowerInput.includes("올리기") || lowerInput.includes("push") || lowerInput.includes("푸시"));
    
    if (isSaveAndShare) {
        // 저장하고 공유 = add, commit, push
        if (!steps.includes(WORKFLOW_STEPS.ADD)) {
            steps.push(WORKFLOW_STEPS.ADD);
        }
        if (!steps.includes(WORKFLOW_STEPS.COMMIT)) {
            steps.push(WORKFLOW_STEPS.COMMIT);
        }
        if (!steps.includes(WORKFLOW_STEPS.PUSH)) {
            steps.push(WORKFLOW_STEPS.PUSH);
        }
    } else if (isOnlySave) {
        // "만 저장"이면 push 제외하고 add, commit만
        // 이미 steps에 push가 있으면 제거
        const pushIndex = steps.indexOf(WORKFLOW_STEPS.PUSH);
        if (pushIndex !== -1) {
            steps.splice(pushIndex, 1);
        }
    }
    
    // 기본 워크플로우 추론
    if (steps.length === 0) {
        // 전체 워크플로우 추천
        if (lowerInput.includes("전체") || lowerInput.includes("모든") || 
            lowerInput.includes("처음부터") || lowerInput.includes("처음")) {
            steps.push(WORKFLOW_STEPS.PULL, WORKFLOW_STEPS.ADD, WORKFLOW_STEPS.COMMIT, WORKFLOW_STEPS.PUSH);
            suggestions.push("전체 워크플로우를 진행하시는 것이 좋겠어요: 가져오기 → 파일 담기 → 버전 저장 → 서버에 올리기");
        } else if (lowerInput.includes("변경") || lowerInput.includes("수정")) {
            // "변경사항만 저장"이 아니면 push 포함
            if (!isOnlySave) {
                steps.push(WORKFLOW_STEPS.ADD, WORKFLOW_STEPS.COMMIT, WORKFLOW_STEPS.PUSH);
                suggestions.push("변경사항을 저장하고 올리는 것이 좋겠어요: 파일 담기 → 버전 저장 → 서버에 올리기");
            } else {
                steps.push(WORKFLOW_STEPS.ADD, WORKFLOW_STEPS.COMMIT);
                suggestions.push("변경사항을 저장하는 것이 좋겠어요: 파일 담기 → 버전 저장");
            }
        }
    }

    // 최종 검증: commit이 있으면 반드시 add가 앞에 있어야 함
    const uniqueSteps = [...new Set(steps)];
    if (uniqueSteps.includes(WORKFLOW_STEPS.COMMIT) && !uniqueSteps.includes(WORKFLOW_STEPS.ADD)) {
        const commitIndex = uniqueSteps.indexOf(WORKFLOW_STEPS.COMMIT);
        uniqueSteps.splice(commitIndex, 0, WORKFLOW_STEPS.ADD);
    }

    return { steps: uniqueSteps, suggestions };
}

// 워크플로우 단계 설명
const STEP_DESCRIPTIONS = {
    [WORKFLOW_STEPS.PULL]: "서버에서 최신 내용 가져오기",
    [WORKFLOW_STEPS.ADD]: "변경된 파일 담기",
    [WORKFLOW_STEPS.COMMIT]: "변경 내용 설명 쓰고 저장",
    [WORKFLOW_STEPS.PUSH]: "서버에 올리기",
    [WORKFLOW_STEPS.PR]: "협업하기 만들기",
};

// 워크플로우 단계 아이콘
const STEP_ICONS = {
    [WORKFLOW_STEPS.PULL]: "⬇️",
    [WORKFLOW_STEPS.ADD]: "📦",
    [WORKFLOW_STEPS.COMMIT]: "💾",
    [WORKFLOW_STEPS.PUSH]: "⬆️",
    [WORKFLOW_STEPS.PR]: "🔀",
};

// 워크플로우 단계 상세 설명
const STEP_EXPLANATIONS = {
    [WORKFLOW_STEPS.PULL]: "원격 저장소에서 최신 변경사항을 가져와 로컬과 동기화합니다.",
    [WORKFLOW_STEPS.ADD]: "변경된 파일 중 다음 버전에 포함할 파일을 선택하여 스테이징 영역에 추가합니다.",
    [WORKFLOW_STEPS.COMMIT]: "스테이징된 파일들을 하나의 작업 단위로 묶어 커밋 메시지와 함께 저장합니다.",
    [WORKFLOW_STEPS.PUSH]: "로컬에 저장된 커밋을 원격 저장소에 업로드하여 다른 사람과 공유합니다.",
    [WORKFLOW_STEPS.PR]: "변경사항을 코드 리뷰를 받기 위해 협업하기로 생성합니다.",
};

export default function AIWorkflowSuggestionModal({ 
    open, 
    onClose, 
    onWorkflowSuggested,
    currentStep,
    hasPushableCommits,
    repoId,
    stagingArea = [],
    hasUncommittedChanges = false
}) {
    const [messages, setMessages] = useState(INITIAL_MESSAGES);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [suggestedWorkflow, setSuggestedWorkflow] = useState(null);
    const messagesRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (open && repoId) {
            setMessages(INITIAL_MESSAGES);
            setInput("");
            setSuggestedWorkflow(null);
            setBusy(true);
            
            // 모달이 열릴 때 자동으로 다음 할 일 제안 받기
            api.aiAssistant.suggestNext(repoId)
                .then(response => {
                    if (response && response.success) {
                        const aiAnswer = (response.answer && typeof response.answer === 'string') ? response.answer : "";
                        const suggestedActions = Array.isArray(response.suggestedActions) ? response.suggestedActions : [];
                        
                        // suggestedActions에서 워크플로우 단계 추출 (더 정확한 파싱)
                        const actionSteps = [];
                        suggestedActions.forEach(action => {
                            if (!action || typeof action !== 'string') return;
                            try {
                                const lowerAction = action.toLowerCase();
                                if (lowerAction.includes("가져오기") || lowerAction.includes("pull") || lowerAction.includes("fetch")) {
                                    if (!actionSteps.includes(WORKFLOW_STEPS.PULL)) actionSteps.push(WORKFLOW_STEPS.PULL);
                                }
                                if (lowerAction.includes("담기") || lowerAction.includes("스테이징") || lowerAction.includes("add") || lowerAction.includes("stage")) {
                                    if (!actionSteps.includes(WORKFLOW_STEPS.ADD)) actionSteps.push(WORKFLOW_STEPS.ADD);
                                }
                                if (lowerAction.includes("커밋") || lowerAction.includes("commit") || lowerAction.includes("저장") || lowerAction.includes("save")) {
                                    if (!actionSteps.includes(WORKFLOW_STEPS.COMMIT)) actionSteps.push(WORKFLOW_STEPS.COMMIT);
                                }
                                if (lowerAction.includes("올리기") || lowerAction.includes("push") || lowerAction.includes("푸시") || lowerAction.includes("업로드")) {
                                    if (!actionSteps.includes(WORKFLOW_STEPS.PUSH)) actionSteps.push(WORKFLOW_STEPS.PUSH);
                                }
                                if (lowerAction.includes("pr") || lowerAction.includes("pull request") || lowerAction.includes("리뷰") || lowerAction.includes("review")) {
                                    if (!actionSteps.includes(WORKFLOW_STEPS.PR)) actionSteps.push(WORKFLOW_STEPS.PR);
                                }
                            } catch (e) {
                                console.warn("[AIWorkflowSuggestionModal] 초기 제안 action 파싱 중 에러:", e, action);
                            }
                        });

                        // 현재 상태를 고려하여 워크플로우 조정
                        try {
                            if (actionSteps.length > 0) {
                                // 이미 파일이 스테이징되어 있으면 add 단계 제거
                                let adjustedSteps = actionSteps.filter(step => {
                                    if (step === WORKFLOW_STEPS.ADD && stagingArea && stagingArea.length > 0) {
                                        return false; // 이미 스테이징되어 있으면 add 제거
                                    }
                                    return true;
                                });
                                
                                // commit이 있으면 반드시 add가 앞에 있어야 함 (스테이징된 파일이 없는 경우)
                                if (adjustedSteps.includes(WORKFLOW_STEPS.COMMIT) && 
                                    !adjustedSteps.includes(WORKFLOW_STEPS.ADD) && 
                                    (!stagingArea || stagingArea.length === 0)) {
                                    // commit 앞에 add 추가
                                    const commitIndex = adjustedSteps.indexOf(WORKFLOW_STEPS.COMMIT);
                                    adjustedSteps = [
                                        ...adjustedSteps.slice(0, commitIndex),
                                        WORKFLOW_STEPS.ADD,
                                        ...adjustedSteps.slice(commitIndex)
                                    ];
                                }
                                
                                // 최종 검증: commit이 있으면 반드시 add가 앞에 있어야 함 (스테이징된 파일이 없는 경우)
                                if (adjustedSteps.includes(WORKFLOW_STEPS.COMMIT) && 
                                    !adjustedSteps.includes(WORKFLOW_STEPS.ADD) && 
                                    (!stagingArea || stagingArea.length === 0)) {
                                    const commitIndex = adjustedSteps.indexOf(WORKFLOW_STEPS.COMMIT);
                                    adjustedSteps = [
                                        ...adjustedSteps.slice(0, commitIndex),
                                        WORKFLOW_STEPS.ADD,
                                        ...adjustedSteps.slice(commitIndex)
                                    ];
                                }
                                
                                const workflow = { steps: adjustedSteps, suggestions: [] };
                                setSuggestedWorkflow(workflow);

                                const validSteps = workflow.steps.filter(s => s && STEP_DESCRIPTIONS[s]);
                                if (validSteps.length > 0) {
                                    const stepNames = validSteps.map(step => STEP_DESCRIPTIONS[step]).join(" → ");
                                    let workflowMessage = aiAnswer || "";
                                    workflowMessage += `\n\n🤖 추천 워크플로우: ${stepNames}`;
                                    
                                    const stepDetails = validSteps.map((step, index) => {
                                        const icon = STEP_ICONS[step] || "•";
                                        const desc = STEP_DESCRIPTIONS[step] || step;
                                        const expl = STEP_EXPLANATIONS[step] || "";
                                        return `${index + 1}. ${icon} ${desc}${expl ? `\n   ${expl}` : ""}`;
                                    }).join("\n\n");
                                    
                                    workflowMessage += `\n\n${stepDetails}`;
                                    workflowMessage += `\n\n이 워크플로우를 진행하시겠어요?`;
                                    
                                    const workflowMsg = { 
                                        role: "assistant", 
                                        content: workflowMessage,
                                        workflow: workflow
                                    };
                                    setMessages((prev) => [...prev, workflowMsg]);
                                } else {
                                    // 워크플로우가 없어도 AI 답변은 표시
                                    const assistantMsg = { role: "assistant", content: aiAnswer || "답변을 생성하는 중 문제가 발생했습니다." };
                                    setMessages((prev) => [...prev, assistantMsg]);
                                }
                            } else {
                                // 워크플로우가 없어도 AI 답변은 표시
                                const assistantMsg = { role: "assistant", content: aiAnswer || "답변을 생성하는 중 문제가 발생했습니다." };
                                setMessages((prev) => [...prev, assistantMsg]);
                            }
                        } catch (e) {
                            console.error("[AIWorkflowSuggestionModal] 초기 제안 처리 중 에러:", e);
                            const errorMsg = { 
                                role: "assistant", 
                                content: aiAnswer || "답변을 생성하는 중 문제가 발생했습니다." 
                            };
                            setMessages((prev) => [...prev, errorMsg]);
                        }
                    }
                })
                .catch(error => {
                    console.error("[AIWorkflowSuggestionModal] 다음 할 일 제안 실패:", error);
                    // 에러 발생 시 기본 메시지만 표시
                })
                .finally(() => {
                    setBusy(false);
                });
        }
    }, [open, repoId]);

    useEffect(() => {
        if (messagesRef.current) {
            messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
        }
    }, [messages, open]);

    const placeholder = useMemo(
        () => "예: \"변경사항을 커밋하고 푸시하고 싶어요\"",
        [],
    );

    const handleSend = async (text = null, workflowSteps = null) => {
        const trimmed = text || input.trim() || "";
        if (busy) return;

        const userMessage = { role: "user", content: trimmed };
        setMessages((prev) => [...prev, userMessage]);
        // 입력창을 즉시 비우기 위해 ref를 통해 직접 설정
        if (inputRef.current) {
            inputRef.current.value = "";
        }
        setInput("");
        setBusy(true);

        // 로딩 메시지 추가
        const loadingMessage = { role: "assistant", content: "...", isLoading: true };
        setMessages((prev) => [...prev, loadingMessage]);

        try {
            // 브랜치 관련 워크플로우는 일반 워크플로우가 아니므로 특별 처리 (API 호출 전에 체크)
            if (workflowSteps && workflowSteps.some(s => s.startsWith("branch_"))) {
                // 로딩 메시지 제거
                setMessages((prev) => prev.filter(msg => !msg.isLoading));

                const branchAction = workflowSteps.find(s => s.startsWith("branch_"));
                const actionMessages = {
                    "branch_create": "새 브랜치를 만들 수 있습니다. 상단의 버전 선택 메뉴에서 '+ 새 작업 버전 만들기'를 클릭하세요.",
                    "branch_switch": "브랜치를 전환할 수 있습니다. 상단의 버전 선택 메뉴에서 원하는 브랜치를 선택하세요.",
                    "branch_merge": "브랜치를 병합할 수 있습니다. 그래프 뷰에서 브랜치를 선택하여 병합하세요.",
                    "branch_delete": "브랜치를 삭제할 수 있습니다. 상단의 버전 선택 메뉴에서 삭제할 브랜치 옆의 삭제 버튼을 클릭하세요."
                };
                const assistantMessage = actionMessages[branchAction] || "브랜치 관련 작업을 진행하세요.";
                setMessages((prev) => [...prev, { role: "assistant", content: assistantMessage }]);
                setBusy(false);
                return;
            }

            // 백엔드 API 호출 (빠른 선택 버튼이어도 API 호출)
            let response;
            try {
                response = await api.aiAssistant.ask(repoId, trimmed);
            } catch (apiError) {
                console.error("[AIWorkflowSuggestionModal] API 호출 중 에러:", apiError);
                throw apiError;
            }
            
            // 로딩 메시지 제거
            setMessages((prev) => prev.filter(msg => !msg.isLoading));

            if (response && response.success) {
                // AI 응답 파싱 및 워크플로우 추출
                const aiAnswer = (response.answer && typeof response.answer === 'string') ? response.answer : "";
                const suggestedActions = Array.isArray(response.suggestedActions) ? response.suggestedActions : [];
                const relatedConcepts = Array.isArray(response.relatedConcepts) ? response.relatedConcepts : [];

                // suggestedActions에서 워크플로우 단계 추출 (더 정확한 파싱)
                const actionSteps = [];
                const actionMap = new Map(); // 중복 방지 및 우선순위 관리
                
                suggestedActions.forEach((action, index) => {
                    if (!action || typeof action !== 'string') return;
                    try {
                        const lowerAction = action.toLowerCase();
                        // 우선순위: 더 구체적인 키워드가 먼저 매칭되도록
                        if ((lowerAction.includes("가져오기") || lowerAction.includes("pull") || lowerAction.includes("fetch")) && !actionMap.has("pull")) {
                            actionMap.set("pull", WORKFLOW_STEPS.PULL);
                        }
                        if ((lowerAction.includes("담기") || lowerAction.includes("스테이징") || lowerAction.includes("add") || lowerAction.includes("stage")) && !actionMap.has("add")) {
                            actionMap.set("add", WORKFLOW_STEPS.ADD);
                        }
                        if ((lowerAction.includes("커밋") || lowerAction.includes("commit") || lowerAction.includes("저장") || lowerAction.includes("save")) && !actionMap.has("commit")) {
                            actionMap.set("commit", WORKFLOW_STEPS.COMMIT);
                        }
                        if ((lowerAction.includes("올리기") || lowerAction.includes("push") || lowerAction.includes("푸시") || lowerAction.includes("업로드")) && !actionMap.has("push")) {
                            actionMap.set("push", WORKFLOW_STEPS.PUSH);
                        }
                        if ((lowerAction.includes("pr") || lowerAction.includes("pull request") || lowerAction.includes("리뷰") || lowerAction.includes("review")) && !actionMap.has("pr")) {
                            actionMap.set("pr", WORKFLOW_STEPS.PR);
                        }
                    } catch (e) {
                        console.warn("[AIWorkflowSuggestionModal] action 파싱 중 에러:", e, action);
                    }
                });
                
                // Map에서 순서대로 추출 (suggestedActions의 순서 유지)
                suggestedActions.forEach(action => {
                    if (!action || typeof action !== 'string') return;
                    try {
                        const lowerAction = action.toLowerCase();
                        if (lowerAction.includes("가져오기") || lowerAction.includes("pull") || lowerAction.includes("fetch")) {
                            if (!actionSteps.includes(WORKFLOW_STEPS.PULL)) actionSteps.push(WORKFLOW_STEPS.PULL);
                        }
                        if (lowerAction.includes("담기") || lowerAction.includes("스테이징") || lowerAction.includes("add") || lowerAction.includes("stage")) {
                            if (!actionSteps.includes(WORKFLOW_STEPS.ADD)) actionSteps.push(WORKFLOW_STEPS.ADD);
                        }
                        if (lowerAction.includes("커밋") || lowerAction.includes("commit") || lowerAction.includes("저장") || lowerAction.includes("save")) {
                            if (!actionSteps.includes(WORKFLOW_STEPS.COMMIT)) actionSteps.push(WORKFLOW_STEPS.COMMIT);
                        }
                        if (lowerAction.includes("올리기") || lowerAction.includes("push") || lowerAction.includes("푸시") || lowerAction.includes("업로드")) {
                            if (!actionSteps.includes(WORKFLOW_STEPS.PUSH)) actionSteps.push(WORKFLOW_STEPS.PUSH);
                        }
                        if (lowerAction.includes("pr") || lowerAction.includes("pull request") || lowerAction.includes("리뷰") || lowerAction.includes("review")) {
                            if (!actionSteps.includes(WORKFLOW_STEPS.PR)) actionSteps.push(WORKFLOW_STEPS.PR);
                        }
                    } catch (e) {
                        console.warn("[AIWorkflowSuggestionModal] action 파싱 중 에러:", e, action);
                    }
                });

                // 현재 상태를 고려하여 워크플로우 조정
                let workflow;
                try {
                    if (actionSteps.length > 0) {
                        // "만 저장" 패턴 확인 - push 제외
                        const lowerTrimmed = trimmed.toLowerCase();
                        const isOnlySave = lowerTrimmed.includes("만 저장") || lowerTrimmed.includes("저장만") || 
                                           lowerTrimmed.includes("only save") || lowerTrimmed.includes("save only") ||
                                           (lowerTrimmed.includes("저장") && (lowerTrimmed.includes("만") || lowerTrimmed.includes("only")) && 
                                            !lowerTrimmed.includes("공유") && !lowerTrimmed.includes("올리기") && !lowerTrimmed.includes("push") && !lowerTrimmed.includes("푸시"));
                        
                        // 이미 파일이 스테이징되어 있으면 add 단계 제거
                        let adjustedSteps = actionSteps.filter(step => {
                            if (step === WORKFLOW_STEPS.ADD && stagingArea && stagingArea.length > 0) {
                                return false; // 이미 스테이징되어 있으면 add 제거
                            }
                            return true;
                        });
                        
                        // "만 저장"이면 push 제거
                        if (isOnlySave) {
                            adjustedSteps = adjustedSteps.filter(step => step !== WORKFLOW_STEPS.PUSH);
                        }
                        
                        // commit이 있으면 반드시 add가 앞에 있어야 함 (스테이징된 파일이 없는 경우)
                        if (adjustedSteps.includes(WORKFLOW_STEPS.COMMIT) && 
                            !adjustedSteps.includes(WORKFLOW_STEPS.ADD) && 
                            (!stagingArea || stagingArea.length === 0)) {
                            // commit 앞에 add 추가
                            const commitIndex = adjustedSteps.indexOf(WORKFLOW_STEPS.COMMIT);
                            adjustedSteps = [
                                ...adjustedSteps.slice(0, commitIndex),
                                WORKFLOW_STEPS.ADD,
                                ...adjustedSteps.slice(commitIndex)
                            ];
                        }
                        
                        workflow = { steps: adjustedSteps, suggestions: [] };
                    } else if (workflowSteps && workflowSteps.length > 0) {
                        // 빠른 선택 버튼의 workflowSteps도 상태에 맞게 조정
                        let adjustedSteps = workflowSteps.filter(step => {
                            if (step === "add" && stagingArea && stagingArea.length > 0) {
                                return false; // 이미 스테이징되어 있으면 add 제거
                            }
                            return true;
                        });
                        
                        // commit이 있으면 반드시 add가 앞에 있어야 함 (스테이징된 파일이 없는 경우)
                        if (adjustedSteps.includes("commit") && 
                            !adjustedSteps.includes("add") && 
                            (!stagingArea || stagingArea.length === 0)) {
                            // commit 앞에 add 추가
                            const commitIndex = adjustedSteps.indexOf("commit");
                            adjustedSteps = [
                                ...adjustedSteps.slice(0, commitIndex),
                                "add",
                                ...adjustedSteps.slice(commitIndex)
                            ];
                        }
                        
                        workflow = { steps: adjustedSteps, suggestions: [] };
                    } else {
                        workflow = analyzeWorkflow(trimmed);
                        // analyzeWorkflow 결과도 상태에 맞게 조정
                        if (workflow.steps.includes("add") && stagingArea && stagingArea.length > 0) {
                            workflow.steps = workflow.steps.filter(step => step !== "add");
                        }
                        
                        // commit이 있으면 반드시 add가 앞에 있어야 함 (스테이징된 파일이 없는 경우)
                        if (workflow.steps.includes("commit") && 
                            !workflow.steps.includes("add") && 
                            (!stagingArea || stagingArea.length === 0)) {
                            const commitIndex = workflow.steps.indexOf("commit");
                            workflow.steps = [
                                ...workflow.steps.slice(0, commitIndex),
                                "add",
                                ...workflow.steps.slice(commitIndex)
                            ];
                        }
                    }
                } catch (workflowError) {
                    console.error("[AIWorkflowSuggestionModal] 워크플로우 생성 중 에러:", workflowError);
                    workflow = analyzeWorkflow(trimmed);
                }

                // 브랜치 관련 워크플로우는 일반 워크플로우가 아니므로 특별 처리
                if (workflow && workflow.steps && workflow.steps.length > 0 && workflow.steps.some(s => s.startsWith("branch_"))) {
                    const branchAction = workflow.steps.find(s => s.startsWith("branch_"));
                    const actionMessages = {
                        "branch_create": "새 브랜치를 만들 수 있습니다. 상단의 버전 선택 메뉴에서 '+ 새 작업 버전 만들기'를 클릭하세요.",
                        "branch_switch": "브랜치를 전환할 수 있습니다. 상단의 버전 선택 메뉴에서 원하는 브랜치를 선택하세요.",
                        "branch_merge": "브랜치를 병합할 수 있습니다. 그래프 뷰에서 브랜치를 선택하여 병합하세요.",
                        "branch_delete": "브랜치를 삭제할 수 있습니다. 상단의 버전 선택 메뉴에서 삭제할 브랜치 옆의 삭제 버튼을 클릭하세요."
                    };
                    const assistantMessage = actionMessages[branchAction] || "브랜치 관련 작업을 진행하세요.";
                    setMessages((prev) => [...prev, { role: "assistant", content: assistantMessage }]);
                    setBusy(false);
                    return;
                }

                // 최종 검증: commit이 있으면 반드시 add가 앞에 있어야 함 (스테이징된 파일이 없는 경우)
                if (workflow && workflow.steps && (workflow.steps.includes(WORKFLOW_STEPS.COMMIT) || workflow.steps.includes("commit"))) {
                    const commitStep = workflow.steps.includes(WORKFLOW_STEPS.COMMIT) ? WORKFLOW_STEPS.COMMIT : "commit";
                    const addStep = workflow.steps.includes(WORKFLOW_STEPS.ADD) ? WORKFLOW_STEPS.ADD : "add";
                    
                    if (!workflow.steps.includes(addStep) && (!stagingArea || stagingArea.length === 0)) {
                        // commit 앞에 add 추가
                        const commitIndex = workflow.steps.indexOf(commitStep);
                        workflow.steps = [
                            ...workflow.steps.slice(0, commitIndex),
                            addStep,
                            ...workflow.steps.slice(commitIndex)
                        ];
                    }
                }
                
                // workflow가 유효한지 확인
                if (!workflow || !Array.isArray(workflow.steps)) {
                    workflow = { steps: [], suggestions: [] };
                }
                
                setSuggestedWorkflow(workflow);

                // AI 답변 메시지 구성
                let assistantMessage = aiAnswer || "답변을 생성하는 중 문제가 발생했습니다.";
                
                try {
                    if (workflow.steps.length > 0) {
                        const validSteps = workflow.steps.filter(s => s && STEP_DESCRIPTIONS[s]);
                        if (validSteps.length > 0) {
                            const stepNames = validSteps.map(step => STEP_DESCRIPTIONS[step]).join(" → ");
                            assistantMessage += `\n\n🤖 추천 워크플로우: ${stepNames}`;
                            
                            const stepDetails = validSteps.map((step, index) => {
                                const icon = STEP_ICONS[step] || "•";
                                const desc = STEP_DESCRIPTIONS[step] || step;
                                const expl = STEP_EXPLANATIONS[step] || "";
                                return `${index + 1}. ${icon} ${desc}${expl ? `\n   ${expl}` : ""}`;
                            }).join("\n\n");
                            
                            assistantMessage += `\n\n${stepDetails}`;
                            assistantMessage += `\n\n이 워크플로우를 진행하시겠어요?`;
                            
                            const workflowMsg = { 
                                role: "assistant", 
                                content: assistantMessage,
                                workflow: workflow
                            };
                            setMessages((prev) => [...prev, workflowMsg]);
                        } else {
                            // 워크플로우가 없어도 AI 답변은 표시
                            const assistantMsg = { role: "assistant", content: assistantMessage };
                            setMessages((prev) => [...prev, assistantMsg]);
                        }
                    } else {
                        // 워크플로우가 없어도 AI 답변은 표시
                        const assistantMsg = { role: "assistant", content: assistantMessage };
                        setMessages((prev) => [...prev, assistantMsg]);
                    }
                } catch (messageError) {
                    console.error("[AIWorkflowSuggestionModal] 메시지 생성 중 에러:", messageError);
                    const errorMsg = { 
                        role: "assistant", 
                        content: aiAnswer || "답변을 생성하는 중 문제가 발생했습니다. 다시 시도해주세요." 
                    };
                    setMessages((prev) => [...prev, errorMsg]);
                }
            } else {
                // API 실패 시 기존 로직 사용
                setMessages((prev) => prev.filter(msg => !msg.isLoading));
                let workflow;
                try {
                    workflow = analyzeWorkflow(trimmed);
                } catch (e) {
                    console.error("[AIWorkflowSuggestionModal] 워크플로우 분석 중 에러:", e);
                    workflow = { steps: [], suggestions: [] };
                }
                
                // analyzeWorkflow 결과도 상태에 맞게 조정
                if (workflow.steps.includes(WORKFLOW_STEPS.ADD) && stagingArea && stagingArea.length > 0) {
                    workflow.steps = workflow.steps.filter(step => step !== WORKFLOW_STEPS.ADD);
                }
                
                // commit이 있으면 반드시 add가 앞에 있어야 함 (스테이징된 파일이 없는 경우)
                if (workflow.steps.includes(WORKFLOW_STEPS.COMMIT) && 
                    !workflow.steps.includes(WORKFLOW_STEPS.ADD) && 
                    (!stagingArea || stagingArea.length === 0)) {
                    const commitIndex = workflow.steps.indexOf(WORKFLOW_STEPS.COMMIT);
                    workflow.steps = [
                        ...workflow.steps.slice(0, commitIndex),
                        WORKFLOW_STEPS.ADD,
                        ...workflow.steps.slice(commitIndex)
                    ];
                }
                
                // workflow가 유효한지 확인
                if (!workflow || !Array.isArray(workflow.steps)) {
                    workflow = { steps: [], suggestions: [] };
                }
                
                setSuggestedWorkflow(workflow);

                try {
                    if (workflow.steps.length > 0) {
                        const validSteps = workflow.steps.filter(s => s && STEP_DESCRIPTIONS[s]);
                        if (validSteps.length > 0) {
                            const stepNames = validSteps.map(step => STEP_DESCRIPTIONS[step]).join(" → ");
                            let workflowMessage = `🤖 추천 워크플로우: ${stepNames}`;
                            
                            if (workflow.suggestions && Array.isArray(workflow.suggestions) && workflow.suggestions.length > 0) {
                                workflowMessage += `\n\n${workflow.suggestions.join("\n")}`;
                            }
                            
                            const stepDetails = validSteps.map((step, index) => {
                                const icon = STEP_ICONS[step] || "•";
                                const desc = STEP_DESCRIPTIONS[step] || step;
                                const expl = STEP_EXPLANATIONS[step] || "";
                                return `${index + 1}. ${icon} ${desc}${expl ? `\n   ${expl}` : ""}`;
                            }).join("\n\n");
                            
                            workflowMessage += `\n\n${stepDetails}`;
                            workflowMessage += `\n\n이 워크플로우를 진행하시겠어요?`;
                            
                            const workflowMsg = { 
                                role: "assistant", 
                                content: workflowMessage,
                                workflow: workflow
                            };
                            setMessages((prev) => [...prev, workflowMsg]);
                        } else {
                            const assistantMessage = "어떤 작업을 하시려는지 좀 더 구체적으로 알려주시면 더 정확한 워크플로우를 추천해드릴 수 있어요.";
                            const assistantMsg = { role: "assistant", content: assistantMessage };
                            setMessages((prev) => [...prev, assistantMsg]);
                        }
                    } else {
                        const assistantMessage = "어떤 작업을 하시려는지 좀 더 구체적으로 알려주시면 더 정확한 워크플로우를 추천해드릴 수 있어요.";
                        const assistantMsg = { role: "assistant", content: assistantMessage };
                        setMessages((prev) => [...prev, assistantMsg]);
                    }
                } catch (e) {
                    console.error("[AIWorkflowSuggestionModal] 메시지 생성 중 에러:", e);
                    const errorMsg = { 
                        role: "assistant", 
                        content: "어떤 작업을 하시려는지 좀 더 구체적으로 알려주시면 더 정확한 워크플로우를 추천해드릴 수 있어요." 
                    };
                    setMessages((prev) => [...prev, errorMsg]);
                }
            }
        } catch (error) {
            console.error("[AIWorkflowSuggestionModal] API 호출 실패:", error);
            // 에러 발생 시 로딩 메시지 제거하고 기존 로직 사용
            setMessages((prev) => prev.filter(msg => !msg.isLoading));
            
            let workflow;
            try {
                workflow = analyzeWorkflow(trimmed);
            } catch (e) {
                console.error("[AIWorkflowSuggestionModal] 워크플로우 분석 중 에러:", e);
                workflow = { steps: [], suggestions: [] };
            }
            
            // workflow가 유효한지 확인
            if (!workflow || !Array.isArray(workflow.steps)) {
                workflow = { steps: [], suggestions: [] };
            }
            
            setSuggestedWorkflow(workflow);

            try {
                if (workflow.steps.length > 0) {
                    const validSteps = workflow.steps.filter(s => s && STEP_DESCRIPTIONS[s]);
                    if (validSteps.length > 0) {
                        const stepNames = validSteps.map(step => STEP_DESCRIPTIONS[step]).join(" → ");
                        let workflowMessage = `🤖 추천 워크플로우: ${stepNames}`;
                        
                        if (workflow.suggestions && Array.isArray(workflow.suggestions) && workflow.suggestions.length > 0) {
                            workflowMessage += `\n\n${workflow.suggestions.join("\n")}`;
                        }
                        
                        const stepDetails = validSteps.map((step, index) => {
                            const icon = STEP_ICONS[step] || "•";
                            const desc = STEP_DESCRIPTIONS[step] || step;
                            const expl = STEP_EXPLANATIONS[step] || "";
                            return `${index + 1}. ${icon} ${desc}${expl ? `\n   ${expl}` : ""}`;
                        }).join("\n\n");
                        
                        workflowMessage += `\n\n${stepDetails}`;
                        workflowMessage += `\n\n이 워크플로우를 진행하시겠어요?`;
                        
                        const workflowMsg = { 
                            role: "assistant", 
                            content: workflowMessage,
                            workflow: workflow
                        };
                        setMessages((prev) => [...prev, workflowMsg]);
                    } else {
                        const assistantMessage = "죄송합니다. AI 서비스에 일시적인 문제가 발생했습니다. 다시 시도해주세요.";
                        const assistantMsg = { role: "assistant", content: assistantMessage };
                        setMessages((prev) => [...prev, assistantMsg]);
                    }
                } else {
                    const assistantMessage = "죄송합니다. AI 서비스에 일시적인 문제가 발생했습니다. 다시 시도해주세요.";
                    const assistantMsg = { role: "assistant", content: assistantMessage };
                    setMessages((prev) => [...prev, assistantMsg]);
                }
            } catch (e) {
                console.error("[AIWorkflowSuggestionModal] 에러 메시지 생성 중 에러:", e);
                const errorMsg = { 
                    role: "assistant", 
                    content: "죄송합니다. AI 서비스에 일시적인 문제가 발생했습니다. 다시 시도해주세요." 
                };
                setMessages((prev) => [...prev, errorMsg]);
            }
        } finally {
            setBusy(false);
        }
    };

    const handleQuickOption = (option) => {
        // 대분류 선택인지 세부 옵션인지 확인
        if (option.category) {
            // 대분류 선택 - 세부 질문 표시
            const detailOptions = CATEGORY_QUESTIONS[option.category] || [];
            const detailMessage = {
                role: "assistant",
                content: `좋아요! "${option.text}"를 선택하셨네요. 더 구체적으로 알려주세요:`,
                quickOptions: detailOptions,
            };
            setMessages((prev) => [...prev, { role: "user", content: option.text }, detailMessage]);
        } else {
            // 세부 옵션 선택 - 워크플로우 적용
            handleSend(option.text, option.workflow);
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

    const handleApplyWorkflow = () => {
        if (suggestedWorkflow && Array.isArray(suggestedWorkflow.steps) && suggestedWorkflow.steps.length > 0) {
            try {
                // 워크플로우 적용
                onWorkflowSuggested(suggestedWorkflow.steps);
                
                // 상태 업데이트가 완료될 때까지 약간의 지연 후 모달 닫기
                setTimeout(() => {
                    onClose();
                }, 100);
            } catch (e) {
                console.error("[AIWorkflowSuggestionModal] 워크플로우 적용 중 에러:", e);
            }
        }
    };

    if (!open) return null;

    return (
        <div className="modal-backdrop" onClick={busy ? (e) => { e.preventDefault(); e.stopPropagation(); } : onClose}>
            <div className="modal" onClick={(event) => event.stopPropagation()} style={{ maxWidth: "90vw", width: "600px" }}>
                <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <div className="modal-head">
                        <h4>AI 워크플로우 제안</h4>
                        <button className="modal-close" onClick={busy ? (e) => { e.preventDefault(); e.stopPropagation(); } : onClose} disabled={busy}>×</button>
                    </div>
                    <div className="modal-body" style={{ display: "grid", gap: 12, flex: 1 }}>
                        <div className="ai-chat-messages" ref={messagesRef}>
                            {messages.filter(msg => msg && msg.role).map((message, index) => (
                                <div key={`${message.role}-${index}`} className="ai-chat-message-wrapper">
                                    <div
                                        className={`ai-chat-message ${message.role === "user" ? "from-user" : "from-assistant"}`}
                                    >
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
                                            <div style={{ whiteSpace: "pre-wrap" }}>{message.content || ""}</div>
                                        )}
                                    </div>
                                    {message.quickOptions && Array.isArray(message.quickOptions) && (
                                        <div className="quick-options-container">
                                            {message.quickOptions.filter(opt => opt && opt.text).map((option, optIndex) => (
                                                <button
                                                    key={optIndex}
                                                    className="quick-option-chip"
                                                    onClick={() => handleQuickOption(option)}
                                                >
                                                    {option.text}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {message.workflow && Array.isArray(message.workflow.steps) && message.workflow.steps.length > 0 && (
                                        <div className="workflow-suggestion-box" style={{ marginTop: "12px" }}>
                                            <div className="workflow-steps-visualization">
                                                {message.workflow.steps.filter(s => s && STEP_DESCRIPTIONS[s]).map((step, stepIndex) => (
                                                    <React.Fragment key={step}>
                                                        <div className="workflow-step-item">
                                                            <div className="workflow-step-number">{stepIndex + 1}</div>
                                                            <div className="workflow-step-icon">{STEP_ICONS[step]}</div>
                                                            <div className="workflow-step-label">{STEP_DESCRIPTIONS[step]}</div>
                                                        </div>
                                                        {stepIndex < message.workflow.steps.length - 1 && (
                                                            <div className="workflow-step-arrow">→</div>
                                                        )}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                            <div className="workflow-suggestion-actions" style={{ marginTop: "12px", display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                                                <button 
                                                    className="btn btn-ghost" 
                                                    onClick={() => {
                                                        // 이전 메시지로 돌아가기 (워크플로우 제안 메시지 제거)
                                                        setMessages((prev) => {
                                                            const newMessages = [...prev];
                                                            // 현재 워크플로우 메시지와 그 이전 사용자 메시지 제거
                                                            const workflowIndex = newMessages.findIndex((msg, idx) => 
                                                                msg.workflow && msg.workflow.steps.length > 0
                                                            );
                                                            if (workflowIndex !== -1) {
                                                                // 워크플로우 메시지와 그 직전 사용자 메시지 제거
                                                                newMessages.splice(workflowIndex - 1 >= 0 ? workflowIndex - 1 : workflowIndex, 
                                                                    workflowIndex - 1 >= 0 ? 2 : 1);
                                                            }
                                                            return newMessages;
                                                        });
                                                        setSuggestedWorkflow(null);
                                                    }}
                                                    style={{ color: "var(--text-secondary)" }}
                                                >
                                                    ← 다른 질문하기
                                                </button>
                                                <button 
                                                    className="btn btn-primary" 
                                                    onClick={handleApplyWorkflow}
                                                >
                                                    이 워크플로우로 진행하기
                                                </button>
                                            </div>
                                        </div>
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
        </div>
    );
}

