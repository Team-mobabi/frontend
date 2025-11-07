import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Header from "../components/Header/Header";
import { api } from "../features/API";
import { stripGitFromArchive } from "../utils/archiveUtils.js";

function formatDate(value) {
    if (!value) return "";
    try {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        const now = new Date();
        const diff = Math.abs(now - date);
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (minutes < 1) return "방금 전";
        if (minutes < 60) return `${minutes}분 전`;
        if (hours < 24) return `${hours}시간 전`;
        if (days < 7) return `${days}일 전`;
        return date.toLocaleString();
    } catch {
        return "";
    }
}

function PublicRepoFileBrowser({ repoId }) {
    const [items, setItems] = useState([]);
    const [currentPath, setCurrentPath] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileContent, setFileContent] = useState("");
    const [fileLoading, setFileLoading] = useState(false);

    const loadPath = useCallback(async (path = "") => {
        if (!repoId) return;
        setLoading(true);
        setError("");
        setSelectedFile(null);
        setFileContent("");
        try {
            const data = await api.repos.getFiles(repoId, { path: path || undefined });
            const folders = Array.isArray(data?.folders) ? data.folders : [];
            const files = Array.isArray(data?.files) ? data.files : [];
            const merged = [...folders, ...files];
            setItems(merged);
            setCurrentPath(path || "");
        } catch (err) {
            setError(err.message || "파일 목록을 불러오는 데 실패했습니다.");
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [repoId]);

    useEffect(() => {
        if (repoId) {
            loadPath("");
        }
    }, [repoId, loadPath]);

    const handleFolderOpen = (folder) => {
        if (!folder?.path) return;
        loadPath(folder.path);
    };

    const handleFileOpen = async (file) => {
        if (!file?.path || !repoId) return;
        setSelectedFile(file);
        setFileLoading(true);
        setError("");
        try {
            const data = await api.repos.getFiles(repoId, { path: file.path, content: "true" });
            setFileContent(data?.content ?? "");
        } catch (err) {
            setError(err.message || "파일 내용을 불러오는 데 실패했습니다.");
            setFileContent("");
        } finally {
            setFileLoading(false);
        }
    };

    const handleGoUp = () => {
        if (!currentPath) return;
        const parts = currentPath.split("/");
        parts.pop();
        loadPath(parts.join("/"));
    };

    return (
        <div className="public-repo-browser panel">
            <div className="browser-header">
                <div className="browser-path">
                    <button
                        className="btn btn-ghost"
                        onClick={handleGoUp}
                        disabled={!currentPath || loading}
                    >
                        ← 상위 폴더
                    </button>
                    <span className="path-display">
                        /{currentPath || "root"}
                    </span>
                </div>
                {loading && (
                    <div className="inline-status">
                        <span className="spinner" /> 파일 로딩 중...
                    </div>
                )}
            </div>

            {error && (
                <div className="error-box">
                    {error}
                </div>
            )}

            <div className="browser-body">
                <div className="browser-list">
                    {items.length === 0 && !loading && (
                        <div className="empty">항목이 없습니다.</div>
                    )}
                    {items.map((item) => {
                        const isActive = selectedFile?.path === item.path;
                        const isFolder = item.type === "folder";
                        return (
                            <button
                                key={item.path}
                                className={`browser-item ${isFolder ? "folder" : "file"} ${isActive ? "active" : ""}`}
                                onClick={() => (isFolder ? handleFolderOpen(item) : handleFileOpen(item))}
                            >
                                <span className="item-icon">{isFolder ? "📁" : "📄"}</span>
                                <span className="item-name">{item.name || item.path}</span>
                            </button>
                        );
                    })}
                </div>
                <div className="browser-viewer">
                    {selectedFile ? (
                        fileLoading ? (
                            <div className="empty">
                                <span className="spinner" /> 파일 내용을 불러오는 중...
                            </div>
                        ) : (
                            <pre className="code-viewer">
                                {fileContent || "(내용 없음)"}
                            </pre>
                        )
                    ) : (
                        <div className="empty">
                            파일을 선택하면 내용이 표시됩니다.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function PublicRepoBranches({ repoId }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [branches, setBranches] = useState([]);

    useEffect(() => {
        if (!repoId) return;
        let cancelled = false;

        async function fetchBranches() {
            setLoading(true);
            setError("");
            try {
                const [branchList, graph] = await Promise.all([
                    api.branches.list(repoId),
                    api.repos.graph(repoId, { simplified: "true" })
                ]);

                if (cancelled) return;

                const branchItems = Array.isArray(branchList?.branches)
                    ? branchList.branches
                    : Array.isArray(branchList) ? branchList : [];

                const branchNames = branchItems
                    .map((b) => {
                        if (typeof b === "string") return b;
                        if (b?.name) return b.name;
                        if (b?.branch) return b.branch;
                        return null;
                    })
                    .filter(Boolean);

                const localHeads = graph?.local?.branchHeads || graph?.branchHeads || {};
                const remoteHeads = graph?.remote?.branchHeads || {};
                const commits = [
                    ...(Array.isArray(graph?.commits) ? graph.commits : []),
                    ...(Array.isArray(graph?.local?.commits) ? graph.local.commits : []),
                    ...(Array.isArray(graph?.remote?.commits) ? graph.remote.commits : []),
                ];

                const commitMap = new Map();
                commits.forEach((commit) => {
                    if (!commit?.hash) return;
                    commitMap.set(commit.hash, commit);
                    if (commit.shortHash) {
                        commitMap.set(commit.shortHash, commit);
                    }
                });

                const resolveCommit = (hash) => {
                    if (!hash) return null;
                    if (commitMap.has(hash)) return commitMap.get(hash);
                    for (const [key, value] of commitMap.entries()) {
                        if (key && (key.startsWith(hash) || hash.startsWith(key))) {
                            return value;
                        }
                    }
                    return null;
                };

                const allBranchesSet = new Set([
                    ...branchNames,
                    ...Object.keys(localHeads),
                    ...Object.keys(remoteHeads),
                ]);

                const branchSummaries = Array.from(allBranchesSet).map((name) => {
                    const headHash = localHeads[name] || remoteHeads[name] || "";
                    const commit = resolveCommit(headHash);
                    return {
                        name,
                        headHash,
                        shortHash: headHash ? headHash.slice(0, 7) : "",
                        message: commit?.message || "",
                        author: commit?.author || "",
                        committedAt: commit?.committedAt || commit?.date || "",
                    };
                }).sort((a, b) => a.name.localeCompare(b.name));

                setBranches(branchSummaries);
            } catch (err) {
                if (cancelled) return;
                setError(err.message || "브랜치 정보를 불러오는 데 실패했습니다.");
                setBranches([]);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        fetchBranches();
        return () => {
            cancelled = true;
        };
    }, [repoId]);

    return (
        <div className="panel branch-summary-panel">
            <div className="panel-header">
                <h3>브랜치</h3>
                {loading && <span className="spinner small" />}
            </div>
            {error && (
                <div className="error-box small">
                    {error}
                </div>
            )}
            {!loading && branches.length === 0 && !error && (
                <div className="empty">브랜치를 찾을 수 없습니다.</div>
            )}
            <div className="branch-list">
                {branches.map((branch) => (
                    <div key={branch.name} className="branch-card">
                        <div className="branch-name">{branch.name}</div>
                        <div className="branch-meta">
                            {branch.shortHash && (
                                <span className="branch-hash">#{branch.shortHash}</span>
                            )}
                            {branch.message && (
                                <span className="branch-message">{branch.message}</span>
                            )}
                        </div>
                        <div className="branch-footer">
                            {branch.author && <span className="branch-author">{branch.author}</span>}
                            {branch.committedAt && (
                                <span className="branch-date">{formatDate(branch.committedAt)}</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function PublicRepoDetailPage() {
    const { repoId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    const locationRepo = location.state?.repo;
    const [repoInfo, setRepoInfo] = useState(locationRepo || null);
    const [loading, setLoading] = useState(!locationRepo);
    const [error, setError] = useState("");
    const [downloading, setDownloading] = useState(false);
    const [downloadError, setDownloadError] = useState("");

    useEffect(() => {
        if (!repoId) {
            setError("레포지토리 ID가 제공되지 않았습니다.");
            setLoading(false);
            return;
        }
        if (locationRepo) return;

        let cancelled = false;
        async function fetchRepo() {
            setLoading(true);
            setError("");
            try {
                const attempt = await api.repos.listPublic({ repoId });
                if (cancelled) return;
                const arr = Array.isArray(attempt?.repositories)
                    ? attempt.repositories
                    : Array.isArray(attempt?.items)
                        ? attempt.items
                        : Array.isArray(attempt)
                            ? attempt
                            : [];

                const found = arr.find((repo) => {
                    const id = repo?.id || repo?._id || repo?.repoId || repo?.repositoryId;
                    return String(id) === String(repoId);
                });

                if (found) {
                    setRepoInfo(found);
                    return;
                }

                const fallbackList = await api.repos.listPublic();
                if (cancelled) return;
                const fallbackArr = Array.isArray(fallbackList?.repositories)
                    ? fallbackList.repositories
                    : Array.isArray(fallbackList?.items)
                        ? fallbackList.items
                        : Array.isArray(fallbackList)
                            ? fallbackList
                            : [];
                const fallbackRepo = fallbackArr.find((repo) => {
                    const id = repo?.id || repo?._id || repo?.repoId || repo?.repositoryId;
                    return String(id) === String(repoId);
                });

                if (fallbackRepo) {
                    setRepoInfo(fallbackRepo);
                } else {
                    setError("해당 레포지토리를 찾을 수 없습니다.");
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err.message || "레포지토리 정보를 불러오지 못했습니다.");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        fetchRepo();
        return () => {
            cancelled = true;
        };
    }, [repoId, locationRepo]);

    const repoDisplayName = useMemo(() => repoInfo?.name || "레포지토리", [repoInfo]);
    const ownerName = useMemo(() => {
        const owner = repoInfo?.owner;
        if (!owner) return "";
        return owner.email || owner.name || owner.login || "";
    }, [repoInfo]);

    const description = repoInfo?.description || "";
    const defaultBranch = repoInfo?.defaultBranch || repoInfo?.default_branch || "";
    const updatedAt = repoInfo?.updatedAt || repoInfo?.updated_at || repoInfo?.pushedAt || repoInfo?.pushed_at;

    const handleBack = useCallback(() => {
        if (window.history.length > 2) {
            navigate(-1);
        } else {
            navigate("/public-repos");
        }
    }, [navigate]);

    const handleDownload = useCallback(async () => {
        if (!repoId) return;
        setDownloadError("");
        setDownloading(true);
        try {
            const archive = await api.repos.downloadRepo(repoId);
            let sanitizedArchive = archive;
            try {
                sanitizedArchive = await stripGitFromArchive(archive);
            } catch (stripError) {
                console.warn("[PublicRepoDetailPage] Failed to strip .git directory; downloading original archive.", stripError);
            }
            const repoName = repoDisplayName || `repo-${repoId}`;
            const blobUrl = URL.createObjectURL(sanitizedArchive);
            const link = document.createElement("a");
            link.href = blobUrl;
            link.download = `${repoName}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
        } catch (downloadErr) {
            setDownloadError(downloadErr?.message || "저장소 다운로드에 실패했습니다.");
        } finally {
            setDownloading(false);
        }
    }, [repoId, repoDisplayName]);

    return (
        <div className="public-repo-detail-page">
            <Header />
            <div className="page-content">
                <div className="detail-header">
                    <button className="btn btn-ghost" onClick={handleBack}>
                        ← 목록으로
                    </button>
                </div>

                {loading && (
                    <div className="panel">
                        <span className="spinner" /> 레포지토리 정보를 불러오는 중입니다...
                    </div>
                )}

                {error && (
                    <div className="panel error-box">
                        {error}
                    </div>
                )}

                {!loading && !error && (
                    <>
                          <div className="panel repo-summary">
                              <h2>{repoDisplayName}</h2>
                              <div className="repo-meta">
                                  {ownerName && <span>소유자: {ownerName}</span>}
                                  {defaultBranch && <span>기본 브랜치: {defaultBranch}</span>}
                                  {updatedAt && <span>최근 업데이트: {formatDate(updatedAt)}</span>}
                              </div>
                              <div className="repo-summary-actions">
                                  <button
                                      className="btn btn-primary"
                                      onClick={handleDownload}
                                      disabled={loading || downloading}
                                  >
                                      {downloading ? "⬇️ 다운로드 준비 중..." : "⬇️ 저장소 다운로드"}
                                  </button>
                                  <div className="download-note">저장소 다운로드 시 .git 폴더는 포함되지 않습니다.</div>
                              </div>
                            {downloadError && (
                                <div className="repo-summary-error">
                                    {downloadError}
                                </div>
                            )}
                            {description && (
                                <p className="repo-description">
                                    {description}
                                </p>
                            )}
                        </div>

                        <div className="detail-layout">
                            <PublicRepoFileBrowser repoId={repoId} />
                            <div className="detail-sidebar">
                                <PublicRepoBranches repoId={repoId} />
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
