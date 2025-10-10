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
    const q = params ? new URLSearchParams(params).toString() : "";
    return q ? `?${q}` : "";
}

async function request(method, path, body, options = {}) {
    const authToken = getToken();
    if (DEBUG) console.info("[API →]", method, (BASE_URL || "") + path, { hasToken: !!authToken, body });

    const headers = {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(options.headers || {}),
    };

    const isForm = typeof FormData !== "undefined" && body instanceof FormData;
    if (body != null && !isForm && headers["Content-Type"] == null) headers["Content-Type"] = "application/json";

    const res = await fetch((BASE_URL || "") + path, {
        method,
        headers,
        body: body != null ? (isForm ? body : JSON.stringify(body)) : undefined,
        ...options,
    });

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
            const token = data?.token || data?.accessToken || data?.access_token || data?.jwt || data?.id_token;
            if (!token) throw new Error("로그인 응답에 token이 없습니다.");
            setToken(token);
            if (DEBUG) console.info("[AUTH] token stored?", !!token);
            return data;
        },
        signout: async () => { clearToken(); return true; },
        getToken,
    },
    user: { me: () => request("GET", "/users/me") },
    repos: {
        create: (payload) => request("POST", `/repos`, payload),
        list:   (params)  => request("GET", `/repos${qs(params)}`),
        connectRemote: (id, payload) => request("POST", `/repos/${id}/remote`, payload),
        connectRemoteLocal: (id, payload) => request("POST", `/repos/${id}/remote-local`, payload),
        status: (id) => request("GET", `/repos/${id}/status`),
        add: (id, files) => request("POST", `/repos/${id}/add`, { files }),
        commit: (id, message) => request("POST", `/repos/${id}/commit`, { message }),
        pull: (id) => request("POST", `/repos/${id}/pull`),
        push: (id) => request("POST", `/repos/${id}/push`),
        graph: (id) => request("GET", `/repos/${id}/graph`),

        // 🔸 업로드-우선 플로우: multipart/form-data 로 서버에 파일을 먼저 올림
        upload: async (id, fileList) => {
            const fd = new FormData();
            for (const f of fileList) fd.append("files", f, f.name);
            const up = await request("POST", `/repos/${id}/add`, fd);
            // 응답 표준화: saved 경로 배열 만들기
            let saved =
                (Array.isArray(up) && up) ||
                up?.saved ||
                up?.paths ||
                up?.files ||
                up?.savedPaths ||
                up?.added ||
                [];
            if (!Array.isArray(saved)) saved = [];
            return { saved };
        },
    },
    branches: {
        list: (id, params) => request("GET", `/repos/${id}/branches${qs(params)}`),
        create: (id, name) => request("POST", `/repos/${id}/branches`, { name }),
        switch: (id, name) => request("POST", `/repos/${id}/branches/switch`, { name }),
    },
    request,
};

if (import.meta.env.DEV && typeof window !== "undefined") {
    window.__api = api;
    window.__setToken = setToken;
    window.__getToken = getToken;
    window.__clearToken = clearToken;
    window.__API_BASE_URL__ = BASE_URL;
}
