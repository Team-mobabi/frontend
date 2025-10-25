import React, { useState, useEffect } from "react";
import { api } from "../../features/API.js";

export default function CreateRepoModal({ open, onClose, onRepoCreated }) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isPrivate, setIsPrivate] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");

    useEffect(() => {
        if (!open) {
            setName("");
            setDescription("");
            setErr("");
            setBusy(false);
        }
    }, [open]);

    if (!open) return null;

    const handleCreate = async () => {
        const repoName = name.trim();
        if (!repoName) {
            setErr("레포지토리 이름을 입력하세요.");
            return;
        }
        setBusy(true);
        setErr("");
        try {
            const newRepo = await api.repos.create({
                name: repoName,
                description: description.trim(),
                isPrivate
            });

            const repoId = newRepo.repoId || newRepo.id;
            await api.repos.connectRemoteLocal(repoId, { name: "origin" });

            onRepoCreated(newRepo);
            setName("");
            setDescription("");
            onClose();
        } catch (e) {
            setErr(e.message || "레포지토리 생성 또는 원격 연결에 실패했습니다.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-head">
                    <h4>새 레포지토리 만들기</h4>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <div className="modal-body" style={{ display: "grid", gap: "12px" }}>
                    <input
                        className="input"
                        placeholder="레포지토리 이름 (예: my-project)"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={busy}
                    />
                    <textarea
                        className="input"
                        placeholder="설명 (선택 사항)"
                        rows="3"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={busy}
                        style={{ resize: "vertical" }}
                    />
                    {err && <div style={{ color: "var(--danger)", fontSize: 12 }}>{err}</div>}
                </div>
                <div className="modal-actions">
                    <button className="btn" onClick={onClose} disabled={busy}>취소</button>
                    <button className="btn btn-primary" onClick={handleCreate} disabled={busy}>
                        {busy ? "생성 중..." : "만들기"}
                    </button>
                </div>
            </div>
        </div>
    );
}
