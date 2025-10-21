import React, { useEffect, useRef } from "react";
import { useGit } from "../GitCore/GitContext.jsx";

const ANIMATION_LABEL = {
    pull: "원격 저장소에서 받아오는 중...",
    push: "원격 저장소로 올리는 중...",
    commit: "새로운 버전으로 저장하는 중...",
    add: "파일을 스테이징 영역에 담는 중...",
};

const ANIMATION_DURATION = {
    pull: 1200,
    push: 1200,
    commit: 600,
    add: 500,
};

export default function AnimationEngine() {
    const { state, dispatch } = useGit();
    const timer = useRef(null);

    const mode = state.animationMode;
    const isIdle = mode === "idle";
    const label = ANIMATION_LABEL[mode] || "작업 중...";
    const duration = ANIMATION_DURATION[mode] || 900;

    useEffect(() => {
        if (isIdle) return;

        clearTimeout(timer.current);

        timer.current = setTimeout(() => {
            if (mode === "pull" || mode === "push" || mode === "commit") {
                dispatch({ type: "GRAPH_DIRTY" });
            }
            dispatch({ type: "SET_ANIMATION_END" });
        }, duration);

        return () => clearTimeout(timer.current);

    }, [mode, state.animationTick, dispatch, isIdle, duration]);

    if (isIdle) return null;

    return (
        <div className="animation-overlay">
            <div className="animation-toast">
                <div className="spinner" />
                <span>{label}</span>
            </div>
        </div>
    );
}