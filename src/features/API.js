const BASE_URL =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
    (typeof window !== "undefined" && window.__API_BASE_URL__) || "";

const DEBUG = String(import.meta.env?.VITE_API_DEBUG ?? import.meta.env?.DEV).toLowerCase() === "true";

const tokenKey = "gitgui_token";
export function getToken(){ try { return localStorage.getItem(tokenKey) || ""; } catch { return ""; } }
export function setToken(t){ try { t ? localStorage.setItem(tokenKey, t) : localStorage.removeItem(tokenKey); } catch {} }
export function clearToken(){ setToken(""); }

function qs(params){ const q = params ? new URLSearchParams(params).toString() : ""; return q ? `?${q}` : ""; }

async function request(method, path, body, options = {}) {
    const authToken = getToken();
    const url = (BASE_URL || "") + path;
    if (DEBUG) console.info("[API →]", method, url, { hasToken: !!authToken, body });

    const headers = { ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}), ...(options.headers || {}) };
    const isForm = typeof FormData !== "undefined" && body instanceof FormData;
    if (body != null && !isForm && headers["Content-Type"] == null) headers["Content-Type"] = "application/json";

    const res = await fetch(url, { method, headers, body: body != null ? (isForm ? body : JSON.stringify(body)) : undefined, ...options });

    const noContent = res.status === 204 || res.headers.get("Content-Length") === "0";
    const ct = res.headers.get("Content-Type") || "";
    let data = null;
    let rawText = "";
    try {
        if (noContent) data = { success: true, __empty: true };
        else if (ct.includes("application/json")) data = await res.json();
        else { rawText = await res.text(); try { data = JSON.parse(rawText); } catch { data = null; } }
    } catch {}

    if (DEBUG) console.info(res.ok ? "[API ← OK]" : "[API ← ERR]", res.status, data || rawText);

    if (!res.ok || (data && data.success === false)) {
        if (res.status === 401) clearToken();
        const msg = (data && (data.message || data.error)) || rawText || `HTTP ${res.status} ${res.statusText}`;
        const err = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
        err.status = res.status;
        err.data = data;
        err.dataRaw = rawText;
        err.endpoint = url;
        err.method = method;
        throw err;
    }
    return data ?? { success: true };
}

export const api = {
    auth: {
        signup: (payload) => request("POST", "/auth/signup", payload),
        signin: async (payload) => {
            const data = await request("POST", "/auth/signin", payload);
            const token = data?.token || data?.accessToken || data?.access_token || data?.jwt || data?.id_token || data?.result?.token;
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
        push: async (id, opts = {}) => {
            const safe = {};
            if (opts && typeof opts === "object") {
                if (typeof opts.upstream === "boolean") safe.upstream = opts.upstream;
                if (typeof opts.force === "boolean") safe.force = opts.force;
            }
            const hasBody = Object.keys(safe).length > 0;
            try {
                return hasBody
                    ? await request("POST", `/repos/${id}/push`, safe)
                    : await request("POST", `/repos/${id}/push`, undefined);
            } catch (e) {
                const msg = (e?.data?.message || e?.message || "").toString().toLowerCase();
                const softOk = e?.status === 204 || /already up.to.date|nothing to push|tracking/i.test(msg);
                if (softOk) return { success: true, softOk: true, message: msg };
                throw e;
            }
        },
        graph: (id) => request("GET", `/repos/${id}/graph`),
    },
    branches: {
        list: (id, params) => request("GET", `/repos/${id}/branches${qs(params)}`),
        create: (id, name) => request("POST", `/repos/${id}/branches`, { name }),
        switch: async (id, name) => {
            try {
                const data = await request("POST", `/repos/${id}/branches/switch`, { name });
                return data ?? { success: true, __empty: true, message: "" };
            } catch (e) {
                const msg = (e?.data?.message || e?.message || "").toString().toLowerCase();
                const softOk = e?.status === 204 || e?.status === 304 || e?.status === 409 ||
                    (e?.status === 400 && /already|same branch|현재 브랜치|이미/.test(msg)) ||
                    /already|same branch|현재 브랜치|이미/.test(msg);
                if (softOk) return { success: true, softOk: true, message: msg };
                if (e?.status === 404) {
                    await request("POST", `/repos/${id}/branches`, { name });
                    const data2 = await request("POST", `/repos/${id}/branches/switch`, { name });
                    return data2 ?? { success: true, __empty: true, message: "" };
                }
                throw e;
            }
        },
    },
    request,
};

if (import.meta.env.DEV && typeof window !== "undefined") {
    window.__api = api;
    window.__API_BASE_URL__ = BASE_URL;
}
