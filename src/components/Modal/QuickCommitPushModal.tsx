import { useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { branchNamesOf } from "../../lib/normalize";
import type { Id } from "../../types/api";
import Modal from "./Modal";
import ErrorText from "../common/ErrorText";

export interface QuickCommitPushResult {
    branch: string;
    message: string;
    filePath: string;
}

interface QuickCommitPushModalProps {
    open: boolean;
    repoId: Id | null | undefined;
    filePath: string; // 예: "src/App.css"
    fileContent: string; // 방금 편집한 최신 내용
    defaultBranch?: string;
    onClose?: () => void;
    onDone?: (result: QuickCommitPushResult) => void; // 성공 시 호출자에서 토스트/리프레시 등 처리
}

export default function QuickCommitPushModal({
    open,
    repoId,
    filePath,
    fileContent,
    defaultBranch = "main",
    onClose,
    onDone,
}: QuickCommitPushModalProps) {
    const [branches, setBranches] = useState<string[]>(["main"]);
    const [branch, setBranch] = useState(defaultBranch || "main");
    const [message, setMessage] = useState(`chore: update ${filePath}`);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");

    useEffect(() => {
        if (!open || !repoId) return;
        setErr("");

        api.branches.list(repoId)
            .then((list) => {
                const names = branchNamesOf(list);
                const final = names.length ? names : ["main"];
                setBranches(final);
                setBranch((prev) => (final.includes(prev) ? prev : (final[0] || "main")));
            })
            .catch(() => {
                setBranches(["main"]);
                setBranch("main");
            });
    }, [open, repoId]);

    const run = async () => {
        if (!repoId || !filePath) {
            setErr("저장소 또는 파일 경로가 없습니다.");
            return;
        }
        const msg = message.trim() || `chore: update ${filePath}`;

        setBusy(true);
        setErr("");

        try {
            // 0) 최신 내용 저장 → 1) stage → 2) commit → 3) 푸시할 브랜치로 전환
            await api.repos.updateFile(repoId, { path: filePath, content: fileContent });
            await api.repos.add(repoId, [filePath]);
            await api.repos.commit(repoId, msg);
            await api.branches.switch(repoId, branch);

            // 4) push (업스트림 없으면 게시)
            try {
                await api.repos.push(repoId, { branch });
            } catch (e) {
                const m = e instanceof Error ? e.message : "";
                if (m.includes("no upstream") || m.includes("does not exist on remote")) {
                    // api.repos.push 타입에 setUpstream이 없어 변수로 넘긴다
                    const upstreamBody = { branch, setUpstream: true };
                    await api.repos.push(repoId, upstreamBody);
                } else {
                    throw e;
                }
            }

            onClose?.();
            onDone?.({ branch, message: msg, filePath });
        } catch (e) {
            setErr(errorMessage(e, "저장/올리기에 실패했습니다."));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            open={open}
            title="바로 저장 & 올리기"
            onClose={() => onClose?.()}
            busy={busy}
            bodyStyle={{ display: "grid", gap: 10 }}
            footer={
                <>
                    <button className="btn" onClick={() => !busy && onClose?.()}>취소</button>
                    <button className="btn btn-primary" onClick={run}>
                        {busy ? "처리 중..." : "저장하고 올리기"}
                    </button>
                </>
            }
        >
            <div style={{ fontSize: 12, color: "var(--sub)" }}>
                파일: <strong>{filePath}</strong>
            </div>

            <label style={{ fontSize: 12, color: "var(--sub)" }}>저장 메시지</label>
            <input
                className="input"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="변경 내용을 요약해 주세요"
            />

            <label style={{ fontSize: 12, color: "var(--sub)" }}>올릴 가지</label>
            <select
                className="select"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
            >
                {branches.map((b) => (
                    <option key={b} value={b}>{b}</option>
                ))}
            </select>

            <ErrorText>{err}</ErrorText>
        </Modal>
    );
}
