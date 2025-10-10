const KEY = "gitgui_remote_mem_v1";

function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}
function save(map) {
    try { localStorage.setItem(KEY, JSON.stringify(map || {})); } catch {}
}

export function setRemoteMem(repoId, info) {
    const id = String(repoId || "");
    if (!id) return;
    const m = load();
    m[id] = { url: String(info?.url || ""), name: String(info?.name || "origin"), ts: Date.now() };
    save(m);
}

export function getRemoteMem(repoId) {
    const id = String(repoId || "");
    if (!id) return null;
    const m = load();
    const v = m[id];
    if (!v || !v.url || !v.name) return null;
    return v;
}

export function clearRemoteMem(repoId) {
    const id = String(repoId || "");
    if (!id) return;
    const m = load();
    delete m[id];
    save(m);
}

export function allRemoteMem() {
    return load();
}
