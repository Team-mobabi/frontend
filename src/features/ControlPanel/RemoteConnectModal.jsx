import React, { useEffect, useState } from "react";
import { api } from "../../features/API";
import { useGit } from "../../features/GitCore/GitContext";

export default function RemoteConnectModal({ open, onClose, repoId, onConnected }) {
    const { state } = useGit();
    const ctxRepoId = state?.selectedRepoId != null ? String(state.selectedRepoId).trim() : "";
    const rid = repoId && String(repoId).trim() !== "" ? String(repoId).trim() : ctxRepoId;

    const [mode, setMode] = useState("url");
    const [url, setUrl] = useState("");
    const [name, setName] = useState("origin");
    const [localName, setLocalName] = useState("local-backup");
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");

    useEffect(() => {
        if (!open) {
            setErr("");
            setLoading(false);
            setMode("url");
            setUrl("");
            setName("origin");
            setLocalName("local-backup");
        }
    }, [open]);

    if (!open) return null;

    const normalizeErr = (e) => {
        const raw = e?.data?.message ?? e?.message ?? "연결에 실패했습니다.";
        return Array.isArray(raw) ? raw.join("\n") : String(raw);
    };

    const handleSubmit = async (e) => {
        e?.preventDefault?.();
        if (!rid) { setErr("레포지토리를 먼저 선택해주세요."); return; }
        if (mode === "url" && (!url.trim() || !name.trim())) { setErr("URL과 원격 이름을 입력하세요."); return; }
        if (mode === "local" && !localName.trim()) { setErr("로컬 원격 이름을 입력하세요."); return; }
        setLoading(true);
        setErr("");
        try {
            if (mode === "url") {
                await api.repos.connectRemote(rid, { url: url.trim(), name: name.trim() || "origin" });
            } else {
                await api.repos.connectRemoteLocal(rid, { name: localName.trim() });
            }
            onConnected && onConnected();
            onClose && onClose();
        } catch (e2) {
            setErr(normalizeErr(e2));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-backdrop">
            <div className="modal">
                <div className="modal-head">
                    <h4>원격 저장소 연결</h4>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <form className="modal-body" onSubmit={handleSubmit}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                        <button type="button" className={mode === "url" ? "btn btn-primary" : "btn"} onClick={() => setMode("url")}>원격(URL)</button>
                        <button type="button" className={mode === "local" ? "btn btn-primary" : "btn"} onClick={() => setMode("local")}>로컬 원격</button>
                    </div>
                    {mode === "url" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <input className="input" placeholder="https://github.com/user/repo.git" value={url} onChange={(e) => setUrl(e.target.value)} />
                            <input className="input" placeholder="원격 이름 (기본: origin)" value={name} onChange={(e) => setName(e.target.value)} />
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <input className="input" placeholder="로컬 원격 이름 (예: local-backup)" value={localName} onChange={(e) => setLocalName(e.target.value)} />
                        </div>
                    )}
                    {err && <div className="error" style={{ marginTop: 10, color: "var(--danger)", fontSize: 12 }}>{err}</div>}
                    <div className="modal-actions">
                        <button type="button" className="btn" onClick={onClose} disabled={loading}>취소</button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={
                                loading ||
                                !rid ||
                                (mode === "url" ? !url.trim() || !name.trim() : !localName.trim())
                            }
                        >
                            {loading ? "연결 중…" : "연결하기"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
