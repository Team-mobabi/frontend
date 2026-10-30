// 백엔드(Team-mobabi/backend) 응답 형태. 서버가 버전에 따라 필드명을 바꿔온 경우는 optional로 둔다.

export type Id = string;

export interface User {
    id: Id;
    email: string;
    username?: string;
    displayName?: string;
    name?: string;
    fullName?: string;
    nickName?: string;
    nickname?: string;
    createdAt?: string;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}

export interface RepoOwner {
    id: Id;
    email: string;
    name?: string;
    login?: string;
}

export interface Repo {
    id?: Id;
    repoId?: Id;
    repositoryId?: Id;
    ownerId?: Id;
    name: string;
    description?: string | null;
    isPrivate?: boolean;
    forkedFrom?: Id | null;
    createdAt?: string;
    updatedAt?: string;
    pushedAt?: string;
    defaultBranch?: string;
    owner?: RepoOwner;
}

export interface PaginatedRepos {
    repos?: Repo[];
    repositories?: Repo[];
    items?: Repo[];
    data?: Repo[];
    total?: number;
}

export interface CreateRepoPayload {
    name: string;
    description?: string;
    isPrivate?: boolean;
    defaultBranch?: string;
}

export interface CloneRepoPayload {
    url: string;
    name?: string;
    description?: string;
    isPrivate?: boolean;
}

export interface RemotePayload {
    url?: string;
    name?: string;
}

export type FileStatusCode = "added" | "modified" | "deleted" | "untracked" | "renamed" | string;

export interface StatusFile {
    path?: string;
    file?: string;
    name?: string;
    status?: FileStatusCode;
    staged?: boolean;
}

export interface RepoStatus {
    files?: StatusFile[];
    isEmpty?: boolean;
    currentBranch?: string;
    ahead?: number;
    behind?: number;
    merging?: boolean;
    isMerging?: boolean;
    mergeInProgress?: boolean;
    mergeHead?: string;
    [key: string]: unknown;
}

export interface GraphCommit {
    hash: string;
    shortHash?: string;
    message?: string;
    author?: string;
    msg?: string;
    committer?: string;
    date?: string;
    committedAt?: string;
    parents?: string[];
    isMerge?: boolean;
    branch?: string;
    branches?: string[];
    // 이 커밋을 HEAD로 가리키는 브랜치 이름
    isHead?: string | null;
    remoteIsHead?: string | null;
    files?: string[];
}

export interface GraphSide {
    currentBranch?: string | null;
    branchHeads?: Record<string, string>;
    commits?: GraphCommit[];
    forkPoints?: Record<string, string>;
    branches?: Record<string, GraphCommit[]>;
}

export interface RepoGraph extends GraphSide {
    local?: GraphSide;
    remote?: GraphSide;
}

export interface Branch {
    name: string;
    branch?: string;
    current?: boolean;
    commit?: string;
}

export type BranchListResponse = Branch[] | { branches?: (Branch | string)[]; current?: string };

export interface PullResult {
    success: boolean;
    fastForward?: boolean;
    from?: string;
    to?: string;
    hasConflict?: boolean;
    conflictFiles?: string[];
}

export interface PushResult {
    success: boolean;
    upToDate?: boolean;
    pushed?: unknown[];
}

export interface MergeResult extends PullResult {
    sourceBranch?: string;
    targetBranch?: string;
    mergeCommitHash?: string;
}

export interface FileEntry {
    name: string;
    path: string;
    type?: "file" | "directory" | string;
    size?: number;
}

export interface FileListResponse {
    files?: FileEntry[];
    folders?: FileEntry[];
    content?: string;
    [key: string]: unknown;
}

export interface DiffStats {
    filesChanged?: number;
    totalInsertions?: number;
    totalDeletions?: number;
    insertions?: number;
    deletions?: number;
    additions?: number;
    // 서버가 파일 수를 숫자로 주는 경우도 있다
    files?: number | { path?: string; file?: string; insertions?: number; deletions?: number }[];
}

export interface DiffResponse {
    diff?: string;
    files?: unknown[];
    [key: string]: unknown;
}

export interface ConflictSuggestion {
    suggestion?: string;
    resolvedContent?: string;
    explanation?: string;
    confidence?: number;
    [key: string]: unknown;
}

export type CollaboratorRole = "read" | "write" | "admin" | string;

export interface Collaborator {
    id?: Id;
    userId: Id;
    role: CollaboratorRole;
    user?: User;
    email?: string;
}

export type PullRequestStatus = "open" | "merged" | "closed" | string;

export interface PullRequest {
    id: Id;
    title: string;
    description?: string;
    sourceBranch: string;
    targetBranch: string;
    status?: PullRequestStatus;
    state?: PullRequestStatus;
    author?: User | string;
    createdAt?: string;
}

export interface PullRequestReview {
    id: Id;
    status?: string;
    state?: string;
    comment?: string;
    body?: string;
    reviewer?: User;
    author?: User | string;
    createdAt?: string;
}

export interface AiAnswer {
    success?: boolean;
    answer?: string;
    message?: string;
    suggestedActions?: string[];
    relatedConcepts?: string[];
    [key: string]: unknown;
}

export type QueryParams = Record<string, string | number | boolean | null | undefined>;
