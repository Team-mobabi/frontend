import { useState } from "react";
import { api, errorMessage } from "../../lib/api";
import type { Id } from "../../types/api";
import Modal from "./Modal";
import ErrorText from "../common/ErrorText";

export type RemoteConnection =
    | { type: "remote"; name: string; url: string }
    | { type: "local"; name: string };

interface RemoteConnectModalProps {
    open: boolean;
    repoId: Id | null | undefined;
    onClose?: () => void;
    onConnected?: (connection: RemoteConnection) => void;
}

export default function RemoteConnectModal({ open, repoId, onClose, onConnected }: RemoteConnectModalProps) {
    const [tab, setTab] = useState<"remote" | "local">("remote");
    const [url, setUrl] = useState("");
    const [name, setName] = useState("origin");
    const [localName, setLocalName] = useState("local-backup");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");

    const connectRemote = async () => {
        if (!repoId) return;
        setErr("");
        const u = url.trim();
        if (!/^https?:\/\/.+\.git$/i.test(u)) {
            setErr("유효한 서버 저장소 URL(.git)을 입력하세요.");
            return;
        }
        setBusy(true);
        try {
            const remoteName = (name || "origin").trim() || "origin";
            await api.repos.addRemote(repoId, { url: u, name: remoteName });
            onConnected?.({ type: "remote", name: remoteName, url: u });
            onClose?.();
        } catch (e) {
            setErr(errorMessage(e, "서버 연결에 실패했어요."));
        } finally {
            setBusy(false);
        }
    };

    const connectLocal = async () => {
        if (!repoId) return;
        setErr("");
        const n = localName.trim();
        if (!n || n.includes(" ") || !/^[a-zA-Z0-9-_]+$/.test(n)) {
            setErr("유효한 백업 이름을 입력하세요 (공백, 특수문자 제외).");
            return;
        }
        setBusy(true);
        try {
            await api.repos.addLocalRemote(repoId, { name: n });
            onConnected?.({ type: "local", name: n });
            onClose?.();
        } catch (e) {
            setErr(errorMessage(e, "백업 생성에 실패했어요."));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            open={open}
            title="서버 저장소 연결"
            onClose={() => onClose?.()}
            width={420}
            footer={
                <>
                    <button className="btn" onClick={onClose}>취소</button>
                    {tab==="remote" ? (
                        <button className="btn btn-primary" onClick={connectRemote}>{busy ? "연결 중…" : "연결하기"}</button>
                    ) : (
                        <button className="btn btn-primary" onClick={connectLocal}>{busy ? "생성 중…" : "백업 생성"}</button>
                    )}
                </>
            }
        >
            <div className="tabs">
                <button className={`tab ${tab === "remote" ? "active" : ""}`} onClick={() => setTab("remote")}>
                    URL로 연결
                </button>
                <button className={`tab ${tab === "local" ? "active" : ""}`} onClick={() => setTab("local")}>
                    내 저장소 백업 생성
                </button>
            </div>

            {tab === "remote" ? (
                <div style={{ display:"grid", gap:10 }}>
                    <input className="input" placeholder="서버 URL (예: https://github.com/user/repo.git)" value={url} onChange={(e)=>setUrl(e.target.value)}/>
                    <input className="input" placeholder="서버 이름 (기본: origin)" value={name} onChange={(e)=>setName(e.target.value)}/>
                </div>
            ) : (
                <div style={{ display:"grid", gap:10 }}>
                    <input className="input" placeholder="백업 이름 (예: local-backup)" value={localName} onChange={(e)=>setLocalName(e.target.value)}/>
                    <div className="panel-sub">서버 내 별도 저장소를 생성해 백업으로 연결합니다.</div>
                </div>
            )}

            <ErrorText>{err}</ErrorText>
        </Modal>
    );
}