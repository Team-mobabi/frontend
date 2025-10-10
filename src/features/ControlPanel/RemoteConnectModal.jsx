import React, { useMemo, useState } from "react";
import { api } from "../../features/API";

export default function RemoteConnectModal({ open, onClose, repoId, onConnected }) {
    const rid = useMemo(() => (repoId == null ? "" : String(repoId).trim()), [repoId]);
    const [url, setUrl] = useState("");
    const [name, setName] = useState("origin");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");

    if (!open) return null;

    const submit = async () => {
        if (!rid) { setErr("레포지토리를 먼저 선택하세요."); return; }
        if (!url.trim()) { setErr("원격 주소를 입력하세요."); return; }
        if (!name.trim()) { setErr("원격 이름을 입력하세요."); return; }
        setBusy(true); setErr("");
        try {
            await api.repos.connectRemote(rid, { url: url.trim(), name: name.trim() });
            onConnected && onConnected({ url: url.trim(), name: name.trim() });
        } catch (e) {
            const raw = e?.data?.message ?? e?.message ?? "연결에 실패했습니다.";
            setErr(Array.isArray(raw) ? raw.join("\n") : String(raw));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-head">
                    <h4>원격 저장소 연결</h4>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">
                    <div style={{ display: "grid", gap: 10 }}>
                        <input className="input" placeholder="https://github.com/user/repo.git" value={url} onChange={e => setUrl(e.target.value)} />
                        <input className="input" placeholder="origin" value={name} onChange={e => setName(e.target.value)} />
                        {err && <div className="error" style={{ color: "var(--danger)", fontSize: 12 }}>{err}</div>}
                    </div>
                </div>
                <div className="modal-actions">
                    <button className="btn" onClick={onClose} disabled={busy}>취소</button>
                    <button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? "연결 중…" : "연결하기"}</button>
                </div>
            </div>
        </div>
    );
}
