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
            await api.repos.connectRemote(repoId, { url: u, name: remoteName });
            onConnected?.({ type: "remote", name: remoteName, url: u });
            onClose?.(); // ✅ 모달 즉시 닫기
        } catch (e) {
            const msg = (e?.data?.message || e?.message || "원격 연결에 실패했어요.").toString();
            setErr(Array.isArray(msg) ? msg.join("\n") : msg);
        } finally {
            setBusy(false);
        }
    };

    const connectLocal = async () => {
        setErr("");
        const ln = (localName || "").trim();
        if (!ln) {
            setErr("로컬 원격 이름을 입력하세요.");
            return;
        }
        setBusy(true);
        try {
            const res = await api.repos.connectRemoteLocal(repoId, { name: ln });
            onConnected?.({ type: "local", name: res?.remoteName || ln, url: res?.remotePath });
            onClose?.(); // ✅ 로컬 연결 후도 즉시 닫기
        } catch (e) {
            const msg = (e?.data?.message || e?.message || "로컬 원격 생성에 실패했어요.").toString();
            setErr(Array.isArray(msg) ? msg.join("\n") : msg);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={(e)=>e.stopPropagation()} style={{ width: 560 }}>
                <div className="modal-head">
                    <h4>원격 저장소 연결</h4>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>

                <div className="modal-body" style={{ display:"grid", gap:12 }}>
                    <div style={{ display:"flex", gap:8 }}>
                        <button className={`btn ${tab==="remote" ? "btn-primary" : ""}`} onClick={()=>setTab("remote")} disabled={busy}>GitHub 등 원격</button>
                        <button className={`btn ${tab==="local" ? "btn-primary" : ""}`} onClick={()=>setTab("local")} disabled={busy}>로컬 백업 원격</button>
                    </div>

                    {tab==="remote" ? (
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
