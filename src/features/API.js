const BASE_URL =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
    (typeof window !== "undefined" && window.__API_BASE_URL__) ||
    "";
const DEBUG = String(import.meta.env?.VITE_API_DEBUG ?? import.meta.env?.DEV).toLowerCase() === "true";

const tokenKey = "gitgui_token";
export function getToken() {
    try { return localStorage.getItem(tokenKey) || ""; } catch { return ""; }
}
export function setToken(t) {
    try { t ? localStorage.setItem(tokenKey, t) : localStorage.removeItem(tokenKey); } catch {}
}
export function clearToken() { setToken(""); }

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
async function request(method, path, body, options = {}) {
    const authToken = getToken();
    if (DEBUG) console.info("[API →]", method, (BASE_URL || "") + path, { hasToken: !!authToken, body });
    const headers = { ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}), ...(options.headers || {}) };
    const isForm = typeof FormData !== "undefined" && body instanceof FormData;
    if (body != null && !isForm && headers["Content-Type"] == null) headers["Content-Type"] = "application/json";
    const res = await fetch((BASE_URL || "") + path, { method, headers, body: body != null ? (isForm ? body : JSON.stringify(body)) : undefined, ...options });
    let data = null;
    try { data = await res.json(); } catch {}
    if (DEBUG) console.info(res.ok ? "[API ← OK]" : "[API ← ERR]", res.status, data);
    if (!res.ok || (data && data.success === false)) {
        if (res.status === 401) clearToken();
        const msg = (data && (data.message || data.error)) || `HTTP ${res.status} ${res.statusText}`;
        const err = new Error(msg);
        err.status = res.status;
        err.data = data;
        throw err;
    }
    return data;
}

export const api = {
    auth: {
        signup: (payload) => request("POST", "/auth/signup", payload),
        signin: async (payload) => {
            const data = await request("POST", "/auth/signin", payload);
            const token = data?.token || data?.accessToken;
            if (token) {
                setToken(token);
                return { ...data, status: "authenticated" };
            }
            if (data?.status === "pending_verification") {
                return { ...data, status: "pending_verification" };
            }
            throw new Error("로그인 응답이 올바르지 않습니다.");
        },
        signout: async () => { clearToken(); return true; },
        getToken,
    },
    email: {
        sendVerification: (payload) => request("POST", "/email/send-verification", payload),
        verifyCode: (payload) => request("POST", "/email/verify-code", payload),
    },
    user: {
        me: () => request("GET", "/users/me"),
        search: (params) => request("GET", `/users/search${qs(params)}`),
    },
    repos: {
        create: (payload) => request("POST", `/repos`, payload),
        list: (params) => request("GET", `/repos${qs(params)}`),
        delete: (id) => request("DELETE", `/repos/${id}`),
        listPublic: (params) => request("GET", `/repos/public${qs(params)}`),
        listUserPublic: (userId, params) => request("GET", `/repos/public/user/${userId}${qs(params)}`),
        fork: (repoIdToFork) => request("POST", `/repos/fork`, { sourceRepoId: repoIdToFork }),
        connectRemote: (id, payload) => request("POST", `/repos/${id}/remote`, payload),
        connectRemoteLocal: (id, payload) => request("POST", `/repos/${id}/remote-local`, payload),
        status: (id) => request("GET", `/repos/${id}/status`),
        add: (id, files) => request("POST", `/repos/${id}/add`, { files }),
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
            console.log('[API] 업로드할 파일 목록:', fileList);

            // 각 파일을 추가하고, 경로 정보를 별도 필드로 전송
            fileList.forEach((f, index) => {
                const relativePath = f.webkitRelativePath || f.name;
                console.log('[API] FormData에 추가:', {
                    name: f.name,
                    webkitRelativePath: f.webkitRelativePath,
                    relativePath: relativePath
                });

                // 파일 추가 (파일명만 사용)
                fd.append("files", f, f.name);

                // 경로 정보를 별도 필드로 추가
                fd.append("paths", relativePath);
            });

            const up = await request("POST", `/repos/${id}/files`, fd);
            console.log('[API] 업로드 응답:', up);
            let saved = (up && (up.uploadedFiles?.map(f=>f.path) || up.saved || up.paths || up.files || [])) || [];
            if (!Array.isArray(saved)) saved = [];
            console.log('[API] 저장된 파일 경로:', saved);
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