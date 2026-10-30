import type { WorkflowStep } from "../../types/git";
import {
    ensureAddBeforeCommit,
    isOnlySaveRequest,
    isWorkflowStep,
    STEP_ICONS,
    SUGGESTION_STEP_EXPLANATIONS,
    SUGGESTION_STEP_LABELS,
} from "./workflowSteps";

// 브랜치 관련 작업은 튜토리얼 워크플로우 단계가 아니라 안내 메시지로만 처리한다
export type BranchStep = "branch_create" | "branch_switch" | "branch_merge" | "branch_delete";
export type SuggestedStep = WorkflowStep | BranchStep;

export interface LocalWorkflow {
    steps: SuggestedStep[];
    suggestions: string[];
}

export function isBranchStep(step: SuggestedStep): step is BranchStep {
    return step.startsWith("branch_");
}

export const BRANCH_ACTION_MESSAGES: Record<BranchStep, string> = {
    branch_create: "새 브랜치를 만들 수 있습니다. 상단의 버전 선택 메뉴에서 '+ 새 작업 버전 만들기'를 클릭하세요.",
    branch_switch: "브랜치를 전환할 수 있습니다. 상단의 버전 선택 메뉴에서 원하는 브랜치를 선택하세요.",
    branch_merge: "브랜치를 병합할 수 있습니다. 그래프 뷰에서 브랜치를 선택하여 병합하세요.",
    branch_delete: "브랜치를 삭제할 수 있습니다. 상단의 버전 선택 메뉴에서 삭제할 브랜치 옆의 삭제 버튼을 클릭하세요.",
};

// 브랜치 단계가 섞여 있으면 해당 안내 문구, 아니면 null
export function branchMessageOf(steps: readonly SuggestedStep[] | undefined): string | null {
    if (!steps || !steps.some(isBranchStep)) return null;
    const branchAction = steps.find(isBranchStep);
    return (branchAction && BRANCH_ACTION_MESSAGES[branchAction]) || "브랜치 관련 작업을 진행하세요.";
}

// 사용자 입력 키워드로 워크플로우를 추측한다 (AI 응답을 못 받았을 때의 대체 분석)
export function analyzeWorkflow(input: string): LocalWorkflow {
    const lowerInput = input.toLowerCase();
    const has = (...keys: string[]) => keys.some((k) => lowerInput.includes(k));
    const steps: SuggestedStep[] = [];
    const suggestions: string[] = [];

    if (has("가져오기", "pull", "동기화", "최신", "서버에서")) {
        steps.push("pull");
        suggestions.push("서버에서 최신 내용을 가져오는 것이 좋겠어요.");
    }
    if (has("담기", "add", "스테이징", "파일 선택", "변경된 파일")) {
        steps.push("add");
        suggestions.push("변경된 파일을 스테이징 영역에 담아야 해요.");
    }
    if (has("저장", "commit", "커밋", "버전 저장")) {
        steps.push("commit");
        suggestions.push("변경사항을 커밋으로 저장해야 해요.");
    }
    if (has("올리기", "push", "푸시", "서버에 올리", "업로드")) {
        steps.push("push");
        suggestions.push("커밋을 서버에 올려야 해요.");
    }
    if (has("pr", "pull request", "리뷰", "병합 요청", "코드 리뷰")) {
        steps.push("pr");
        suggestions.push("협업하기를 만들어서 코드 리뷰를 받는 것이 좋겠어요.");
    }

    // 브랜치 관련 키워드 처리
    if (has("브랜치", "branch")) {
        if (has("만들", "생성", "create")) {
            steps.push("branch_create");
            suggestions.push("새 브랜치를 만드는 것이 좋겠어요.");
        } else if (has("전환", "변경", "switch", "체크아웃", "checkout")) {
            steps.push("branch_switch");
            suggestions.push("브랜치를 전환하는 것이 좋겠어요.");
        } else if (has("병합", "merge")) {
            steps.push("branch_merge");
            suggestions.push("브랜치를 병합하는 것이 좋겠어요.");
        } else if (has("삭제", "delete", "파기")) {
            steps.push("branch_delete");
            suggestions.push("브랜치를 삭제하는 것이 좋겠어요.");
        }
    }

    const isOnlySave = isOnlySaveRequest(input);
    // "저장하고 공유" 같은 패턴 (push 포함)
    const isSaveAndShare = has("저장", "save", "커밋", "commit") && has("공유", "올리기", "push", "푸시");

    if (isSaveAndShare) {
        // 저장하고 공유 = add, commit, push
        for (const s of ["add", "commit", "push"] as const) {
            if (!steps.includes(s)) steps.push(s);
        }
    } else if (isOnlySave) {
        // "만 저장"이면 push 제외
        const pushIndex = steps.indexOf("push");
        if (pushIndex !== -1) steps.splice(pushIndex, 1);
    }

    // 기본 워크플로우 추론
    if (steps.length === 0) {
        if (has("전체", "모든", "처음부터", "처음")) {
            steps.push("pull", "add", "commit", "push");
            suggestions.push("전체 워크플로우를 진행하시는 것이 좋겠어요: 가져오기 → 파일 담기 → 버전 저장 → 서버에 올리기");
        } else if (has("변경", "수정")) {
            if (!isOnlySave) {
                steps.push("add", "commit", "push");
                suggestions.push("변경사항을 저장하고 올리는 것이 좋겠어요: 파일 담기 → 버전 저장 → 서버에 올리기");
            } else {
                steps.push("add", "commit");
                suggestions.push("변경사항을 저장하는 것이 좋겠어요: 파일 담기 → 버전 저장");
            }
        }
    }

    // 최종 검증: commit이 있으면 반드시 add가 앞에 있어야 함
    return { steps: ensureAddBeforeCommit([...new Set(steps)]), suggestions };
}

interface WorkflowMessageOptions {
    /** AI 답변 등 앞에 붙일 본문. 주어지면 빈 문자열이어도 "\n\n" 뒤에 추천 내용이 붙는다 */
    prefix?: string;
    suggestions?: string[];
}

// "🤖 추천 워크플로우: …" 안내 메시지. 보여줄 단계가 없으면 null
export function buildWorkflowMessage(steps: readonly SuggestedStep[], { prefix, suggestions }: WorkflowMessageOptions = {}): string | null {
    const validSteps = steps.filter(isWorkflowStep);
    if (validSteps.length === 0) return null;

    const stepNames = validSteps.map((s) => SUGGESTION_STEP_LABELS[s]).join(" → ");
    let message = prefix !== undefined ? `${prefix}\n\n🤖 추천 워크플로우: ${stepNames}` : `🤖 추천 워크플로우: ${stepNames}`;
    if (suggestions && suggestions.length > 0) message += `\n\n${suggestions.join("\n")}`;

    const stepDetails = validSteps
        .map((s, index) => `${index + 1}. ${STEP_ICONS[s]} ${SUGGESTION_STEP_LABELS[s]}\n   ${SUGGESTION_STEP_EXPLANATIONS[s]}`)
        .join("\n\n");
    return `${message}\n\n${stepDetails}\n\n이 워크플로우를 진행하시겠어요?`;
}
