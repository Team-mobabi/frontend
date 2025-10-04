export const initialState = {
    repositories: [],
    selectedRepoId: null,
    workingDirectory: [],
    stagingArea: [],
    localRepo: { branches: { main: [] }, currentBranch: "main", head: null, commitCount: 0 },
    remoteRepo: { branches: { main: [] } },
    animationStatus: null,
};

export function gitReducer(state, action) {
    switch (action.type) {
        case "SET_REPOS": {
            const repos = Array.isArray(action.payload) ? action.payload : [];
            const firstId = repos[0]?.id ?? null;
            return { ...state, repositories: repos, selectedRepoId: firstId };
        }
        case "SELECT_REPO": {
            return {
                ...state,
                selectedRepoId: action.payload,
                stagingArea: [],
                workingDirectory: [],
                localRepo: { branches: { main: [] }, currentBranch: "main", head: null, commitCount: 0 },
                remoteRepo: { branches: { main: [] } },
                animationStatus: null,
            };
        }
        case "ADD_SELECTED":
            return { ...state, stagingArea: [...new Set([...(state.stagingArea || []), ...(action.payload || [])])] };
        case "REMOVE_FROM_STAGING":
            return { ...state, stagingArea: (state.stagingArea || []).filter((f) => f !== action.payload) };
        case "COMMIT_SUCCESS":
            return { ...state, stagingArea: [] };
        default:
            return state;
    }
}
