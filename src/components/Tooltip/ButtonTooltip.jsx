import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import "../../assets/styles/ButtonTooltip.css";

export default function ButtonTooltip({ targetElementId, message, position = "bottom", show = false }) {
    const [targetRect, setTargetRect] = useState(null);
    const overlayRef = useRef(null);
    const retryTimeoutRef = useRef(null);

    useEffect(() => {
        if (!show || !targetElementId) {
            setTargetRect(null);
            return;
        }

        const updatePosition = () => {
            const targetElement = document.getElementById(targetElementId);
            if (!targetElement) {
                // 요소를 찾을 수 없으면 잠시 후 다시 시도
                if (retryTimeoutRef.current) {
                    clearTimeout(retryTimeoutRef.current);
                }
                retryTimeoutRef.current = setTimeout(() => {
                    updatePosition();
                }, 100);
                return;
            }

            // 요소를 찾았으면 재시도 타이머 정리
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = null;
            }

            const rect = targetElement.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                setTargetRect({
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                });
            }
        };

        // 즉시 한 번 실행
        updatePosition();
        
        // 주기적으로 위치 업데이트 (요소가 동적으로 렌더링될 수 있음)
        const interval = setInterval(updatePosition, 200);
        
        window.addEventListener("scroll", updatePosition, true);
        window.addEventListener("resize", updatePosition);

        return () => {
            window.removeEventListener("scroll", updatePosition, true);
            window.removeEventListener("resize", updatePosition);
            clearInterval(interval);
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
        };
    }, [targetElementId, show]);

    if (!show || !message || !targetRect) return null;

    const tooltipStyle = {
        position: "fixed",
        top: position === "bottom" ? `${targetRect.top + targetRect.height + 6}px` : undefined,
        bottom: position === "top" ? `${window.innerHeight - targetRect.top + 6}px` : undefined,
        left: position === "left" ? undefined : position === "right" ? `${targetRect.left + targetRect.width + 6}px` : `${targetRect.left + targetRect.width / 2}px`,
        right: position === "right" ? undefined : position === "left" ? `${window.innerWidth - targetRect.left + 6}px` : undefined,
        transform: position === "bottom" || position === "top" 
            ? "translateX(-50%)" 
            : position === "left" || position === "right"
            ? "translateY(-50%)"
            : "translate(-50%, -50%)",
        zIndex: 100000,
        maxWidth: "320px",
    };

    const content = (
        <div
            ref={overlayRef}
            className="button-tooltip"
            style={tooltipStyle}
        >
            <div className="button-tooltip-content">
                <div className={`button-tooltip-arrow button-tooltip-arrow-${position}`} />
                <div className="button-tooltip-message">{message}</div>
            </div>
        </div>
    );

    return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}

