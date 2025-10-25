import React, { createContext, useContext, useReducer, useEffect } from "react";
import {repoIdOf} from "./gitUtils.js";

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
    conflictInfo: { open: false },
    currentView: "graph",
    prList: [],
    selectedPrId: null, // [신규] 현재 보고있는 PR ID
};

function reducer(state, action) {
    switch (action.type) {
        case "ADD_REPO":
            return { ...state, repositories: [...state.repositories, action.payload] };
        case "SET_REPOS":
            return { ...state, repositories: action.payload };
        case "SELECT_REPO":
            if (action.payload) try { localStorage.setItem(LS_KEY, String(action.payload)); } catch {}
            // 레포 변경 시 PR 관련 상태 초기화
            return { ...state, selectedRepoId: action.payload, stagingArea: [], workingDirectory: [], currentView: "graph", prList: [], selectedPrId: null };
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
        case "REMOVE_REPO":
            return {
                ...state,
                repositories: state.repositories.filter(repo => repoIdOf(repo) !== action.payload),
                selectedRepoId: state.selectedRepoId === action.payload ? null : state.selectedRepoId,
            };
        case "OPEN_CONFLICT_MODAL":
            return { ...state, conflictInfo: { ...(state.conflictInfo || {}), open: true } };
        case "CLOSE_CONFLICT_MODAL":
            return { ...state, conflictInfo: { ...(state.conflictInfo || {}), open: false } };

        case "GRAPH_TICK": {
            return { ...state, graphVersion: (state.graphVersion || 0) + 1};
            }

        case "SET_VIEW":
            // PR 목록 뷰로 갈 때, 선택된 PR ID 초기화
            return { ...state, currentView: action.payload, selectedPrId: action.payload === 'prs' ? null : state.selectedPrId };
        case "SET_PRS":
            return { ...state, prList: action.payload };

        // [신규] PR 상세 뷰로 이동
        case "SELECT_PR":
            return { ...state, currentView: 'pr_detail', selectedPrId: action.payload };

        default:
            return state;
    }
}

export function GitProvider({ children }) {
    const [state, dispatch] = useReducer(reducer, initial);

    useEffect(() => {
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