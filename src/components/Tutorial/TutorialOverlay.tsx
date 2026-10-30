import { Fragment } from "react";
import { createPortal } from "react-dom";
import { placeBeside, useTargetRect, type Placement } from "../../hooks/useTargetRect";

interface TutorialOverlayProps {
    targetElementId?: string | null;
    message: string;
    position?: Placement;
    show?: boolean;
    // 아직 호출하는 곳은 없지만 기존 API 호환을 위해 유지
    onComplete?: () => void;
}

/**
 * 게임 튜토리얼 스타일의 오버레이 컴포넌트
 * 현재 단계의 버튼을 강조하고, 다른 요소들을 어둡게 처리
 */
export default function TutorialOverlay({
    targetElementId,
    message,
    position = "bottom",
    show = false,
}: TutorialOverlayProps) {
    const targetRect = useTargetRect(targetElementId, show, { intervalMs: 100 });

    if (!show || !targetRect) return null;

    const lines = message.split("\n");

    const content = (
        <>
            {/* 어두운 오버레이 (전체 화면) */}
            <div
                className="tutorial-overlay-backdrop"
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.6)",
                    zIndex: 9998,
                    pointerEvents: "none",
                }}
            />

            {/* 타겟 요소 주변의 하이라이트 */}
            <div
                className="tutorial-highlight"
                style={{
                    position: "fixed",
                    top: targetRect.top,
                    left: targetRect.left,
                    width: targetRect.width,
                    height: targetRect.height,
                    borderRadius: "12px",
                    boxShadow: `
                        0 0 0 9999px rgba(0, 0, 0, 0.6),
                        0 0 0 4px var(--warn),
                        0 0 20px rgba(245, 158, 11, 0.5),
                        inset 0 0 20px rgba(245, 158, 11, 0.2)
                    `,
                    zIndex: 9999,
                    pointerEvents: "none",
                    animation: "tutorial-pulse 2s ease-in-out infinite",
                }}
            />

            <div
                className="tutorial-tooltip"
                style={{
                    ...placeBeside(targetRect, position, 12),
                    zIndex: 10000,
                    maxWidth: "320px",
                }}
            >
                <div className="tutorial-tooltip-content">
                    <div className={`tutorial-tooltip-arrow tutorial-tooltip-arrow-${position}`} />
                    <div className="tutorial-tooltip-message">{lines.map((line, i) => (
                        <Fragment key={i}>
                            {line}
                            {i < lines.length - 1 && <br />}
                        </Fragment>
                    ))}</div>
                </div>
            </div>
        </>
    );

    return typeof document !== "undefined" ? createPortal(content, document.body) : null;
}
