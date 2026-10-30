import type { GraphCommit, Id, PullRequest, Repo } from "./api";

// 초보자용 워크플로우 단계 (가져오기 → 담기 → 저장 → 올리기 → 변경요청)
export type WorkflowStep = "pull" | "add" | "commit" | "push" | "pr";

export interface WorkflowGuideStep {
    step: WorkflowStep;
    stepNum: number | "pr";
    label: string;
    icon: string;
    explanation: string;
    index: number;
}

export interface WorkflowGuide {
    steps: WorkflowGuideStep[];
}

export interface WorkflowSuggestion {
    steps: WorkflowStep[];
    suggestions: string[];
}

export type AnimationMode = "idle" | "pull" | "add" | "commit" | "push";

export interface TransferFileSummary {
    path: string;
    count?: number;
    [key: string]: unknown;
}

export interface TransferSnapshot {
    type: "pull" | "push";
    branch: string;
    commits: GraphCommit[];
    files: TransferFileSummary[] | unknown[];
}

export type GitView = "graph" | "files" | "prs" | "pr_detail" | "diff" | string;

export interface GitEvent {
    t: number;
    kind?: string;
    msg?: string;
    [key: string]: unknown;
}

export interface GitState {
    repositories: Repo[];
    selectedRepoId: Id | null;
    workingDirectory: string[];
    stagingArea: string[];
    graphVersion: number;
    gitStatusCounter: number; // git status 변경 감지용 카운터
    animationMode: AnimationMode;
    animationTick: number;
    transferSnapshot: TransferSnapshot | null;
    eventLog: GitEvent[];
    conflictInfo: { open: boolean };
    currentView: GitView;
    prList: PullRequest[];
    selectedPrId: Id | null;
    collaboratorModal: { open: boolean; repoId: Id | null };
    prCreateModalOpen: boolean;
    suggestedWorkflowSteps: WorkflowStep[]; // ActionButtons와 공유
    workflowGuide: WorkflowGuide | null; // ActionButtons와 공유
    workflowResetNeeded?: boolean;
}

export type GitAction =
    | { type: "ADD_REPO"; payload: Repo }
    | { type: "SET_REPOS"; payload: Repo[] }
    | { type: "SELECT_REPO"; payload: Id | null }
    | { type: "REMOVE_REPO"; payload: Id }
    | { type: "ADD_SELECTED"; payload: string[] }
    | { type: "SET_STAGING_AREA"; payload: string[] }
    | { type: "REMOVE_FROM_STAGING"; payload: string }
    | { type: "COMMIT_SUCCESS"; message?: string }
    | { type: "GRAPH_DIRTY" }
    | { type: "GRAPH_TICK" }
    | { type: "SET_TRANSFER"; payload: TransferSnapshot | null }
    | { type: "SET_ANIMATION_START"; payload: AnimationMode }
    | { type: "SET_ANIMATION_END" }
    | { type: "LOG_EVENT"; payload: Omit<GitEvent, "t"> }
    | { type: "OPEN_CONFLICT_MODAL" }
    | { type: "CLOSE_CONFLICT_MODAL" }
    | { type: "SET_VIEW"; payload: GitView }
    | { type: "SET_PRS"; payload: PullRequest[] }
    | { type: "SELECT_PR"; payload: Id }
    | { type: "OPEN_COLLABORATOR_MODAL"; payload?: { repoId?: Id | null } }
    | { type: "CLOSE_COLLABORATOR_MODAL" }
    | { type: "OPEN_PR_CREATE_MODAL" }
    | { type: "CLOSE_PR_CREATE_MODAL" }
    | { type: "SET_SUGGESTED_WORKFLOW_STEPS"; payload: WorkflowStep[] }
    | { type: "CLEAR_SUGGESTED_WORKFLOW_STEPS" }
    | { type: "SET_WORKFLOW_GUIDE"; payload: WorkflowGuide | null };
