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

export function is충돌오류(err) {
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
                const newRefreshToken = refreshData.refreshToken;

                setToken(newAccessToken, newRefreshToken);
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
    협업자: {
        추가: (저장소Id, payload) => request("POST", `/repos/${저장소Id}/collaborators`, payload),
        목록: (저장소Id) => request("GET", `/repos/${저장소Id}/collaborators`),
        역할변경: (저장소Id, 사용자Id, payload) => request("PATCH", `/repos/${저장소Id}/collaborators/${사용자Id}`, payload),
        제거: (저장소Id, 사용자Id) => request("DELETE", `/repos/${저장소Id}/collaborators/${사용자Id}`),
    },
    저장소: {
        생성: (payload) => request("POST", `/repos`, payload),
        목록: (params) => request("GET", `/repos${qs(params)}`),
        삭제: (id) => request("DELETE", `/repos/${id}`),
        공개목록: (params) => request("GET", `/repos/public${qs(params)}`),
        사용자공개목록: (사용자Id, params) => request("GET", `/repos/public/user/${사용자Id}${qs(params)}`),
        복사하기: (복사할저장소Id) => request("POST", `/repos/fork`, { sourceRepoId: 복사할저장소Id }),
        복제하기: (payload) => request("POST", `/repos/clone`, payload),
        원격추가: (id, payload) => request("POST", `/repos/${id}/remote`, payload),
        로컬원격추가: (id, payload) => request("POST", `/repos/${id}/remote-local`, payload),
        상태: (id) => request("GET", `/repos/${id}/status`),
        추가: (id, files) => request("POST", `/repos/${id}/add`, { files }), // 배열 -> { files: 배열 }
        저장: (id, message) => request("POST", `/repos/${id}/commit`, { message }),
        되돌리기: (id, payload) => request("POST", `/repos/${id}/reset`, payload),
        가져오기: (id, body) => request("POST", `/repos/${id}/pull`, body),
        올리기: (id, body) => request("POST", `/repos/${id}/push`, body),
        그래프: (id, params) => request("GET", `/repos/${id}/graph${qs(params)}`),
        합치기: (id, payload) => request("POST", `/repos/${id}/merge`, payload),
        합치기취소: (id) => request("POST", `/repos/${id}/merge/abort`),
        파일목록: (id, params) => request("GET", `/repos/${id}/files${qs(params)}`),
        파일생성: (id, payload) => request("POST", `/repos/${id}/files`, payload),
        파일수정: (id, payload) => request("PATCH", `/repos/${id}/files`, payload),
        파일삭제: (id, params) => request("DELETE", `/repos/${id}/files${qs(params)}`),
        업로드: async (id, fileList) => {
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
        충돌: (id) => request("GET", `/repos/${id}/conflicts`),
        충돌해결제안: (id, filePath) => request("POST", `/repos/${id}/conflicts/ai-suggest`, { filePath }),
        충돌해결: (id, resolution) => request("POST", `/repos/${id}/conflicts/resolve`, resolution),
        파일다운로드: (id, params) => request("GET", `/repos/${id}/files/download${qs(params)}`, null, { responseType: "blob" }),
        저장소다운로드: (id, params) => request("GET", `/repos/${id}/download${qs(params)}`, null, { responseType: "blob" }),
        비교통계: (id) => request("GET", `/repos/${id}/diff/stats`),
        작업중비교: (id, params) => request("GET", `/repos/${id}/diff/working${qs(params)}`),
        준비된비교: (id, params) => request("GET", `/repos/${id}/diff/staged${qs(params)}`),
        저장비교: (id, 저장A, 저장B) => request("GET", `/repos/${id}/diff/commits/${저장A}/${저장B}`),
        가지비교: (id, params) => request("GET", `/repos/${id}/diff/branches${qs(params)}`),
        저장상세비교: (id, hash) => request("GET", `/repos/${id}/diff/commit/${hash}`),
        파일비교: (id, params) => request("GET", `/repos/${id}/diff/files${qs(params)}`),
    },
    가지: {
        목록: (id, params) => request("GET", `/repos/${id}/branches${qs(params)}`),
        생성: (id, body) => request("POST", `/repos/${id}/branches`, body),
        전환: (id, name) => request("POST", `/repos/${id}/branches/switch`, { name }),
        삭제: (id, 가지이름) => request("DELETE", `/repos/${id}/branches/${가지이름}`),
    },
    변경요청: {
        생성: (저장소Id, payload) => request("POST", `/repos/${저장소Id}/pull-requests`, payload),
        목록: (저장소Id) => request("GET", `/repos/${저장소Id}/pull-requests`),
        조회: (저장소Id, 변경요청Id) => request("GET", `/repos/${저장소Id}/pull-requests/${변경요청Id}`),
        합치기: (저장소Id, 변경요청Id) => request("POST", `/repos/${저장소Id}/pull-requests/${변경요청Id}/merge`),
        닫기: (저장소Id, 변경요청Id) => request("POST", `/repos/${저장소Id}/pull-requests/${변경요청Id}/close`),
        비교: (저장소Id, 변경요청Id) => request("GET", `/repos/${저장소Id}/pull-requests/${변경요청Id}/diff`),
        리뷰생성: (저장소Id, 변경요청Id, payload) => request("POST", `/repos/${저장소Id}/pull-requests/${변경요청Id}/reviews`, payload),
        리뷰목록: (저장소Id, 변경요청Id) => request("GET", `/repos/${저장소Id}/pull-requests/${변경요청Id}/reviews`),
    },
    aiAssistant: {
        ask: (저장소Id, question) => request("POST", `/repos/${저장소Id}/ai/ask`, { question }),
        suggestNext: (저장소Id) => request("GET", `/repos/${저장소Id}/ai/suggest-next`),
    },
    request,
};