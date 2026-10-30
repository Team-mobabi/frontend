import { createLogger } from "./logger";
import type {
    AiAnswer,
    AuthTokens,
    BranchListResponse,
    CloneRepoPayload,
    Collaborator,
    CollaboratorRole,
    ConflictSuggestion,
    CreateRepoPayload,
    DiffResponse,
    DiffStats,
    FileListResponse,
    Id,
    MergeResult,
    PaginatedRepos,
    PullRequest,
    PullRequestReview,
    PullResult,
    PushResult,
    QueryParams,
    RemotePayload,
    Repo,
    RepoGraph,
    RepoStatus,
    User,
} from "../types/api";

const log = createLogger("api");

const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.__API_BASE_URL__ || "";
const DEBUG = String(import.meta.env.VITE_API_DEBUG ?? import.meta.env.DEV).toLowerCase() === "true";

// 배포 경로(/mobabi/ui/) 기준 루트. vite의 base 설정을 따른다
const APP_BASE = import.meta.env.BASE_URL || "/";

const TOKEN_KEY = "gitgui_token";
const REFRESH_TOKEN_KEY = "gitgui_refreshToken";

export function getToken(): string {
    try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}

export function getRefreshToken(): string {
    try { return localStorage.getItem(REFRESH_TOKEN_KEY) || ""; } catch { return ""; }
}

export function setToken(accessToken?: string, refreshToken?: string): void {
    try {
        if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken);
        if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    } catch { /* storage unavailable */ }
}

export function clearToken(): void {
    try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
    } catch { /* storage unavailable */ }
}

function qs(params?: QueryParams): string {
    if (!params) return "";
    const entries = Object.entries(params)
        .filter(([, v]) => v != null)
        .map(([k, v]) => [k, String(v)]);
    const q = new URLSearchParams(entries).toString();
    return q ? `?${q}` : "";
}

export interface ApiErrorData {
    message?: string | string[];
    error?: string;
    [key: string]: unknown;
}

export class ApiError extends Error {
    status?: number;
    data?: ApiErrorData | null;

    constructor(message: string, status?: number, data?: ApiErrorData | null) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.data = data;
    }
}

// 서버/네트워크 에러에서 사용자에게 보여줄 메시지를 꺼낸다
export function errorMessage(err: unknown, fallback = "요청에 실패했습니다."): string {
    if (err instanceof ApiError) {
        const m = err.data?.message;
        if (Array.isArray(m)) return m.join("\n");
        return m || err.message || fallback;
    }
    if (err instanceof Error) return err.message || fallback;
    return fallback;
}

function lowerMessage(err: unknown): string {
    const msg = err instanceof ApiError ? err.data?.message ?? err.message : err instanceof Error ? err.message : "";
    return (Array.isArray(msg) ? msg.join(" ") : msg || "").toLowerCase();
}

// git 충돌로 인한 실패인지 판별 (409 또는 git 충돌 메시지)
export function isConflictError(err: unknown): boolean {
    const msg = lowerMessage(err);
    return (
        (err instanceof ApiError && err.status === 409) ||
        /conflict/.test(msg) ||
        /unmerged/.test(msg) ||
        /merging is not possible/.test(msg) ||
        /exiting because of an unresolved conflict/.test(msg)
    );
}

// 이전 병합이 끝나지 않은 상태에서 다시 시도했는지 판별
export function isMergeInProgressError(err: unknown): boolean {
    const msg = lowerMessage(err);
    return /you have not concluded your merge|merge_head exists/.test(msg);
}

type RequestBody = FormData | URLSearchParams | object | null | undefined;

interface RequestOptions {
    headers?: Record<string, string>;
    signal?: AbortSignal;
    responseType?: "json" | "blob" | "text";
    isRetry?: boolean;
}

let isRefreshing = false;
let failedQueue: { resolve: (token: string) => void; reject: (err: unknown) => void }[] = [];

function processQueue(error: unknown, token: string | null) {
    failedQueue.forEach((p) => (error || !token ? p.reject(error) : p.resolve(token)));
    failedQueue = [];
}

function isAuthEndpoint(path: string): boolean {
    return path.startsWith("/auth/signin") || path.startsWith("/auth/signup") || path.startsWith("/auth/refresh");
}

async function request<T = unknown>(
    method: string,
    path: string,
    body?: RequestBody,
    options: RequestOptions = {},
): Promise<T> {
    const authToken = getToken();
    if (DEBUG) log.debug(`→ ${method} ${BASE_URL + path}`, { hasToken: !!authToken });

    const headers: Record<string, string> = { ...options.headers };
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

    // 재시도 시 원본 body를 다시 넘기므로 인자를 직접 변경하지 않는다 (이중 stringify 방지)
    let payload: BodyInit | undefined;
    if (body instanceof FormData) {
        payload = body;
    } else if (body instanceof URLSearchParams) {
        headers["Content-Type"] = "application/x-www-form-urlencoded";
        payload = body;
    } else if (body) {
        headers["Content-Type"] = "application/json";
        payload = JSON.stringify(body);
    } else if (method === "POST" || method === "PUT" || method === "PATCH") {
        headers["Content-Type"] = "application/json";
    }

    try {
        const res = await fetch(BASE_URL + path, { method, headers, body: payload, signal: options.signal });

        if (res.ok) {
            if (options.responseType === "blob") return (await res.blob()) as T;
            if (options.responseType === "text") return (await res.text()) as T;
            if (res.status === 204) return null as T;
            // chunked 응답 등 content-length 없이 본문이 빈 경우도 안전하게 처리
            const text = await res.text();
            return (text ? JSON.parse(text) : null) as T;
        }

        let data: ApiErrorData | null = null;
        try { data = await res.json(); } catch { /* non-JSON error body */ }

        if (DEBUG) log.debug(`← ${res.status} ${path}`, data);

        if (res.status === 401 && !options.isRetry && !isAuthEndpoint(path)) {
            const retry = (token: string) =>
                request<T>(method, path, body, { ...options, headers: { ...headers, Authorization: `Bearer ${token}` }, isRetry: true });

            if (isRefreshing) {
                return new Promise<string>((resolve, reject) => failedQueue.push({ resolve, reject })).then(retry);
            }

            isRefreshing = true;
            const rToken = getRefreshToken();
            if (!rToken) {
                isRefreshing = false;
                clearToken();
                window.location.assign(APP_BASE);
                throw new ApiError("No refresh token", 401);
            }

            try {
                const refreshRes = await fetch(BASE_URL + "/auth/refresh", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refreshToken: rToken }),
                });
                if (!refreshRes.ok) throw new ApiError("Failed to refresh token", refreshRes.status);

                const tokens = (await refreshRes.json()) as AuthTokens;
                setToken(tokens.accessToken, tokens.refreshToken);
                processQueue(null, tokens.accessToken);
                return await retry(tokens.accessToken);
            } catch (refreshError) {
                processQueue(refreshError, null);
                clearToken();
                window.location.assign(APP_BASE);
                throw refreshError;
            } finally {
                isRefreshing = false;
            }
        }

        const msg = data?.message || data?.error || `HTTP ${res.status} ${res.statusText}`;
        throw new ApiError(Array.isArray(msg) ? msg[0] : msg, res.status, data);
    } catch (err) {
        if (DEBUG && err instanceof ApiError) log.debug("request failed", err.status, err.data || err.message);
        throw err;
    }
}

// AI 호출은 오래 걸리므로 별도 타임아웃(기본 180초)을 둔다
function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ms);
    return run(controller.signal).finally(() => clearTimeout(timeoutId));
}

export interface UploadResult {
    saved: string[];
}

interface UploadResponse {
    uploadedFiles?: { path: string }[];
    saved?: string[];
    paths?: string[];
    files?: string[];
}

export const api = {
    auth: {
        signup: (payload: { email: string; password: string; username?: string }) =>
            request<{ message: string }>("POST", "/auth/signup", payload),
        login: async (payload: { email: string; password: string }): Promise<AuthTokens> => {
            const data = await request<Partial<AuthTokens>>("POST", "/auth/signin", payload);
            if (!data?.accessToken || !data?.refreshToken) {
                throw new ApiError("로그인 토큰을 받지 못했습니다.");
            }
            setToken(data.accessToken, data.refreshToken);
            return { accessToken: data.accessToken, refreshToken: data.refreshToken };
        },
        logout: async (): Promise<void> => {
            try {
                await request("POST", "/auth/logout");
            } catch (e) {
                log.warn("Logout API failed, clearing token regardless.", e);
            }
            clearToken();
        },
        refresh: (refreshToken: string) => request<AuthTokens>("POST", "/auth/refresh", { refreshToken }),
    },
    email: {
        sendVerification: (payload: { email: string }) => request("POST", "/email/send-verification", payload),
        verifyCode: (payload: { email: string; code: string }) => request("POST", "/email/verify-code", payload),
    },
    users: {
        me: () => request<User>("GET", "/users/me"),
        changePassword: (payload: { currentPassword: string; newPassword: string }) =>
            request("PATCH", "/users/password", payload),
        deleteAccount: () => request("DELETE", "/users/me"),
        search: (params: QueryParams) => request<User[] | { users?: User[] }>("GET", `/users/search${qs(params)}`),
    },
    collaborators: {
        add: (repoId: Id, payload: { userId: Id; role: CollaboratorRole }) =>
            request("POST", `/repos/${repoId}/collaborators`, payload),
        list: (repoId: Id) => request<Collaborator[] | { collaborators?: Collaborator[] }>("GET", `/repos/${repoId}/collaborators`),
        updateRole: (repoId: Id, userId: Id, payload: { role: CollaboratorRole }) =>
            request("PATCH", `/repos/${repoId}/collaborators/${userId}`, payload),
        remove: (repoId: Id, userId: Id) => request("DELETE", `/repos/${repoId}/collaborators/${userId}`),
    },
    repos: {
        create: (payload: CreateRepoPayload) => request<Repo>("POST", "/repos", payload),
        list: (params?: QueryParams) => request<Repo[] | PaginatedRepos>("GET", `/repos${qs(params)}`),
        remove: (id: Id) => request("DELETE", `/repos/${id}`),
        listPublic: (params?: QueryParams) => request<Repo[] | PaginatedRepos>("GET", `/repos/public${qs(params)}`),
        listPublicByUser: (userId: Id, params?: QueryParams) =>
            request<Repo[] | PaginatedRepos>("GET", `/repos/public/user/${userId}${qs(params)}`),
        fork: (sourceRepoId: Id) => request<Repo>("POST", "/repos/fork", { sourceRepoId }),
        clone: (payload: CloneRepoPayload) => request<Repo>("POST", "/repos/clone", payload),
        addRemote: (id: Id, payload: RemotePayload) => request("POST", `/repos/${id}/remote`, payload),
        addLocalRemote: (id: Id, payload?: RemotePayload) => request("POST", `/repos/${id}/remote-local`, payload ?? {}),
        status: (id: Id) => request<RepoStatus>("GET", `/repos/${id}/status`),
        add: (id: Id, files: string[]) => request("POST", `/repos/${id}/add`, { files }),
        commit: (id: Id, message: string) => request("POST", `/repos/${id}/commit`, { message }),
        reset: (id: Id, payload: { mode?: string; commit?: string; [key: string]: unknown }) =>
            request("POST", `/repos/${id}/reset`, payload),
        pull: (id: Id, body?: { remote?: string; branch?: string }) => request<PullResult>("POST", `/repos/${id}/pull`, body ?? {}),
        push: (id: Id, body?: { remote?: string; branch?: string; force?: boolean; setUpstream?: boolean }) => request<PushResult>("POST", `/repos/${id}/push`, body ?? {}),
        graph: (id: Id, params?: QueryParams) => request<RepoGraph>("GET", `/repos/${id}/graph${qs(params)}`),
        merge: (id: Id, payload: { sourceBranch: string; [key: string]: unknown }) =>
            request<MergeResult>("POST", `/repos/${id}/merge`, payload),
        abortMerge: (id: Id) => request("POST", `/repos/${id}/merge/abort`),
        listFiles: (id: Id, params?: QueryParams) => request<FileListResponse>("GET", `/repos/${id}/files${qs(params)}`),
        createFile: (id: Id, payload: { path: string; content?: string; [key: string]: unknown }) =>
            request("POST", `/repos/${id}/files`, payload),
        updateFile: (id: Id, payload: { path: string; content: string; [key: string]: unknown }) =>
            request("PATCH", `/repos/${id}/files`, payload),
        deleteFile: (id: Id, params: QueryParams) => request("DELETE", `/repos/${id}/files${qs(params)}`),
        upload: async (id: Id, fileList: File[]): Promise<UploadResult> => {
            const fd = new FormData();
            fileList.forEach((f) => {
                fd.append("files", f, f.name);
                fd.append("paths", f.webkitRelativePath || f.name);
            });
            const up = await request<UploadResponse | null>("POST", `/repos/${id}/files`, fd);
            const saved = up?.uploadedFiles?.map((f) => f.path) || up?.saved || up?.paths || up?.files || [];
            return { saved: Array.isArray(saved) ? saved : [] };
        },
        conflicts: (id: Id) => request<{ conflicts?: unknown; files?: string[]; conflictFiles?: string[]; hasConflict?: boolean }>("GET", `/repos/${id}/conflicts`),
        suggestConflictResolution: (id: Id, filePath: string) =>
            withTimeout(180_000, (signal) =>
                request<ConflictSuggestion>("POST", `/repos/${id}/conflicts/ai-suggest`, { filePath }, { signal }),
            ),
        resolveConflict: (id: Id, resolution: { filePath: string; content?: string; [key: string]: unknown }) =>
            request("POST", `/repos/${id}/conflicts/resolve`, resolution),
        downloadFile: (id: Id, params: QueryParams) =>
            request<Blob>("GET", `/repos/${id}/files/download${qs(params)}`, null, { responseType: "blob" }),
        download: (id: Id, params?: QueryParams) =>
            request<Blob>("GET", `/repos/${id}/download${qs(params)}`, null, { responseType: "blob" }),
        diffStats: (id: Id) => request<DiffStats>("GET", `/repos/${id}/diff/stats`),
        diffWorking: (id: Id, params?: QueryParams) => request<DiffResponse>("GET", `/repos/${id}/diff/working${qs(params)}`),
        diffStaged: (id: Id, params?: QueryParams) => request<DiffResponse>("GET", `/repos/${id}/diff/staged${qs(params)}`),
        diffCommits: (id: Id, commitA: string, commitB: string) =>
            request<DiffResponse>("GET", `/repos/${id}/diff/commits/${commitA}/${commitB}`),
        diffBranches: (id: Id, params?: QueryParams) => request<DiffResponse>("GET", `/repos/${id}/diff/branches${qs(params)}`),
        diffCommit: (id: Id, hash: string) => request<DiffResponse>("GET", `/repos/${id}/diff/commit/${hash}`),
        diffFiles: (id: Id, params?: QueryParams) => request<DiffResponse>("GET", `/repos/${id}/diff/files${qs(params)}`),
    },
    branches: {
        list: (id: Id, params?: QueryParams) => request<BranchListResponse>("GET", `/repos/${id}/branches${qs(params)}`),
        create: (id: Id, body: { name: string; from?: string; [key: string]: unknown }) =>
            request("POST", `/repos/${id}/branches`, body),
        switch: (id: Id, name: string) => request("POST", `/repos/${id}/branches/switch`, { name }),
        remove: (id: Id, branchName: string) => request("DELETE", `/repos/${id}/branches/${branchName}`),
    },
    pullRequests: {
        create: (repoId: Id, payload: { title: string; description?: string; sourceBranch: string; targetBranch: string }) =>
            request<PullRequest>("POST", `/repos/${repoId}/pull-requests`, payload),
        list: (repoId: Id) => request<PullRequest[] | { pullRequests?: PullRequest[] }>("GET", `/repos/${repoId}/pull-requests`),
        get: (repoId: Id, prId: Id) => request<PullRequest>("GET", `/repos/${repoId}/pull-requests/${prId}`),
        merge: (repoId: Id, prId: Id) => request<MergeResult>("POST", `/repos/${repoId}/pull-requests/${prId}/merge`),
        close: (repoId: Id, prId: Id) => request("POST", `/repos/${repoId}/pull-requests/${prId}/close`),
        diff: (repoId: Id, prId: Id) => request<DiffResponse>("GET", `/repos/${repoId}/pull-requests/${prId}/diff`),
        createReview: (repoId: Id, prId: Id, payload: { status: string; comment?: string }) =>
            request<PullRequestReview>("POST", `/repos/${repoId}/pull-requests/${prId}/reviews`, payload),
        listReviews: (repoId: Id, prId: Id) =>
            request<PullRequestReview[] | { reviews?: PullRequestReview[]; data?: PullRequestReview[]; items?: PullRequestReview[] }>("GET", `/repos/${repoId}/pull-requests/${prId}/reviews`),
    },
    aiAssistant: {
        ask: (repoId: Id, question: string) => request<AiAnswer>("POST", `/repos/${repoId}/ai/ask`, { question }),
        suggestNext: (repoId: Id) => request<AiAnswer>("GET", `/repos/${repoId}/ai/suggest-next`),
    },
};
