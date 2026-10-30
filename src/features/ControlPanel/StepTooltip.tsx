import ButtonTooltip from "../../components/Tooltip/ButtonTooltip";
import { STEP_BUTTON_IDS, STEP_SHORT_DESCRIPTIONS } from "../Workflow/workflowSteps";
import type { WorkflowStep } from "../../types/git";

// 컨트롤 패널 버튼에 붙는 단계 (PR 버튼은 PullRequestListView 쪽에서 처리)
const PANEL_STEPS: readonly WorkflowStep[] = ["pull", "add", "commit", "push"];

// AI 추천으로 강조된 단계 버튼 아래에 짧은 설명 툴팁을 띄운다
export default function StepTooltip({ step }: { step: WorkflowStep | null }) {
    if (!step || !PANEL_STEPS.includes(step)) return null;
    return (
        <ButtonTooltip
            key={step}
            targetElementId={STEP_BUTTON_IDS[step]}
            message={STEP_SHORT_DESCRIPTIONS[step]}
            position="bottom"
            show={true}
        />
    );
}
