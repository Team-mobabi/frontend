import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * 게임 튜토리얼 스타일의 오버레이 컴포넌트
 * 현재 단계의 버튼을 강조하고, 다른 요소들을 어둡게 처리
 */
export default function TutorialOverlay({ 
    targetElementId, 
    message, 
    position = "bottom", // "top", "bottom", "left", "right"
    show = false,
    onComplete
}) {
    const [targetRect, setTargetRect] = useState(null);
    const overlayRef = useRef(null);

    useEffect(() => {
        if (!show || !targetElementId) {
            setTargetRect(null);
            return;
        }

        const updatePosition = () => {
            const target = document.getElementById(targetElementId);
            if (target) {
                const rect = target.getBoundingClientRect();
                console.log("[TutorialOverlay] Target found:", { targetElementId, rect });
                setTargetRect({
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                });
            } else {
                console.log("[TutorialOverlay] Target not found:", targetElementId);
                // 요소를 찾을 수 없으면 잠시 후 다시 시도
                setTimeout(updatePosition, 100);
            }
        };

        // 초기 위치 업데이트
        updatePosition();
        
        // 주기적으로 위치 업데이트 (요소가 동적으로 생성될 수 있음)
        const intervalId = setInterval(updatePosition, 100);
        
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
        };
    }, [show, targetElementId]);

    if (!show || !targetRect) return null;

    // 포인터 위치 계산
    const getPointerStyle = () => {
        const gap = 12;
        switch (position) {
            case "top":
                return {
                    bottom: "100%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    marginBottom: gap,
                };
            case "bottom":
                return {
                    top: "100%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    marginTop: gap,
                };
            case "left":
                return {
                    right: "100%",
                    top: "50%",
                    transform: "translateY(-50%)",
                    marginRight: gap,
                };
            case "right":
                return {
                    left: "100%",
                    top: "50%",
                    transform: "translateY(-50%)",
                    marginLeft: gap,
                };
            default:
                return {
                    top: "100%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    marginTop: gap,
                };
        }
    };

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

            {/* 툴팁 메시지 */}
            <div
                ref={overlayRef}
                className="tutorial-tooltip"
                style={{
                    position: "fixed",
                    top: position === "bottom" ? targetRect.top + targetRect.height + 12 : undefined,
                    bottom: position === "top" ? window.innerHeight - targetRect.top + 12 : undefined,
                    left: position === "left" ? undefined : position === "right" ? targetRect.left + targetRect.width + 12 : targetRect.left + targetRect.width / 2,
                    right: position === "right" ? undefined : position === "left" ? window.innerWidth - targetRect.left + 12 : undefined,
                    transform: position === "bottom" || position === "top" 
                        ? "translateX(-50%)" 
                        : position === "left" || position === "right"
                        ? "translateY(-50%)"
                        : "translate(-50%, -50%)",
                    zIndex: 10000,
                    maxWidth: "320px",
                }}
            >
                <div className="tutorial-tooltip-content">
                    <div className={`tutorial-tooltip-arrow tutorial-tooltip-arrow-${position}`} />
                    <div className="tutorial-tooltip-message">{message.split('\n').map((line, i) => (
                        <React.Fragment key={i}>
                            {line}
                            {i < message.split('\n').length - 1 && <br />}
                        </React.Fragment>
                    ))}</div>
                </div>
            </div>
        </>
    );

    // React Portal을 사용하여 body에 직접 렌더링
    return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}

