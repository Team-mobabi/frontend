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

        if (res.status === 401 && !options.isRetry) {
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

                if (!refreshRes.ok) {
                    throw new Error("Failed to refresh token");
                }

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

        const errData = await res.json().catch(() => ({ message: res.statusText || "Error" }));
        const err = new Error(errData.message || "API request failed");
        err.status = res.status;
        err.data = errData;
        throw err;

    } catch (err) {
        if (DEBUG) console.error("[API ← ERR]", err.status, err.data || err.message);
        throw err;
    }
}

export const api = {
    auth: {
        register: (body) => request("POST", "/auth/signup", body),
        login: (body) => request("POST", "/auth/signin", body),
        refresh: (refreshToken) => request("POST", "/auth/refresh", { refreshToken }),
        logout: () => request("POST", "/auth/logout"),
    },
    users: {
        me: () => request("GET", "/users/me"),
        deleteMe: () => request("DELETE", "/users/me"),
        search: (params) => request("GET", `/users/search${qs(params)}`),
        updatePassword: (body) => request("PATCH", "/users/password", body),
    },
    email: {
        sendVerification: (body) => request("POST", "/email/send-verification", body),
        verifyCode: (body) => request("POST", "/email/verify-code", body),
    },
    repos: {
        create: (body) => request("POST", "/repos", body),
        list: () => request("GET", "/repos"),
        delete: (id) => request("DELETE", `/repos/${id}`),
        listPublic: () => request("GET", "/repos/public"),
        listUserPublic: (userId) => request("GET", `/repos/public/user/${userId}`),
        fork: (body) => request("POST", "/repos/fork", body),

        // Git Operations
        add: (id, files) => request("POST", `/repos/${id}/add`, { files: files }), // body를 {files} 객체로 감싸는 것이 좋습니다
        commit: (id, message) => request("POST", `/repos/${id}/commit`, { message: message }), // body를 {message} 객체로 감싸는 것이 좋습니다
        reset: (id, body) => request("POST", `/repos/${id}/reset`, body),
        addRemote: (id, body) => request("POST", `/repos/${id}/remote`, body),
        addLocalRemote: (id, body) => request("POST", `/repos/${id}/remote-local`, body), // connectRemoteLocal -> addLocalRemote
        pull: (id, body) => request("POST", `/repos/${id}/pull`, body),
        push: (id, bodyOrBranch, params) => {
            // ActionButtons.jsx v1 (제공해주신 코드)은 body 객체를 사용합니다
            if (typeof bodyOrBranch === 'object') {
                return request("POST", `/repos/${id}/push`, bodyOrBranch);
            }
            // ActionButtons.jsx v2 (제가 제안했던 코드)는 파라미터를 사용합니다
            return request("POST", `/repos/${id}/push/${bodyOrBranch}${qs(params)}`);
        },
        status: (id) => request("GET", `/repos/${id}/status`),

        // Branches
        merge: (id, body) => request("POST", `/repos/${id}/merge`, body),
        graph: (id) => request("GET", `/repos/${id}/graph`),

        // Files
        getFiles: (id, params) => request("GET", `/repos/${id}/files${qs(params)}`),
        createFile: (id, body) => request("POST", `/repos/${id}/files`, body),
        updateFile: (id, body) => request("PATCH", `/repos/${id}/files`, body),
        deleteFile: (id, body) => request("DELETE", `/repos/${id}/files`, body),

        // Conflicts
        conflicts: (id) => request("GET", `/repos/${id}/conflicts`),
        resolve: (id, body) => request("POST", `/repos/${id}/conflicts/resolve`, body),
        abortMerge: (id) => request("POST", `/repos/${id}/merge/abort`),
        aiSuggest: (id, body) => request("POST", `/repos/${id}/conflicts/ai-suggest`, body),

        // Diffs
        diffWorking: (id) => request("GET", `/repos/${id}/diff/working`),
        diffStaged: (id) => request("GET", `/repos/${id}/diff/staged`),
        diffStats: (id) => request("GET", `/repos/${id}/diff/stats`),

        // ActionButtons.jsx (제공해주신 코드)가 사용하는 upload API
        upload: (id, files) => {
            const formData = new FormData();
            files.forEach(f => formData.append("files", f));
            return request("POST", `/repos/${id}/upload`, formData); // (이 엔드포인트가 API 명세에 없으므로 확인 필요)
        }
    },
    collaborators: {
        add: (repoId, payload) => request("POST", `/repos/${repoId}/collaborators`, payload),
        list: (repoId) => request("GET", `/repos/${repoId}/collaborators`),
        updateRole: (repoId, userId, payload) => request("PATCH", `/repos/${repoId}/collaborators/${userId}`, payload),
        remove: (repoId, userId) => request("DELETE", `/repos/${repoId}/collaborators/${userId}`),
    }
};