import React, { createContext, useContext, useReducer, useEffect } from "react";

const GitContext = createContext(null);
const LS_KEY = "git_last_repo";

const initial = {
    repositories: [],
    selectedRepoId: "",
    workingDirectory: [],
    stagingArea: [],
    graphVersion: 0,
    animationMode: "idle",
    animationTick: 0,
    transferSnapshot: null,
    eventLog: [],
};

function reducer(state, action) {
    switch (action.type) {
        case "ADD_REPO":
            return { ...state, repositories: [...state.repositories, action.payload] };
        case "SET_REPOS":
            return { ...state, repositories: action.payload };
        case "SELECT_REPO":
            if (action.payload) try { localStorage.setItem(LS_KEY, String(action.payload)); } catch {}
            return { ...state, selectedRepoId: action.payload, stagingArea: [], workingDirectory: [] };
        case "ADD_SELECTED":
            return { ...state, stagingArea: Array.from(new Set([...(state.stagingArea||[]), ...action.payload])) };
        case "REMOVE_FROM_STAGING":
            return { ...state, stagingArea: (state.stagingArea||[]).filter(n => n !== action.payload) };
        case "COMMIT_SUCCESS":
            return { ...state, stagingArea: [], eventLog: [...state.eventLog, { t: Date.now(), kind: "commit", msg: action.message }] };
        case "GRAPH_DIRTY":
            return { ...state, graphVersion: state.graphVersion + 1 };
        case "SET_TRANSFER":
            return { ...state, transferSnapshot: action.payload || null };
        case "SET_ANIMATION_START":
            return { ...state, animationMode: action.payload, animationTick: state.animationTick + 1 };
        case "SET_ANIMATION_END":
            return { ...state, animationMode: "idle", animationTick: state.animationTick + 1 };
        case "LOG_EVENT":
            return { ...state, eventLog: [...state.eventLog, { t: Date.now(), ...action.payload }] };
        default:
            return state;
    }
}

export function GitProvider({ children }) {
    const [state, dispatch] = useReducer(reducer, initial);

    useEffect(() => {
        // 앱 시작 시 마지막 선택 레포 복원
        try {
            const saved = localStorage.getItem(LS_KEY);
            if (saved) dispatch({ type: "SELECT_REPO", payload: saved });
        } catch {}
    }, []);

    return <GitContext.Provider value={{ state, dispatch }}>{children}</GitContext.Provider>;
}

export function useGit() {
    return useContext(GitContext);
}
