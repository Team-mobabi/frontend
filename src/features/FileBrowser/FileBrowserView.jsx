import React, { useState, useEffect } from "react";
import { useGit } from "../GitCore/GitContext";
import { api } from "../API";
import QuickCommitPushModal from "../../components/Modal/QuickCommitPushModal.jsx";

export default function FileBrowserView() {
    const { state } = useGit();
    const { selectedRepoId } = state;

    const [items, setItems] = useState([]);
    const [currentPath, setCurrentPath] = useState("");
    const [fileContent, setFileContent] = useState("");
    const [selectedFile, setSelectedFile] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [qcOpen, setQcOpen] = useState(false);
    const [qcTargetPath, setQcTargetPath] = useState("");
    const [toast, setToast] = useState("");

    const fetchData = (path) => {
        if (!selectedRepoId) return;
        setLoading(true);
        setError("");
        setFileContent("");
        setSelectedFile("");

        api.repos.getFiles(selectedRepoId, { path: path || undefined })
            .then((data) => {
                setItems(data.files || []);
                setCurrentPath(path || "");
            })
            .catch((err) => setError(err.message || "파일 목록을 불러올 수 없습니다."))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (selectedRepoId) fetchData("");
    }, [selectedRepoId]);

    const handleItemClick = (item) => {
        if (item.type === "folder") {
            fetchData(item.path);
        } else {
            setLoading(true);
            setSelectedFile(item.path);
            api.repos.getFiles(selectedRepoId, { path: item.path, content: "true" })
                .then((data) => setFileContent(data.content || ""))
                .catch((err) => setError(err.message || "파일 내용을 불러올 수 없습니다."))
                .finally(() => setLoading(false));
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
            setToast("저장 완료! 커밋/푸시로 이어갑니다.");
            // 저장 성공 → 모달 오픈
            setQcTargetPath(selectedFile);
            setQcOpen(true);
        } catch (e) {
            setError(e.message || "저장에 실패했습니다.");
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
                    disabled={!currentPath || loading}
                >
                    &larr; 상위 폴더
                </button>
                <div className="current-path">
                    현재 경로: /<span>{currentPath || "(루트)"}</span>
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
                        >
                            <span className="file-icon">{item.type === "folder" ? "📁" : "📄"}</span>
                            <span className="file-name">{item.name}</span>
                        </div>
                    ))}
                </div>

                {/* 우측 에디터 */}
                <div className="file-content-container">
                    {selectedFile ? (
                        <div className="editor-container">
                            <div className="editor-toolbar">
                                <div className="filename">{selectedFile}</div>
                                <button className="btn btn-primary save-btn" onClick={handleSave} disabled={loading}>
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
                onDone={({ branch, message }) => {
                    setQcOpen(false);
                    setToast(`커밋/푸시 완료 (${branch}): ${message}`);
                }}
            />

            {toast && (
                <div
                    style={{
                        position: "fixed",
                        bottom: 20,
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: "rgba(0,0,0,0.7)",
                        color: "#fff",
                        padding: "8px 14px",
                        borderRadius: 8,
                        zIndex: 1000,
                    }}
                >
                    {toast}
                    <button
                        onClick={() => setToast("")}
                        style={{ marginLeft: 10, background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}
                    >
                        ×
                    </button>
                </div>
            )}
        </div>
    );
}
