import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from "react";
import { repoIdOf } from "./gitUtils";
import { LAST_REPO_KEY } from "../../lib/storageKeys";
import type { GitAction, GitState } from "../../types/git";

interface GitContextValue {
    state: GitState;
    dispatch: Dispatch<GitAction>;
}

const GitContext = createContext<GitContextValue | null>(null);

const initial: GitState = {
    repositories: [],
    selectedRepoId: "",
    workingDirectory: [],
    stagingArea: [],
    graphVersion: 0,
    gitStatusCounter: 0,
    animationMode: "idle",
    animationTick: 0,
    transferSnapshot: null,
    eventLog: [],
    conflictInfo: { open: false },
    currentView: "graph",
    prList: [],
    selectedPrId: null,
    collaboratorModal: { open: false, repoId: null },
    prCreateModalOpen: false,
    suggestedWorkflowSteps: [],
    workflowGuide: null,
};

function reducer(state: GitState, action: GitAction): GitState {
    switch (action.type) {
        case "ADD_REPO":
            return { ...state, repositories: [...state.repositories, action.payload] };
        case "SET_REPOS":
            return { ...state, repositories: action.payload };
        case "SELECT_REPO":
            if (action.payload) {
                try { localStorage.setItem(LAST_REPO_KEY, String(action.payload)); } catch { /* storage unavailable */ }
            }
            // 저장소 변경 시 PR 관련 상태 초기화
            return {
                ...state,
                selectedRepoId: action.payload,
                stagingArea: [],
                workingDirectory: [],
                currentView: "graph",
                prList: [],
                selectedPrId: null,
                collaboratorModal: { open: false, repoId: null },
            };
        case "ADD_SELECTED":
            return {
                ...state,
                stagingArea: Array.from(new Set([...state.stagingArea, ...action.payload])),
                gitStatusCounter: state.gitStatusCounter + 1, // StagedDiffView 업데이트를 위해
            };
        case "SET_STAGING_AREA":
            return {
                ...state,
                stagingArea: Array.isArray(action.payload) ? action.payload : [],
                gitStatusCounter: state.gitStatusCounter + 1,
            };
        case "REMOVE_FROM_STAGING": {
            const stagingArea = state.stagingArea.filter((n) => n !== action.payload);
            return {
                ...state,
                stagingArea,
                gitStatusCounter: state.gitStatusCounter + 1,
                // 스테이징 영역이 비면 워크플로우 리셋을 위한 플래그
                workflowResetNeeded: stagingArea.length === 0,
            };
        }
        case "COMMIT_SUCCESS":
            return { ...state, stagingArea: [], eventLog: [...state.eventLog, { t: Date.now(), kind: "commit", msg: action.message }] };
        case "GRAPH_DIRTY":
        case "GRAPH_TICK":
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
                repositories: state.repositories.filter((repo) => repoIdOf(repo) !== action.payload),
                selectedRepoId: state.selectedRepoId === action.payload ? null : state.selectedRepoId,
            };
        case "OPEN_CONFLICT_MODAL":
            return { ...state, conflictInfo: { ...state.conflictInfo, open: true } };
        case "CLOSE_CONFLICT_MODAL":
            return { ...state, conflictInfo: { ...state.conflictInfo, open: false } };
        case "SET_VIEW":
            // PR 목록 뷰로 갈 때, 선택된 PR ID 초기화
            return { ...state, currentView: action.payload, selectedPrId: action.payload === "prs" ? null : state.selectedPrId };
        case "SET_PRS":
            return { ...state, prList: action.payload };
        case "SELECT_PR":
            return { ...state, currentView: "pr_detail", selectedPrId: action.payload };
        case "OPEN_COLLABORATOR_MODAL":
            return {
                ...state,
                collaboratorModal: { open: true, repoId: action.payload?.repoId || state.selectedRepoId || null },
            };
        case "CLOSE_COLLABORATOR_MODAL":
            return { ...state, collaboratorModal: { open: false, repoId: null } };
        case "OPEN_PR_CREATE_MODAL":
            return { ...state, prCreateModalOpen: true };
        case "CLOSE_PR_CREATE_MODAL":
            return { ...state, prCreateModalOpen: false };
        case "SET_SUGGESTED_WORKFLOW_STEPS":
            return { ...state, suggestedWorkflowSteps: action.payload || [] };
        case "CLEAR_SUGGESTED_WORKFLOW_STEPS":
            return { ...state, suggestedWorkflowSteps: [], workflowGuide: null };
        case "SET_WORKFLOW_GUIDE":
            return { ...state, workflowGuide: action.payload };
        default:
            return state;
    }
}

export function GitProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(reducer, initial);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(LAST_REPO_KEY);
            if (saved) dispatch({ type: "SELECT_REPO", payload: saved });
        } catch { /* storage unavailable */ }
    }, []);

    return <GitContext.Provider value={{ state, dispatch }}>{children}</GitContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGit(): GitContextValue {
    const ctx = useContext(GitContext);
    if (!ctx) throw new Error("useGit must be used within GitProvider");
    return ctx;
}
