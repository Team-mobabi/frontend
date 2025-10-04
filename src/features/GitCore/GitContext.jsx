import React, { createContext, useContext, useMemo, useReducer } from "react";
import { normalizeRepo, repoIdOf } from "./repoUtils.js";

const GitContext = createContext(null);

const initialState = {
    repositories: [],
    selectedRepoId: null,
    workingDirectory: [],
    stagingArea: [],
    commits: [],
};

function reducer(state, action) {
    switch (action.type) {
        case "SET_REPOS": {
            const raw = Array.isArray(action.payload) ? action.payload : [];
            const repos = raw.map(normalizeRepo).filter((r) => repoIdOf(r));
            const keep = state.selectedRepoId && repos.some((r) => repoIdOf(r) === String(state.selectedRepoId));
            const nextSelected = keep ? String(state.selectedRepoId) : (repos[0]?.id ?? null);
            return { ...state, repositories: repos, selectedRepoId: nextSelected };
        }
        case "SELECT_REPO": {
            const id = action.payload == null ? null : String(action.payload);
            return { ...state, selectedRepoId: id, stagingArea: [], commits: [] };
        }
        case "SET_WORKING_DIR":
            return { ...state, workingDirectory: action.payload || [] };
        case "ADD_SELECTED": {
            const names = Array.isArray(action.payload) ? action.payload : [];
            const next = [...new Set([...state.stagingArea, ...names])];
            return { ...state, stagingArea: next };
        }
        case "REMOVE_FROM_STAGING":
            return { ...state, stagingArea: state.stagingArea.filter((n) => n !== action.payload) };
        case "COMMIT_SUCCESS":
            return { ...state, stagingArea: [] };
        default:
            return state;
    }
}

export function GitProvider({ children }) {
    const [state, dispatch] = useReducer(reducer, initialState);
    const value = useMemo(() => ({ state, dispatch }), [state]);
    return <GitContext.Provider value={value}>{children}</GitContext.Provider>;
}

export function useGit() {
    const ctx = useContext(GitContext);
    if (!ctx) throw new Error("useGit must be used within GitProvider");
    return ctx;
}
