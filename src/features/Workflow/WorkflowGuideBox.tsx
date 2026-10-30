import type { CSSProperties, ReactNode } from "react";
import type { WorkflowGuide, WorkflowGuideStep } from "../../types/git";

const DEFAULT_HINT = "순서대로 진행하시면 됩니다. 현재 단계가 강조 표시됩니다.";

interface WorkflowGuideBoxProps {
    guide: WorkflowGuide;
    /** 해당 가이드 단계가 지금 진행 중인지 */
    isActive: (step: WorkflowGuideStep) => boolean;
    title?: ReactNode;
    /** 주어지면 우측 상단에 "✕ 취소" 버튼 표시 */
    onCancel?: () => void;
    /** 진행률 바와 완료(✓) 표시 여부 */
    showProgress?: boolean;
    /** 하단 안내 문구. 생략하면 진행 중인 단계 설명(없으면 기본 문구) */
    hint?: ReactNode;
    style?: CSSProperties;
}

// AI 추천 워크플로우의 단계 목록 / 진행률 박스
export default function WorkflowGuideBox({
    guide,
    isActive,
    title = "🎮 튜토리얼 모드",
    onCancel,
    showProgress = true,
    hint,
    style,
}: WorkflowGuideBoxProps) {
    const activeIndex = guide.steps.findIndex(isActive);
    const total = guide.steps.length;

    const titleEl = <div className="workflow-guide-title">{title}</div>;

    return (
        <div className="workflow-guide-box" style={style}>
            {showProgress || onCancel ? (
                <div className="workflow-guide-header">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                        {titleEl}
                        {onCancel && (
                            <button
                                className="btn btn-ghost"
                                onClick={onCancel}
                                style={{ fontSize: "12px", padding: "4px 8px", color: "var(--text-secondary)" }}
                                title="워크플로우 취소"
                            >
                                ✕ 취소
                            </button>
                        )}
                    </div>
                    {showProgress && (
                        <div className="workflow-progress">
                            <div className="workflow-progress-bar">
                                <div className="workflow-progress-fill" style={{ width: `${((activeIndex + 1) / total) * 100}%` }} />
                            </div>
                            <div className="workflow-progress-text">
                                {activeIndex + 1} / {total}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                titleEl
            )}
            <div className="workflow-guide-steps">
                {guide.steps.map((stepInfo, idx) => {
                    const active = isActive(stepInfo);
                    const completed = showProgress && activeIndex > idx;
                    return (
                        <div key={idx} className={`workflow-guide-step ${active ? "active" : ""} ${completed ? "completed" : ""}`}>
                            <span className="workflow-guide-step-number">{completed ? "✓" : stepInfo.index}</span>
                            <span className="workflow-guide-step-icon">{stepInfo.icon}</span>
                            <span className="workflow-guide-step-label">{stepInfo.label}</span>
                        </div>
                    );
                })}
            </div>
            <div className="workflow-guide-hint">{hint ?? (guide.steps[activeIndex]?.explanation || DEFAULT_HINT)}</div>
        </div>
    );
}
