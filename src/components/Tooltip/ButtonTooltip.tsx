import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { placeBeside, useTargetRect, type Placement } from "../../hooks/useTargetRect";
import "../../assets/styles/ButtonTooltip.css";

interface ButtonTooltipProps {
    targetElementId?: string | null;
    message?: ReactNode;
    position?: Placement;
    show?: boolean;
}

export default function ButtonTooltip({ targetElementId, message, position = "bottom", show = false }: ButtonTooltipProps) {
    // 크기가 0인(숨겨진) 버튼에는 툴팁을 붙이지 않는다
    const targetRect = useTargetRect(targetElementId, show, { intervalMs: 200, ignoreEmpty: true });

    if (!show || !message || !targetRect) return null;

    const content = (
        <div
            className="button-tooltip"
            style={{ ...placeBeside(targetRect, position, 6), zIndex: 100000, maxWidth: "320px" }}
        >
            <div className="button-tooltip-content">
                <div className={`button-tooltip-arrow button-tooltip-arrow-${position}`} />
                <div className="button-tooltip-message">{message}</div>
            </div>
        </div>
    );

    return typeof document !== "undefined" ? createPortal(content, document.body) : null;
}
