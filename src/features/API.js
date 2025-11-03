const BASE_URL =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
    (typeof window !== "undefined" && window.__API_BASE_URL__) ||
    "";
const DEBUG = String(import.meta.env?.VITE_API_DEBUG ?? import.meta.env?.DEV).toLowerCase() === "true";

const tokenKey = "gitgui_token";
const refreshTokenKey = "gitgui_refreshToken";

export function getToken() {
    try { return localStorage.getItem(tokenKey) || ""; } catch { return ""; }
}

export function getRefreshToken() {
    try { return localStorage.getItem(refreshTokenKey) || ""; } catch { return ""; }
}

export function setToken(accessToken, refreshToken) {
    try {
        if (accessToken) localStorage.setItem(tokenKey, accessToken);
        if (refreshToken) localStorage.setItem(refreshTokenKey, refreshToken);
    } catch {}
}

export function clearToken() {
    try {
        localStorage.removeItem(tokenKey);
        localStorage.removeItem(refreshTokenKey);
    } catch {}
}

function qs(params) {
    if (!params) return "";
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null)).toString();
    return q ? `?${q}` : "";
}

export function isConflictError(err) {
    const msg = (err?.data?.message || err?.message || "").toLowerCase();
    return (
        err?.status === 409 ||
        /conflict/.test(msg) ||
        /unmerged/.test(msg) ||
        /merging is not possible/.test(msg) ||
        /exiting because of an unresolved conflict/.test(msg)
    );
}

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

async function request(method, path, body, options = {}) {
    const authToken = getToken();
    if (DEBUG) console.info("[API →]", method, (BASE_URL || "") + path, { hasToken: !!authToken });

    const headers = { ...options.headers };
    if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
    }

    if (body) {
        if (body instanceof FormData) {
        } else if (body instanceof URLSearchParams) {
            headers["Content-Type"] = "application/x-www-form-urlencoded";
        } else {
            headers["Content-Type"] = "application/json";
            body = JSON.stringify(body);
        }
    } else if (method === "POST" || method === "PUT" || method === "PATCH") {
        headers["Content-Type"] = "application/json";
    }

    try {
        const res = await fetch((BASE_URL || "") + path, {
            method,
            headers,
            body,
            signal: options.signal,
        });

        if (res.ok) {
            if (options.responseType === "blob") return res.blob();
            if (options.responseType === "text") return res.text();
            if (res.status === 204 || res.headers.get("content-length") === "0") return null;
            return res.json();
        }

        let data = null;
        try { data = await res.json(); } catch {}

        if (DEBUG) console.info("[API ← ERR]", res.status, data);

        const isAuthEndpoint = path.startsWith("/auth/signin") ||
                               path.startsWith("/auth/signup") ||
                               path.startsWith("/auth/refresh");

        if (res.status === 401 && !options.isRetry && !isAuthEndpoint) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(newAccessToken => {
                    headers["Authorization"] = `Bearer ${newAccessToken}`;
                    return request(method, path, body, { ...options, headers, isRetry: true });
                });
            }

            isRefreshing = true;

            const rToken = getRefreshToken();
            if (!rToken) {
                clearToken();
                window.location.href = '/';
                return Promise.reject(new Error("No refresh token"));
            }

            try {
                const refreshRes = await fetch((BASE_URL || "") + "/auth/refresh", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refreshToken: rToken })
                });

                if (!refreshRes.ok) throw new Error("Failed to refresh token");

                const refreshData = await refreshRes.json();
                const newAccessToken = refreshData.accessToken;

                setToken(newAccessToken);
                processQueue(null, newAccessToken);

                headers["Authorization"] = `Bearer ${newAccessToken}`;
                return request(method, path, body, { ...options, headers, isRetry: true });

            } catch (refreshError) {
                processQueue(refreshError, null);
                clearToken();
                window.location.href = '/';
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        const msg = (data && (data.message || data.error)) || `HTTP ${res.status} ${res.statusText}`;
        const err = new Error(Array.isArray(msg) ? msg[0] : msg);
        err.status = res.status;
        err.data = data;
        throw err;
    } catch (err) {
        if (DEBUG) console.error("[API ← CATCH]", err.status, err.data || err.message);
        throw err;
    }
}

export const api = {
    auth: {
        register: (payload) => request("POST", "/auth/signup", payload),
        signup: (payload) => request("POST", "/auth/signup", payload), // register의 alias
        login: async (payload) => {
            const data = await request("POST", "/auth/signin", payload);
            const accessToken = data?.accessToken;
            const refreshToken = data?.refreshToken;
            if (accessToken && refreshToken) {
                setToken(accessToken, refreshToken);
                return { ...data, status: "authenticated" };
            }
            if (data?.status === "pending_verification") {
                return { ...data, status: "pending_verification" };
            }
            throw new Error("로그인 응답이 올바르지 않습니다.");
        },
        logout: async () => {
            try {
                await request("POST", "/auth/logout");
            } catch (e) {
                console.error("Logout API failed, clearing token regardless.", e);
            }
            clearToken();
            return true;
        },
        refresh: (refreshToken) => request("POST", "/auth/refresh", { refreshToken }),
        getToken,
    },
    email: {
        sendVerification: (payload) => request("POST", "/email/send-verification", payload),
        verifyCode: (payload) => request("POST", "/email/verify-code", payload),
    },
    users: {
        me: () => request("GET", "/users/me"),
        changePassword: (payload) => request("PATCH", "/users/password", payload),
        deleteAccount: () => request("DELETE", "/users/me"),
        search: (params) => {
            return request("GET", `/users/search${qs(params)}`);
        },
    },
    collaborators: {
        add: (repoId, payload) => request("POST", `/repos/${repoId}/collaborators`, payload),
        list: (repoId) => request("GET", `/repos/${repoId}/collaborators`),
        updateRole: (repoId, userId, payload) => request("PATCH", `/repos/${repoId}/collaborators/${userId}`, payload),
        remove: (repoId, userId) => request("DELETE", `/repos/${repoId}/collaborators/${userId}`),
    },
    repos: {
        create: (payload) => request("POST", `/repos`, payload),
        list: (params) => request("GET", `/repos${qs(params)}`),
        delete: (id) => request("DELETE", `/repos/${id}`),
        listPublic: (params) => request("GET", `/repos/public${qs(params)}`),
        listUserPublic: (userId, params) => request("GET", `/repos/public/user/${userId}${qs(params)}`),
        fork: (repoIdToFork) => request("POST", `/repos/fork`, { sourceRepoId: repoIdToFork }),
        addRemote: (id, payload) => request("POST", `/repos/${id}/remote`, payload),
        addLocalRemote: (id, payload) => request("POST", `/repos/${id}/remote-local`, payload),
        status: (id) => request("GET", `/repos/${id}/status`),
        add: (id, files) => request("POST", `/repos/${id}/add`, { files }), // 배열 -> { files: 배열 }
        commit: (id, message) => request("POST", `/repos/${id}/commit`, { message }),
        reset: (id, payload) => request("POST", `/repos/${id}/reset`, payload),
        pull: (id, body) => request("POST", `/repos/${id}/pull`, body),
        push: (id, body) => request("POST", `/repos/${id}/push`, body),
        graph: (id, params) => request("GET", `/repos/${id}/graph${qs(params)}`),
        merge: (id, payload) => request("POST", `/repos/${id}/merge`, payload),
        abortMerge: (id) => request("POST", `/repos/${id}/merge/abort`),
        getFiles: (id, params) => request("GET", `/repos/${id}/files${qs(params)}`),
        createFile: (id, payload) => request("POST", `/repos/${id}/files`, payload),
        updateFile: (id, payload) => request("PATCH", `/repos/${id}/files`, payload),
        deleteFile: (id, params) => request("DELETE", `/repos/${id}/files${qs(params)}`),
        upload: async (id, fileList) => {
            const fd = new FormData();
            fileList.forEach((f, index) => {
                const relativePath = f.webkitRelativePath || f.name;
                fd.append("files", f, f.name);
                fd.append("paths", relativePath);
            });
            const up = await request("POST", `/repos/${id}/files`, fd); // upload -> files
            let saved = (up && (up.uploadedFiles?.map(f=>f.path) || up.saved || up.paths || up.files || [])) || [];
            if (!Array.isArray(saved)) saved = [];
            return { saved };
        },
        conflicts: (id) => request("GET", `/repos/${id}/conflicts`),
        aiSuggest: (id, filePath) => request("POST", `/repos/${id}/conflicts/ai-suggest`, { filePath }),
        resolve: (id, resolution) => request("POST", `/repos/${id}/conflicts/resolve`, resolution),
        diffStats: (id) => request("GET", `/repos/${id}/diff/stats`),
        diffWorking: (id, params) => request("GET", `/repos/${id}/diff/working${qs(params)}`),
        diffStaged: (id, params) => request("GET", `/repos/${id}/diff/staged${qs(params)}`),
        diffCommits: (id, commitA, commitB) => request("GET", `/repos/${id}/diff/commits/${commitA}/${commitB}`),
        diffBranches: (id, params) => request("GET", `/repos/${id}/diff/branches${qs(params)}`),
        diffCommit: (id, hash) => request("GET", `/repos/${id}/diff/commit/${hash}`),
        diffFiles: (id, params) => request("GET", `/repos/${id}/diff/files${qs(params)}`),
    },
    branches: {
        list: (id, params) => request("GET", `/repos/${id}/branches${qs(params)}`),
        create: (id, body) => request("POST", `/repos/${id}/branches`, body),
        switch: (id, name) => request("POST", `/repos/${id}/branches/switch`, { name }),
        delete: (id, branchName) => request("DELETE", `/repos/${id}/branches/${branchName}`),
    },
    pullRequests: {
        create: (repoId, payload) => request("POST", `/repos/${repoId}/pull-requests`, payload),
        list: (repoId) => request("GET", `/repos/${repoId}/pull-requests`),
        get: (repoId, prId) => request("GET", `/repos/${repoId}/pull-requests/${prId}`),
        merge: (repoId, prId) => request("POST", `/repos/${repoId}/pull-requests/${prId}/merge`),
        close: (repoId, prId) => request("POST", `/repos/${repoId}/pull-requests/${prId}/close`),
        diff: (repoId, prId) => request("GET", `/repos/${repoId}/pull-requests/${prId}/diff`),
        createReview: (repoId, prId, payload) => request("POST", `/repos/${repoId}/pull-requests/${prId}/reviews`, payload),
        listReviews: (repoId, prId) => request("GET", `/repos/${repoId}/pull-requests/${prId}/reviews`),
    },
    request,
};