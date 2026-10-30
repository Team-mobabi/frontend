import { useState, useEffect, type MouseEvent } from "react";
import { useGit } from "../GitCore/GitContext";
import { api, errorMessage } from "../../lib/api";
import { useToast } from "../../components/Toast/ToastProvider";
import QuickCommitPushModal from "../../components/Modal/QuickCommitPushModal";
import type { FileEntry } from "../../types/api";

export default function FileBrowserView() {
    const { state } = useGit();
    const toast = useToast();
    const { selectedRepoId } = state;

    const [items, setItems] = useState<FileEntry[]>([]);
    const [currentPath, setCurrentPath] = useState("");
    const [fileContent, setFileContent] = useState("");
    const [selectedFile, setSelectedFile] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [downloadingPath, setDownloadingPath] = useState("");

    const [qcOpen, setQcOpen] = useState(false);
    const [qcTargetPath, setQcTargetPath] = useState("");

    const fetchData = (path: string) => {
        if (!selectedRepoId) return;
        setLoading(true);
        setError("");
        setFileContent("");
        setSelectedFile("");

        api.repos.listFiles(selectedRepoId, { path: path || undefined })
            .then((data) => {
                const allItems = [
                    ...(data.folders || []),
                    ...(data.files || [])
                ];
                setItems(allItems);
                setCurrentPath(path || "");
            })
            .catch((err: unknown) => setError(errorMessage(err, "파일 목록을 불러올 수 없습니다.")))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (selectedRepoId) fetchData("");
        // fetchData는 렌더마다 새로 만들어지므로 저장소 변경 시에만 다시 불러온다
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedRepoId]);

    const handleItemClick = (item: FileEntry) => {
        if (!selectedRepoId) return;
        if (item.type === "folder") {
            fetchData(item.path);
        } else {
            setLoading(true);
            setSelectedFile(item.path);
            api.repos.listFiles(selectedRepoId, { path: item.path, content: "true" })
                .then((data) => setFileContent(data.content || ""))
                .catch((err: unknown) => setError(errorMessage(err, "파일 내용을 불러올 수 없습니다.")))
                .finally(() => setLoading(false));
        }
    };

    const handleDownload = async (item: FileEntry, event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (!selectedRepoId || !item?.path) return;
        setDownloadingPath(item.path);
        setError("");
        try {
            const blob = await api.repos.downloadFile(selectedRepoId, { path: item.path });
            const downloadName = item.type === "folder"
                ? `${item.name || item.path.split("/").pop() || "folder"}.zip`
                : (item.name || item.path.split("/").pop() || "file");

            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = downloadName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);

            toast.show(`${downloadName} 다운로드를 시작합니다.`, "info");
        } catch (e) {
            setError(errorMessage(e, "파일을 다운로드할 수 없습니다."));
        } finally {
            setDownloadingPath("");
        }
    };

    // 파일 저장 → 바로 커밋/푸시 모달 열기
    const handleSave = async () => {
        if (!selectedRepoId || !selectedFile) return;
        setLoading(true);
        setError("");
        try {
            // 최신 내용 서버 반영
            await api.repos.updateFile(selectedRepoId, { path: selectedFile, content: fileContent });
            toast.show("저장 완료! 커밋/푸시로 이어갑니다.", "success");
            // 저장 성공 → 모달 오픈
            setQcTargetPath(selectedFile);
            setQcOpen(true);
        } catch (e) {
            setError(errorMessage(e, "저장에 실패했습니다."));
        } finally {
            setLoading(false);
        }
    };

    // 파일/폴더 삭제
    const handleDelete = async (item: FileEntry, e: MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation(); // 클릭 이벤트 전파 방지 (파일 열기 방지)
        if (!selectedRepoId) return;

        const itemType = item.type === "folder" ? "폴더" : "파일";
        const confirmMessage = `정말로 이 ${itemType}을(를) 삭제하시겠습니까?\n\n${item.name}\n\n이 작업은 되돌릴 수 없습니다.`;

        if (!window.confirm(confirmMessage)) {
            return;
        }

        setLoading(true);
        setError("");
        try {
            await api.repos.deleteFile(selectedRepoId, { path: item.path });
            toast.show(`${itemType} 삭제 완료: ${item.name}`, "success");

            // 현재 선택된 파일이 삭제된 경우 선택 해제
            if (selectedFile === item.path) {
                setSelectedFile("");
                setFileContent("");
            }

            // 목록 새로고침
            fetchData(currentPath);
        } catch (e) {
            setError(errorMessage(e, `${itemType} 삭제에 실패했습니다.`));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="panel file-browser-panel">
            {/* 헤더 */}
            <div className="file-browser-header">
                <button
                    className="btn btn-ghost"
                    onClick={() => {
                        if (!currentPath) return;
                        const parts = currentPath.split("/");
                        parts.pop();
                        fetchData(parts.join("/"));
                    }}
                >
                    &larr; 상위 폴더
                </button>
                <div className="current-path">
                    현재 경로: /<span>{currentPath || "최상단(root)"}</span>
                </div>
            </div>

            {loading && (
                <div>
                    <span className="spinner" /> 로딩 중...
                </div>
            )}
            {error && <div className="error-box">{error}</div>}

            <div className="file-browser-layout">
                {/* 좌측 목록 */}
                <div className="file-list-container">
                    {items.length === 0 && !loading && <div className="empty">빈 폴더입니다.</div>}
                    {items.map((item) => (
                        <div
                            key={item.path}
                            className={`file-item ${item.type} ${selectedFile === item.path ? "active" : ""}`}
                            onClick={() => handleItemClick(item)}
                            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, overflow: "hidden" }}>
                                <span className="file-icon">{item.type === "folder" ? "📁" : "📄"}</span>
                                <span className="file-name">{item.name}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <button
                                    className="btn btn-ghost fb-icon-btn fb-icon-btn--download"
                                    onClick={(e) => handleDownload(item, e)}
                                    title="다운로드"
                                >
                                    {downloadingPath === item.path ? "…" : "⬇️"}
                                </button>
                                <button
                                    className="btn btn-ghost fb-icon-btn fb-icon-btn--delete"
                                    onClick={(e) => handleDelete(item, e)}
                                    title="삭제"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* 우측 에디터 */}
                <div className="file-content-container">
                    {selectedFile ? (
                        <div className="editor-container">
                            <div className="editor-toolbar">
                                <div className="filename">{selectedFile}</div>
                                <button className="btn btn-primary save-btn" onClick={handleSave}>
                                    저장
                                </button>
                            </div>
                            <textarea
                                className="code-editor"
                                value={fileContent}
                                onChange={(e) => setFileContent(e.target.value)}
                                spellCheck={false}
                            />
                        </div>
                    ) : (
                        <div className="empty">파일을 선택하면 내용이 여기에 표시됩니다.</div>
                    )}
                </div>
            </div>

            {/* 저장 후 바로 커밋/푸시 모달 */}
            <QuickCommitPushModal
                open={qcOpen}
                repoId={selectedRepoId}
                filePath={qcTargetPath}
                fileContent={fileContent}
                onClose={() => setQcOpen(false)}
                onDone={({ branch, message }: { branch: string; message: string }) => {
                    setQcOpen(false);
                    toast.show(`커밋/푸시 완료 (${branch}): ${message}`, "success");
                }}
            />
        </div>
    );
}
