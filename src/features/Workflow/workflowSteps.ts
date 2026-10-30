import type { WorkflowGuide, WorkflowGuideStep, WorkflowStep } from "../../types/git";

// 컨트롤 패널의 단계 번호 (1: 가져오기, 2: 파일 담기, 3: 버전 저장, 4: 올리기)
export type StepNum = 1 | 2 | 3 | 4;

// 튜토리얼 워크플로우의 기본 진행 순서
export const STEP_ORDER: readonly WorkflowStep[] = ["pull", "add", "commit", "push", "pr"];

// 워크플로우 단계 → 컨트롤 패널 단계 번호 (PR은 별도 화면이라 번호 없음)
export const STEP_NUM: Record<WorkflowStep, StepNum | "pr"> = { pull: 1, add: 2, commit: 3, push: 4, pr: "pr" };

export function stepNumOf(step: WorkflowStep | undefined): StepNum | undefined {
    if (!step) return undefined;
    const num = STEP_NUM[step];
    return typeof num === "number" ? num : undefined;
}

// 컨트롤 패널 단계 번호 → 워크플로우 단계
export const STEP_BY_NUM: Record<StepNum, WorkflowStep> = { 1: "pull", 2: "add", 3: "commit", 4: "push" };

// 메인 UI 단계 라벨
export const STEP_LABELS: Record<WorkflowStep, string> = {
    pull: "서버에서 최신 내용 가져오기",
    add: "변경된 파일 담기",
    commit: "변경 내용 설명 쓰고 저장",
    push: "서버에 올리기",
    pr: "변경 요청 만들기",
};

// "현재 단계" 안내 본문
export const STEP_GUIDES: Record<StepNum, string> = {
    1: "먼저 서버 저장소와 상태를 맞춰 주세요. 가져오기를 실행하면 서버에서 최신 내용을 받아옵니다.",
    2: "다음 버전에 포함할 파일을 고르고 담아 주세요. 선택된 파일은 준비 영역에 모입니다.",
    3: "담긴 파일들의 변경 이유를 메시지로 남기고 저장합니다. 저장 후에는 서버에 올리기가 준비됩니다.",
    4: "준비된 저장을 선택한 가지로 업로드합니다. 필요하다면 변경 사항을 다시 확인해 주세요.",
};

export const STEP_ICONS: Record<WorkflowStep, string> = {
    pull: "⬇️",
    add: "📦",
    commit: "💾",
    push: "⬆️",
    pr: "🔀",
};

export const STEP_EXPLANATIONS: Record<WorkflowStep, string> = {
    pull: "서버 저장소에서 최신 변경사항을 가져와 내 저장소와 동기화합니다.",
    add: "변경된 파일 중 다음 버전에 포함할 파일을 선택하여 준비 영역에 추가합니다.",
    commit: "준비된 파일들을 하나의 작업 단위로 묶어 저장 메시지와 함께 저장합니다.",
    push: "내 저장소에 저장된 내용을 서버 저장소에 업로드하여 다른 사람과 공유합니다.",
    pr: "변경사항을 코드 리뷰를 받기 위해 변경 요청으로 생성합니다.",
};

// 버튼 툴팁용 짧은 설명
export const STEP_SHORT_DESCRIPTIONS: Record<WorkflowStep, string> = {
    pull: "서버에서 최신 내용을 가져옵니다",
    add: "변경된 파일을 선택하여 담습니다",
    commit: "변경 내용을 설명하고 저장합니다",
    push: "저장된 내용을 서버에 올립니다",
    pr: "코드 리뷰를 위해 변경 요청을 만듭니다",
};

// AI 워크플로우 추천 대화창에서 쓰는 문구 (메인 UI와 표현이 다른 부분만 덮어쓴다)
export const SUGGESTION_STEP_LABELS: Record<WorkflowStep, string> = {
    ...STEP_LABELS,
    pr: "협업하기 만들기",
};

export const SUGGESTION_STEP_EXPLANATIONS: Record<WorkflowStep, string> = {
    pull: "원격 저장소에서 최신 변경사항을 가져와 로컬과 동기화합니다.",
    add: "변경된 파일 중 다음 버전에 포함할 파일을 선택하여 스테이징 영역에 추가합니다.",
    commit: "스테이징된 파일들을 하나의 작업 단위로 묶어 커밋 메시지와 함께 저장합니다.",
    push: "로컬에 저장된 커밋을 원격 저장소에 업로드하여 다른 사람과 공유합니다.",
    pr: "변경사항을 코드 리뷰를 받기 위해 협업하기로 생성합니다.",
};

// 튜토리얼 버튼 DOM id (툴팁 위치 계산용)
export const STEP_BUTTON_IDS: Record<WorkflowStep, string> = {
    pull: "tutorial-pull-btn",
    add: "tutorial-add-btn",
    commit: "tutorial-commit-btn",
    push: "tutorial-push-btn",
    pr: "tutorial-pr-btn",
};

export function isWorkflowStep(value: unknown): value is WorkflowStep {
    return typeof value === "string" && (STEP_ORDER as readonly string[]).includes(value);
}

// 추천 단계 목록으로 화면에 보여줄 가이드 정보를 만든다
export function buildWorkflowGuide(steps: readonly WorkflowStep[]): WorkflowGuide {
    return {
        steps: steps.map<WorkflowGuideStep>((step, idx) => ({
            step,
            stepNum: STEP_NUM[step],
            label: STEP_LABELS[step],
            icon: STEP_ICONS[step],
            explanation: STEP_EXPLANATIONS[step],
            index: idx + 1,
        })),
    };
}

export interface NextStepInfo {
    next: WorkflowStep;
    /** next 다음 단계 (안내 문구용) */
    afterNext?: WorkflowStep;
}

// current 다음 단계. current가 목록에 없거나 마지막이면 null (= 워크플로우 완료)
export function nextStep(steps: readonly WorkflowStep[], current: WorkflowStep): NextStepInfo | null {
    const idx = steps.indexOf(current);
    if (idx < 0 || idx >= steps.length - 1) return null;
    return { next: steps[idx + 1], afterNext: steps[idx + 2] };
}

// commit 앞에 add가 없으면 끼워 넣는다 (담지 않고 저장할 수는 없으므로)
export function ensureAddBeforeCommit<T extends string>(steps: readonly T[]): (T | "add")[] {
    const result: (T | "add")[] = [...steps];
    const commitIndex = result.indexOf("commit" as T);
    if (commitIndex !== -1 && !result.includes("add")) result.splice(commitIndex, 0, "add");
    return result;
}

export interface NormalizeOptions {
    /** 이미 담긴(staged) 파일이 있으면 add 단계는 빼고, add 보정도 하지 않는다 */
    hasStaged?: boolean;
    /** "만 저장" 요청이면 push 단계를 뺀다 */
    onlySave?: boolean;
}

// 현재 저장소 상태에 맞게 추천 단계를 보정한다
export function normalizeSteps<T extends string>(steps: readonly T[], { hasStaged = false, onlySave = false }: NormalizeOptions = {}): (T | "add")[] {
    let result: T[] = hasStaged ? steps.filter((s) => s !== "add") : [...steps];
    if (onlySave) result = result.filter((s) => s !== "push");
    return hasStaged ? result : ensureAddBeforeCommit(result);
}

// 단계별 키워드 (AI suggestedActions 문장에서 단계를 뽑아낼 때 사용, 순서 = 우선순위)
const ACTION_KEYWORDS: readonly [WorkflowStep, readonly string[]][] = [
    ["pull", ["가져오기", "pull", "fetch"]],
    ["add", ["담기", "스테이징", "add", "stage"]],
    ["commit", ["커밋", "commit", "저장", "save"]],
    ["push", ["올리기", "push", "푸시", "업로드"]],
    ["pr", ["pr", "pull request", "리뷰", "review"]],
];

// AI가 돌려준 suggestedActions 문장 목록에서 워크플로우 단계를 순서대로 뽑는다 (중복 제거)
export function parseStepsFromActions(actions: readonly unknown[]): WorkflowStep[] {
    const steps: WorkflowStep[] = [];
    for (const action of actions) {
        if (!action || typeof action !== "string") continue;
        const lower = action.toLowerCase();
        for (const [step, keywords] of ACTION_KEYWORDS) {
            if (!steps.includes(step) && keywords.some((k) => lower.includes(k))) steps.push(step);
        }
    }
    return steps;
}

// "변경사항만 저장", "저장만" 처럼 push 없이 저장만 원하는 요청인지
export function isOnlySaveRequest(text: string): boolean {
    const lower = text.toLowerCase();
    const has = (k: string) => lower.includes(k);
    return (
        has("만 저장") ||
        has("저장만") ||
        has("only save") ||
        has("save only") ||
        (has("저장") && (has("만") || has("only")) && !has("공유") && !has("올리기") && !has("push") && !has("푸시"))
    );
}
