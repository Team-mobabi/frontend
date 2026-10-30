import { useState, useEffect } from "react";
import { api, errorMessage } from "../../lib/api";
import type { Repo } from "../../types/api";
import Modal from "./Modal";
import ErrorText from "../common/ErrorText";

interface CreateRepoModalProps {
    open: boolean;
    onClose: () => void;
    onRepoCreated: (repo: Repo) => void;
}

export default function CreateRepoModal({ open, onClose, onRepoCreated }: CreateRepoModalProps) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isPrivate, setIsPrivate] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");

    useEffect(() => {
        if (!open) {
            setName("");
            setDescription("");
            setIsPrivate(false);
            setErr("");
            setBusy(false);
        }
    }, [open]);

    const handleCreate = async () => {
        const repoName = name.trim() || `repo-${Date.now()}`;
        setBusy(true);
        setErr("");
        try {
            const newRepo = await api.repos.create({
                name: repoName,
                description: description.trim(),
                isPrivate
            });

            const repoId = newRepo.repoId || newRepo.id || "";
            await api.repos.addLocalRemote(repoId, { name: "origin" });

            onRepoCreated(newRepo);
            setName("");
            setDescription("");
            onClose();
        } catch (e) {
            setErr(errorMessage(e, "저장소 생성 또는 서버 연결에 실패했습니다."));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            open={open}
            title="새 저장소 만들기"
            onClose={onClose}
            bodyStyle={{ display: "grid", gap: "12px" }}
            footer={
                <>
                    <button className="btn" onClick={onClose}>취소</button>
                    <button className="btn btn-primary" onClick={handleCreate}>
                        {busy ? "생성 중..." : "만들기"}
                    </button>
                </>
            }
        >
            <input
                className="input"
                placeholder="저장소 이름 (예: my-project)"
                value={name}
                onChange={(e) => setName(e.target.value)}
            />
            <textarea
                className="input"
                placeholder="설명 (선택 사항)"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ resize: "vertical" }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                />
                비공개 저장소로 만들기
            </label>
            <div style={{ fontSize: 12, color: "var(--sub)" }}>
                공개 설정은 나중에 변경할 수 있어요. 공개로 만들면 누구나 볼 수 있습니다.
            </div>
            <ErrorText>{err}</ErrorText>
        </Modal>
    );
}
