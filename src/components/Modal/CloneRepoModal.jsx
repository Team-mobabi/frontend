import React, { useEffect, useState } from "react";
import { api } from "../../features/API.js";

export default function CloneRepoModal({ open, onClose, onRepoCloned }) {
    const [url, setUrl] = useState("");
    const [name, setName] = useState("");
    const [defaultBranch, setDefaultBranch] = useState("main");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open) {
            setUrl("");
            setName("");
            setDefaultBranch("main");
            setError("");
            setBusy(false);
        }
    }, [open]);

    if (!open) return null;

    const resolveName = (value) => {
        const trimmed = value.trim();
        if (trimmed) return trimmed;
        try {
            const parsed = new URL(url.trim());
            const pathname = parsed.pathname.replace(/\.git$/i, "");
            const segments = pathname.split("/").filter(Boolean);
            if (segments.length) {
                return segments[segments.length - 1];
            }
        } catch {}
        return "";
    };

    const handleClone = async () => {
        const remoteUrl = url.trim();
        if (!remoteUrl) {
            setError("복제할 원격 저장소 URL을 입력하세요.");
            return;
        }

        const repoName = resolveName(name);
        if (!repoName) {
            setError("생성할 레포지토리 이름을 입력하거나 URL에서 자동으로 추출할 수 있도록 해주세요.");
            return;
        }

        const branchName = (defaultBranch || "").trim();

        setBusy(true);
        setError("");
        try {
            const payload = { url: remoteUrl, name: repoName };
            if (branchName) {
                payload.defaultBranch = branchName;
            }

            const cloned = await api.repos.clone(payload);

            onRepoCloned?.(cloned);
            onClose?.();
        } catch (e) {
            const msg = (e?.data?.message || e?.message || "Git clone에 실패했습니다.").toString();
            setError(Array.isArray(msg) ? msg.join("\n") : msg);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="modal-backdrop" onClick={() => !busy && onClose?.()}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 460 }}>
                <div className="modal-head">
                    <h4>Git Clone</h4>
                    <button className="modal-close" onClick={() => !busy && onClose?.()}>×</button>
                </div>
                <div className="modal-body" style={{ display: "grid", gap: 12 }}>
                    <label className="input-label">
                        원격 저장소 URL
                        <input
                            className="input"
                            placeholder="예: https://github.com/user/project.git"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            disabled={busy}
                        />
                    </label>

                    <label className="input-label">
                        새 레포지토리 이름
                        <input
                            className="input"
                            placeholder="자동 추출 또는 직접 입력"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={busy}
                        />
                    </label>

                    <label className="input-label">
                        기본 브랜치 이름
                        <input
                            className="input"
                            placeholder="예: main"
                            value={defaultBranch}
                            onChange={(e) => setDefaultBranch(e.target.value)}
                            disabled={busy}
                        />
                    </label>

                    <div className="panel-sub" style={{ lineHeight: 1.5 }}>
                        지정한 URL을 기반으로 서버에서 Git clone을 수행하고, 동일한 이름의 레포지토리를 내 계정에 생성합니다.
                        인증이 필요한 URL인 경우 서버 측 설정이 완료되어 있어야 합니다.
                    </div>

                    {error && (
                        <div style={{ color: "var(--danger)", fontSize: 12, whiteSpace: "pre-line" }}>
                            {error}
                        </div>
                    )}
                </div>
                <div className="modal-actions">
                    <button className="btn" onClick={() => !busy && onClose?.()} disabled={busy}>
                        취소
                    </button>
                    <button className="btn btn-primary" onClick={handleClone} disabled={busy}>
                        {busy ? "복제 중…" : "복제하기"}
                    </button>
                </div>
            </div>
        </div>
    );
}
