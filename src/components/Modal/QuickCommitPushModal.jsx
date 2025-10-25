import React, { useEffect, useState } from "react";
import { api } from "../../features/API";

export default function QuickCommitPushModal({
                                                 open,
                                                 repoId,
                                                 filePath,                 // 예: "src/App.css"
                                                 fileContent,              // ✅ 방금 편집한 최신 내용 (필수)
                                                 defaultBranch = "main",
                                                 onClose,
                                                 onDone,                   // 성공 시 호출자에서 토스트/리프레시 등 처리
                                             }) {
    const [branches, setBranches] = useState(["main"]);
    const [branch, setBranch] = useState(defaultBranch || "main");
    const [message, setMessage] = useState(`chore: update ${filePath}`);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");

    useEffect(() => {
        if (!open || !repoId) return;
        setErr("");

        // 브랜치 목록 불러오기
        api.branches.list(repoId)
            .then((list) => {
                const names = Array.isArray(list?.branches)
                    ? list.branches
                    : Array.isArray(list) ? list : ["main"];
                const plain = names
                    .map((b) => (typeof b === "string" ? b : b?.name))
                    .filter(Boolean);

                const final = plain.length ? plain : ["main"];
                setBranches(final);
                setBranch((prev) => (final.includes(prev) ? prev : (final[0] || "main")));
            })
            .catch(() => {
                setBranches(["main"]);
                setBranch("main");
            });
    }, [open, repoId]);

    // 모달 닫힌 상태면 렌더 안 함
    if (!open) return null;

    const run = async () => {
        if (!repoId || !filePath) {
            setErr("레포지토리 또는 파일 경로가 없습니다.");
            return;
        }
        if (typeof fileContent !== "string") {
            setErr("파일 최신 내용이 없습니다. 다시 저장 후 시도하세요.");
            return;
        }
        const msg = message.trim();
        if (!msg) {
            setErr("커밋 메시지를 입력하세요.");
            return;
        }

        setBusy(true);
        setErr("");

        try {
            // 0) 최신 내용 저장 (PATCH /repos/{repoId}/files)
            await api.repos.updateFile(repoId, { path: filePath, content: fileContent });

            // 1) stage
            await api.repos.add(repoId, [filePath]);

            // 2) commit
            await api.repos.commit(repoId, msg);

            // 3) (선택) 푸시할 브랜치로 전환
            await api.branches.switch(repoId, branch);

            // 4) push (업스트림 없으면 게시)
            try {
                await api.repos.push(repoId, { branch });
            } catch (e) {
                const m = e?.message || "";
                if (m.includes("no upstream") || m.includes("does not exist on remote")) {
                    await api.repos.push(repoId, { branch, setUpstream: true });
                } else {
                    throw e;
                }
            }

            onClose?.();
            onDone?.({ branch, message: msg, filePath });
        } catch (e) {
            setErr(e?.message || "커밋/푸시에 실패했습니다.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="modal-backdrop" onClick={() => !busy && onClose?.()}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-head">
                    <h4>바로 커밋 & 푸시</h4>
                    <button className="modal-close" onClick={() => !busy && onClose?.()}>×</button>
                </div>

                <div className="modal-body" style={{ display: "grid", gap: 10 }}>
                    <div style={{ fontSize: 12, color: "var(--sub)" }}>
                        파일: <strong>{filePath}</strong>
                    </div>

                    <label style={{ fontSize: 12, color: "var(--sub)" }}>커밋 메시지</label>
                    <input
                        className="input"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        disabled={busy}
                        placeholder="변경 내용을 요약해 주세요"
                    />

                    <label style={{ fontSize: 12, color: "var(--sub)" }}>푸시할 브랜치</label>
                    <select
                        className="select"
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        disabled={busy}
                    >
                        {branches.map((b) => (
                            <option key={b} value={b}>{b}</option>
                        ))}
                    </select>

                    {err && <div style={{ color: "var(--danger)", fontSize: 12 }}>{err}</div>}
                </div>

                <div className="modal-actions">
                    <button className="btn" onClick={() => !busy && onClose?.()} disabled={busy}>취소</button>
                    <button className="btn btn-primary" onClick={run} disabled={busy}>
                        {busy ? "처리 중..." : "커밋하고 푸시"}
                    </button>
                </div>
            </div>
        </div>
    );
}
