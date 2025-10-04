export const SELECT_REPO = "SELECT_REPO";
export const ADD_SELECTED = "ADD_SELECTED";
export const REMOVE_FROM_STAGING = "REMOVE_FROM_STAGING";

export const PULL_SUCCESS = "PULL_SUCCESS";
export const ADD_SUCCESS = "ADD_SUCCESS";
export const COMMIT_SUCCESS = "COMMIT_SUCCESS";
export const PUSH_SUCCESS = "PUSH_SUCCESS";

export const SET_GRAPH = "SET_GRAPH";
export const SET_BRANCHES = "SET_BRANCHES";

export const selectRepo = (id) => ({type: SELECT_REPO, payload: id});
export const addSelectedLocal = (files) => ({type: ADD_SELECTED, payload: files});
export const removeFromStaging = (name) => ({type: REMOVE_FROM_STAGING, payload: name});

export const applyPull = () => ({type: PULL_SUCCESS});
export const applyAdd = (files) => ({type: ADD_SUCCESS, files});
export const applyCommit = (message) => ({type: COMMIT_SUCCESS, message});
export const applyPush = (branch) => ({type: PUSH_SUCCESS, branch});

export const setGraph = (graph) => ({type: SET_GRAPH, payload: graph});
export const setBranches = (branches) => ({type: SET_BRANCHES, branches});
