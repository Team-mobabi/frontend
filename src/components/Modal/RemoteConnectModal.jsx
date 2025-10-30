import React, { useState } from "react";
import { api } from "../../features/API.js";

export default function RemoteConnectModal({ open, repoId, onClose, onConnected }) {
    const [tab, setTab] = useState("remote");
    const [url, setUrl] = useState("");
    const [name, setName] = useState("origin");
    const [localName, setLocalName] = useState("local-backup");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");

    if (!open) return null;

    const connectRemote = async () => {
        setErr("");
        const u = url.trim();
        if (!/^https?:\/\/.+\.git$/i.test(u)) {
            setErr("유효한 원격 저장소 URL(.git)을 입력하세요.");
            return;
        }
        setBusy(true);
        try {
            const remoteName = (name || "origin").trim() || "origin";
            await api.repos.addRemote(repoId, { url: u, name: remoteName });
            onConnected?.({ type: "remote", name: remoteName, url: u });
            onClose?.();
        } catch (e) {
            const msg = (e?.data?.message || e?.message || "원격 연결에 실패했어요.").toString();
            setErr(Array.isArray(msg) ? msg.join("\n") : msg);
        } finally {
            setBusy(false);
        }
    };

    const connectLocal = async () => {
        setErr("");
        const n = localName.trim();
        if (!n || n.includes(" ") || !/^[a-zA-Z0-9-_]+$/.test(n)) {
            setErr("유효한 로컬 원격 이름을 입력하세요 (공백, 특수문자 제외).");
            return;
        }
        setBusy(true);
        try {
            await api.repos.addLocalRemote(repoId, { name: n });
            onConnected?.({ type: "local", name: n });
            onClose?.();
        } catch (e) {
            const msg = (e?.data?.message || e?.message || "로컬 원격 생성에 실패했어요.").toString();
            setErr(Array.isArray(msg) ? msg.join("\n") : msg);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 420 }}>
                <div className="modal-head">
                    <h4>원격 저장소 연결</h4>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">
                    <div className="tabs">
                        <button className={`tab ${tab === "remote" ? "active" : ""}`} onClick={() => setTab("remote")}>
                            URL로 연결
                        </button>
                        <button className={`tab ${tab === "local" ? "active" : ""}`} onClick={() => setTab("local")}>
                            로컬 원격 생성
                        </button>
                    </div>

                    {tab === "remote" ? (
                        <div style={{ display:"grid", gap:10 }}>
                            <input className="input" placeholder="원격 URL (예: https://github.com/user/repo.git)" value={url} onChange={(e)=>setUrl(e.target.value)} disabled={busy}/>
                            <input className="input" placeholder="원격 이름 (기본: origin)" value={name} onChange={(e)=>setName(e.target.value)} disabled={busy}/>
                        </div>
                    ) : (
                        <div style={{ display:"grid", gap:10 }}>
                            <input className="input" placeholder="로컬 원격 이름 (예: local-backup)" value={localName} onChange={(e)=>setLocalName(e.target.value)} disabled={busy}/>
                            <div className="panel-sub">서버 내 별도 bare 저장소를 생성해 원격으로 연결합니다.</div>
                        </div>
                    )}

                    {err && <div style={{ color:"var(--danger)", fontSize:12, whiteSpace:"pre-line" }}>{err}</div>}
                </div>

                <div className="modal-actions">
                    <button className="btn" onClick={onClose} disabled={busy}>취소</button>
                    {tab==="remote" ? (
                        <button className="btn btn-primary" onClick={connectRemote} disabled={busy}>{busy ? "연결 중…" : "연결하기"}</button>
                    ) : (
                        <button className="btn btn-primary" onClick={connectLocal} disabled={busy}>{busy ? "생성 중…" : "로컬 원격 생성"}</button>
                    )}
                </div>
            </div>
        </div>
    );
}