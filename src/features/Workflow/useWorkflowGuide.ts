import { useCallback, useEffect, useRef, useState } from "react";
import { useGit } from "../GitCore/GitContext";
import type { WorkflowGuide, WorkflowGuideStep, WorkflowStep } from "../../types/git";
import { buildWorkflowGuide, nextStep, STEP_LABELS, stepNumOf, type NextStepInfo, type StepNum } from "./workflowSteps";

export type NoticeType = "info" | "warning";

export type AdvancePlan =
    | { kind: "none" } // 진행 중인 워크플로우 없음
    | { kind: "done" } // 방금 단계가 마지막 (또는 목록에 없음)
    | ({ kind: "next"; nextNum?: StepNum } & NextStepInfo);

export const WORKFLOW_DONE_MESSAGE = "워크플로우가 완료되었습니다! 🎉";

// 컨트롤 패널 단계(step) + AI 추천 워크플로우 + 안내 문구 상태를 한곳에서 관리한다
export function useWorkflowGuide() {
    const { state, dispatch } = useGit();

    const [step, setStep] = useState<StepNum>(1);
    const [steps, setSteps] = useState<WorkflowStep[]>([]); // 추천된 워크플로우 단계
    const [guide, setGuide] = useState<WorkflowGuide | null>(null); // 워크플로우 가이드 정보
    const [isOnlySave, setIsOnlySave] = useState(false); // "만 저장" 워크플로우인지 여부

    const [showGuide, setShowGuide] = useState(true);
    const [notice, setNotice] = useState("");
    const [noticeType, setNoticeType] = useState<NoticeType>("info");

    const showNotice = useCallback((message: string, type: NoticeType = "warning") => {
        setNotice(message);
        setNoticeType(type);
        setShowGuide(true);
    }, []);

    // 단계가 바뀌면 이전 안내 문구는 지운다
    useEffect(() => {
        setNotice("");
        setNoticeType("info");
        setShowGuide(true);
    }, [step]);

    // GitContext와 워크플로우 상태 동기화 (PullRequestListView 등에서 사용)
    useEffect(() => {
        dispatch({ type: "SET_SUGGESTED_WORKFLOW_STEPS", payload: steps });
    }, [steps, dispatch]);

    useEffect(() => {
        dispatch({ type: "SET_WORKFLOW_GUIDE", payload: guide });
    }, [guide, dispatch]);

    // GitContext에서 워크플로우 완료 감지 (PR 생성 등 외부에서 비운 경우)
    // 컨텍스트 값이 "있다가 비었을 때"만 반응한다 — 로컬에서 막 시작해 아직 동기화 전인 경우는 무시
    const ctxLength = state.suggestedWorkflowSteps.length;
    const prevCtxLength = useRef(ctxLength);
    useEffect(() => {
        const wasSynced = prevCtxLength.current > 0;
        prevCtxLength.current = ctxLength;
        if (wasSynced && ctxLength === 0 && steps.length > 0) {
            setSteps([]);
            setGuide(null);
            showNotice(WORKFLOW_DONE_MESSAGE, "info");
        }
    }, [ctxLength, steps.length, showNotice]);

    // 새 워크플로우 시작 (첫 단계 이동/안내는 호출 측에서 처리)
    const start = useCallback((next: WorkflowStep[]) => {
        const hasPush = next.includes("push");
        setSteps(next);
        setIsOnlySave(!hasPush && (next.includes("commit") || next.includes("add")));
        if (next.length > 0) {
            setGuide(buildWorkflowGuide(next));
            setShowGuide(true); // 가이드가 있을 때는 강제로 표시
        }
    }, []);

    // 워크플로우를 비우고 첫 단계로 돌아간다
    const reset = useCallback(
        (message?: string) => {
            setSteps([]);
            setGuide(null);
            setIsOnlySave(false);
            setStep(1);
            if (message) showNotice(message, "info");
        },
        [showNotice],
    );

    const complete = useCallback(() => reset(WORKFLOW_DONE_MESSAGE), [reset]);

    // current 단계를 마친 뒤 어디로 갈지 계산 (상태 변경은 하지 않음)
    const advance = useCallback(
        (current: WorkflowStep): AdvancePlan => {
            if (steps.length === 0) return { kind: "none" };
            const info = nextStep(steps, current);
            if (!info) return { kind: "done" };
            return { kind: "next", nextNum: stepNumOf(info.next), ...info };
        },
        [steps],
    );

    // "다음 단계: …" 안내
    const announceNext = useCallback(
        (afterNext: WorkflowStep | undefined) => {
            showNotice(afterNext ? `다음 단계: ${STEP_LABELS[afterNext]}` : "이 단계를 완료하면 워크플로우가 완료됩니다.", "info");
        },
        [showNotice],
    );

    // 가이드 단계가 지금 진행 중인지 (PR 단계는 PR 화면이 열려 있는지로 판단)
    const isActive = useCallback(
        (s: WorkflowGuideStep) => (s.step === "pr" ? state.currentView === "prs" : step === s.stepNum),
        [state.currentView, step],
    );

    // 버튼 강조 대상: 현재 step에 해당하는 추천 단계, 없으면 첫 번째 추천 단계
    const highlighted: WorkflowStep | null =
        steps.length === 0 ? null : (steps.find((s) => stepNumOf(s) === step) ?? steps[0]);

    return {
        step,
        setStep,
        steps,
        guide,
        isOnlySave,
        inWorkflow: steps.length > 0,
        highlighted,
        isSuggested: (s: WorkflowStep) => highlighted === s,
        start,
        reset,
        complete,
        advance,
        announceNext,
        isActive,
        notice: { text: notice, type: noticeType, showGuide, setShowGuide, show: showNotice },
    };
}
