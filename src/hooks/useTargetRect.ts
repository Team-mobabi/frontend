import { useEffect, useState, type CSSProperties } from "react";

export interface TargetRect {
    top: number;
    left: number;
    width: number;
    height: number;
}

export type Placement = "top" | "bottom" | "left" | "right";

interface UseTargetRectOptions {
    /** 위치를 다시 읽는 주기(ms). 요소가 늦게 렌더링되는 경우도 이 주기로 재시도된다 */
    intervalMs?: number;
    /** true면 크기가 0인(숨겨진) 요소의 위치는 무시한다 */
    ignoreEmpty?: boolean;
}

const sameRect = (a: TargetRect | null, b: TargetRect): boolean =>
    !!a && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;

/**
 * id로 찾은 DOM 요소의 화면 좌표를 추적한다 (스크롤/리사이즈/주기적 폴링).
 * 비활성 상태이거나 아직 요소를 찾지 못했으면 null.
 */
export function useTargetRect(
    targetId: string | null | undefined,
    active: boolean,
    { intervalMs = 200, ignoreEmpty = false }: UseTargetRectOptions = {},
): TargetRect | null {
    const [rect, setRect] = useState<TargetRect | null>(null);

    useEffect(() => {
        if (!active || !targetId) return;

        const update = (): void => {
            const el = document.getElementById(targetId);
            if (!el) return;
            const r = el.getBoundingClientRect();
            if (ignoreEmpty && (r.width <= 0 || r.height <= 0)) return;
            const next = { top: r.top, left: r.left, width: r.width, height: r.height };
            setRect((prev) => (sameRect(prev, next) ? prev : next));
        };

        update();
        const interval = setInterval(update, intervalMs);
        window.addEventListener("scroll", update, true);
        window.addEventListener("resize", update);

        return () => {
            clearInterval(interval);
            window.removeEventListener("scroll", update, true);
            window.removeEventListener("resize", update);
            setRect(null);
        };
    }, [targetId, active, intervalMs, ignoreEmpty]);

    return active && targetId ? rect : null;
}

// 대상 요소 옆(상/하/좌/우)에 gap 만큼 떨어진 fixed 위치 스타일
export function placeBeside(rect: TargetRect, placement: Placement, gap: number): CSSProperties {
    const vertical = placement === "top" || placement === "bottom";
    return {
        position: "fixed",
        top: placement === "bottom" ? rect.top + rect.height + gap : vertical ? undefined : rect.top + rect.height / 2,
        bottom: placement === "top" ? window.innerHeight - rect.top + gap : undefined,
        left:
            placement === "left" ? undefined
            : placement === "right" ? rect.left + rect.width + gap
            : rect.left + rect.width / 2,
        right: placement === "left" ? window.innerWidth - rect.left + gap : undefined,
        transform: vertical ? "translateX(-50%)" : "translateY(-50%)",
    };
}
