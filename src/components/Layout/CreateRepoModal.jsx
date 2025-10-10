import React, { useState } from "react";
import { api } from "../../features/API";
import { normalizeRepo } from "../../features/GitCore/repoUtils";

const INVALID = /[\\/]|^\s*$|^\.+$|^\s*~|:|\*|\?|"|<|>|\|/;

export default function CreateRepoModal({ open, onClose, dispatch }) {
    const [name, setName] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");

    if (!open) return null;

    const submit = async (e) => {
        e?.preventDefault();
        setErr("");
        const raw = name.trim();
        if (!raw || INVALID.test(raw)) {
            setErr("레포지토리 이름에는 경로나 특수문자를 사용할 수 없습니다.");
            return;
        }
        setBusy(true);
        try {
            const created = await api.repos.create({ name: raw });
            const repo = normalizeRepo(created);
            dispatch({ type: "ADD_REPO", payload: repo });
            dispatch({ type: "SELECT_REPO", payload: repo.id });
            onClose?.();
        } catch (e) {
            const msg = (e?.data?.message || e?.message || "레포 생성에 실패했어요.").toString();
            setErr(msg);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <form className="modal" onClick={(e)=>e.stopPropagation()} onSubmit={submit} style={{ width: 440 }}>
                <div className="modal-head">
                    <h4>새 레포지토리 만들기</h4>
                    <button className="modal-close" type="button" onClick={onClose}>×</button>
                </div>
                <div className="modal-body" style={{ display: "grid", gap: 10 }}>
                    <input
                        className="input"
                        placeholder="레포 이름 (예: my-repo)"
                        value={name}
                        onChange={(e)=>setName(e.target.value)}
                    />
                    {err && <div style={{ color: "var(--danger)", fontSize: 12 }}>{err}</div>}
                </div>
                <div className="modal-actions">
                    <button className="btn" type="button" onClick={onClose}>취소</button>
                    <button className="btn btn-primary" disabled={busy} type="submit">{busy ? "만드는 중…" : "만들기"}</button>
                </div>
            </form>
        </div>
    );
}
