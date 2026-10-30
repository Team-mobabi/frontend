import type { WorkflowGuide, WorkflowGuideStep } from "../../types/git";
import WorkflowGuideBox from "../Workflow/WorkflowGuideBox";
import { STEP_BY_NUM, STEP_GUIDES, STEP_LABELS, type StepNum } from "../Workflow/workflowSteps";

interface ProcessGuidePanelProps {
    step: StepNum;
    noticeText: string;
    noticeType: string;
    guide: WorkflowGuide | null;
    isActive: (s: WorkflowGuideStep) => boolean;
    onClose: () => void;
    onCancelWorkflow: () => void;
}

// "현재 단계" 안내 박스 (+ AI 추천 워크플로우 진행 상황)
export default function ProcessGuidePanel({ step, noticeText, noticeType, guide, isActive, onClose, onCancelWorkflow }: ProcessGuidePanelProps) {
    const hasGuide = Boolean(guide && guide.steps.length > 0);
    return (
        <div className={`process-alert ${noticeType}`}>
            <div className="process-alert-header">
                <div>
                    <strong className="process-alert-title">현재 단계</strong>
                    <span className="process-alert-step">{STEP_LABELS[STEP_BY_NUM[step]]}</span>
                </div>
                {!guide && (
                    <button className="process-alert-close" onClick={onClose} title="안내 닫기">
                        ×
                    </button>
                )}
            </div>
            <p className="process-alert-body">{STEP_GUIDES[step]}</p>
            {noticeText && <div className={`process-alert-message ${noticeType}`}>{noticeText}</div>}
            {guide && hasGuide && <WorkflowGuideBox guide={guide} isActive={isActive} onCancel={onCancelWorkflow} />}
        </div>
    );
}
