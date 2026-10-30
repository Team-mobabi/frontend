import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import Modal from "../../components/Modal/Modal";
import { useToast } from "../../components/Toast/ToastProvider";
import { createLogger } from "../../lib/logger";

const log = createLogger("AddModal");

const MAX_PICK = 100; // 한 번에 담을 수 있는 최대 파일 수

// 일반적인 .gitignore 패턴들
const IGNORE_PATTERNS = [
    /node_modules\//i,
    /\.git\//i,
    /\.idea\//i,
    /\.vscode\//i,
    /dist\//i,
    /build\//i,
    /coverage\//i,
    /\.next\//i,
    /\.nuxt\//i,
    /\.cache\//i,
    /\.temp\//i,
    /\.tmp\//i,
    /\.log$/i,
    /\.env$/i,
    /\.env\./i,
    /\.DS_Store$/i,
    /__pycache__\//i,
    /\.pytest_cache\//i,
    /\.mypy_cache\//i,
    /vendor\//i,
    /target\//i,
];

// .gitignore 패턴에 해당하는 파일인지 확인
function shouldIgnoreFile(file: File): boolean {
    const path = file.webkitRelativePath || file.name;
    return IGNORE_PATTERNS.some((pattern) => pattern.test(path));
}

/**
 * 고른 파일 목록 정리: .gitignore 대상 제외 + 최대 100개 제한.
 * 사용자에게 알릴 메시지도 함께 돌려준다.
 */
function selectFiles(list: File[]): { chosen: File[]; messages: string[] } {
    const filtered = list.filter((f) => !shouldIgnoreFile(f));
    const ignored = list.length - filtered.length;
    log.debug(`필터링 결과: ${filtered.length}개 파일 선택, ${ignored}개 파일 무시됨`);

    const messages: string[] = [];
    if (ignored > 0) {
        messages.push(`${ignored}개의 파일이 자동으로 제외되었습니다. (node_modules, .git, .idea 등)`);
    }
    let chosen = filtered;
    if (chosen.length > MAX_PICK) {
        chosen = chosen.slice(0, MAX_PICK);
        messages.push(`최대 ${MAX_PICK}개 파일까지만 담을 수 있어요. 처음 ${MAX_PICK}개만 선택됩니다.`);
    }
    return { chosen, messages };
}

// 끌어다 놓은 항목 중 폴더가 있는지
function hasDirectoryItem(e: DragEvent<HTMLDivElement>): boolean {
    try {
        return Array.from(e.dataTransfer.items || []).some((item) => item.kind === "file" && item.webkitGetAsEntry()?.isDirectory);
    } catch {
        return false;
    }
}

interface AddModalProps {
    open: boolean;
    onCancel: () => void;
    onConfirm: (files: File[]) => void;
}

export default function AddModal({ open, onCancel, onConfirm }: AddModalProps) {
    const toast = useToast();
    const [err, setErr] = useState("");
    const [pickedFiles, setPickedFiles] = useState<File[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setErr("");
            setPickedFiles([]);
        }
    }, [open]);

    function applySelection(list: File[]) {
        const { chosen, messages } = selectFiles(list);
        if (messages.length > 0) toast.show(messages.join("\n"), "info", 3000);
        setPickedFiles(chosen);
    }

    function onFilePick(e: ChangeEvent<HTMLInputElement>) {
        applySelection(Array.from(e.target.files || []));
        // 같은 파일을 다시 고를 수 있도록 input 초기화
        const input = e.target.webkitdirectory ? folderInputRef.current : fileInputRef.current;
        if (input) input.value = "";
    }

    function onDrop(e: DragEvent<HTMLDivElement>) {
        e.preventDefault();
        if (hasDirectoryItem(e)) {
            setErr("폴더 끌어다 놓기는 지원되지 않습니다. '폴더 선택' 버튼을 이용해주세요.");
            setPickedFiles([]);
            return;
        }
        setErr("");
        applySelection(Array.from(e.dataTransfer?.files || []));
    }

    return (
        <Modal
            open={open}
            title="파일 담기 (업로드)"
            onClose={onCancel}
            footer={
                <>
                    <button className="btn" onClick={onCancel}>
                        취소
                    </button>
                    <button className="btn btn-primary" onClick={() => onConfirm(pickedFiles)}>
                        선택한 파일/폴더 업로드하여 담기
                    </button>
                </>
            }
        >
            <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={onFilePick} />
            <input
                ref={folderInputRef}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={onFilePick}
                {...{ webkitdirectory: "", directory: "", mozdirectory: "" }}
            />
            <div
                onDrop={onDrop}
                onDragOver={(e) => e.preventDefault()}
                style={{
                    border: "2px dashed var(--line)",
                    background: "var(--panel-2)",
                    borderRadius: 12,
                    padding: 20,
                    textAlign: "center",
                    marginBottom: 10,
                }}
            >
                <div style={{ fontSize: 13, color: "var(--sub)", marginBottom: 8 }}>
                    여기로 파일을 끌어다 놓거나
                    <br />
                    아래 버튼으로 선택하세요.
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
                    <button className="btn" type="button" onClick={() => fileInputRef.current?.click()}>
                        파일 선택
                    </button>
                    <button className="btn" type="button" onClick={() => folderInputRef.current?.click()}>
                        폴더 선택
                    </button>
                </div>
            </div>

            {err && <div style={{ color: "var(--danger)", marginBottom: "10px" }}>{err}</div>}

            {pickedFiles.length > 0 ? (
                <div className="push-list" style={{ maxHeight: 240, overflow: "auto" }}>
                    {pickedFiles.map((f) => (
                        <div key={f.name + f.size + f.lastModified} className="push-row">
                            <div className="push-msg" title={f.webkitRelativePath || f.name}>
                                {f.webkitRelativePath || f.name}
                            </div>
                            <div className="push-msg" style={{ fontSize: 12, color: "var(--muted)" }}>
                                {(f.size / 1024).toFixed(1)} KB
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty">선택된 파일이 없습니다.</div>
            )}
        </Modal>
    );
}
