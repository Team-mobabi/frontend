import { useEffect, useRef } from "react";
import { useGit } from "../GitCore/GitContext.jsx";

export default function AnimationEngine() {
    const { state, dispatch } = useGit();
    const timer = useRef(null);

    useEffect(() => {
        if (state.animationMode === "idle") return;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            dispatch({ type: "SET_ANIMATION_END" });
        }, 900); // CSS keyframes 0.6s + 여유
        return () => clearTimeout(timer.current);
    }, [state.animationMode, state.animationTick, dispatch]);

    return null; // UI 없음 (상태만 관리)
}
