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
            if (!token) throw new Error("로그인 응답에 token이 없습니다.");
            setToken(token);
            return data;
        },
        signout: async () => { clearToken(); return true; },
        getToken,
    },
    user: { me: () => request("GET", "/users/me") },
    repos: {
        create: (payload) => request("POST", `/repos`, payload),
        list: (params) => request("GET", `/repos${qs(params)}`),
        delete: (id) => request("DELETE", `/repos/${id}`),
        connectRemote: (id, payload) => request("POST", `/repos/${id}/remote`, payload),
        connectRemoteLocal: (id, payload) => request("POST", `/repos/${id}/remote-local`, payload),
        status: (id) => request("GET", `/repos/${id}/status`),
        add: (id, files) => request("POST", `/repos/${id}/add`, { files }),
        commit: (id, message) => request("POST", `/repos/${id}/commit`, { message }),
        pull: (id, body) => request("POST", `/repos/${id}/pull`, body),
        push: (id, body) => request("POST", `/repos/${id}/push`, body),
        graph: (id, params) => request("GET", `/repos/${id}/graph${qs(params)}`),
        merge: (id, payload) => request("POST", `/repos/${id}/merge`, payload),
        upload: async (id, fileList) => {
            const fd = new FormData();
            for (const f of fileList) fd.append("files", f, f.name);
            const up = await request("POST", `/repos/${id}/files`, fd);
            let saved = (up && (up.uploadedFiles?.map(f=>f.filename) || up.saved || up.paths || up.files || [])) || [];
            if (!Array.isArray(saved)) saved = [];
            return { saved };
        },
    },
    branches: {
        list: (id, params) => request("GET", `/repos/${id}/branches${qs(params)}`),
        create: (id, body) => request("POST", `/repos/${id}/branches`, body),
        switch: (id, name) => request("POST", `/repos/${id}/branches/switch`, { name }),
    },
    request,
};