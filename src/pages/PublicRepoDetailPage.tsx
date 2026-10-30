import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Header from "../components/Header/Header";
import { api, errorMessage } from "../lib/api";
import { repoIdOf } from "../features/GitCore/gitUtils";
import { useRepoArchiveDownload } from "../features/Repo/useRepoArchiveDownload";
import { branchNamesOf, listOf } from "../lib/normalize";
import type { FileEntry, GraphCommit, GraphSide, Id, Repo, RepoGraph } from "../types/api";

// 공개 저장소 응답은 서버 버전에 따라 snake_case 필드가 섞여 온다
type PublicRepo = Repo & {
    default_branch?: string;
    updated_at?: string;
    pushed_at?: string;
};

const REPO_LIST_KEYS = ["repositories", "items", "repos", "data"] as const;

// simplified 그래프는 local/remote 없이 최상위에 branchHeads/commits 가 올 수 있다
type PublicGraph = RepoGraph & Pick<GraphSide, "branchHeads" | "commits">;
type PublicCommit = GraphCommit & { committedAt?: string };

interface BranchSummary {
    name: string;
    headHash: string;
    shortHash: string;
    message: string;
    author: string;
    committedAt: string;
}

function matchesRepoId(repo: PublicRepo, repoId: string): boolean {
    const id = repoIdOf(repo) || repo.repositoryId;
    return String(id) === String(repoId);
}

function formatDate(value: string | undefined): string {
    if (!value) return "";
    try {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        const now = new Date();
        const diff = Math.abs(now.getTime() - date.getTime());
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

function PublicRepoFileBrowser({ repoId }: { repoId: Id }) {
    const [items, setItems] = useState<FileEntry[]>([]);
    const [currentPath, setCurrentPath] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
    const [fileContent, setFileContent] = useState("");
    const [fileLoading, setFileLoading] = useState(false);

    const loadPath = useCallback(async (path = "") => {
        if (!repoId) return;
        setLoading(true);
        setError("");
        setSelectedFile(null);
        setFileContent("");
        try {
            const data = await api.repos.listFiles(repoId, { path: path || undefined });
            const folders = Array.isArray(data?.folders) ? data.folders : [];
            const files = Array.isArray(data?.files) ? data.files : [];
            const merged = [...folders, ...files];
            setItems(merged);
            setCurrentPath(path || "");
        } catch (err) {
            setError(errorMessage(err, "파일 목록을 불러오는 데 실패했습니다."));
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

    const handleFolderOpen = (folder: FileEntry) => {
        if (!folder?.path) return;
        loadPath(folder.path);
    };

    const handleFileOpen = async (file: FileEntry) => {
        if (!file?.path || !repoId) return;
        setSelectedFile(file);
        setFileLoading(true);
        setError("");
        try {
            const data = await api.repos.listFiles(repoId, { path: file.path, content: "true" });
            setFileContent(data?.content ?? "");
        } catch (err) {
            setError(errorMessage(err, "파일 내용을 불러오는 데 실패했습니다."));
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

function PublicRepoBranches({ repoId }: { repoId: Id }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [branches, setBranches] = useState<BranchSummary[]>([]);

    useEffect(() => {
        if (!repoId) return;
        let cancelled = false;

        async function fetchBranches() {
            setLoading(true);
            setError("");
            try {
                const [branchList, graph]: [Awaited<ReturnType<typeof api.branches.list>>, PublicGraph | null] = await Promise.all([
                    api.branches.list(repoId),
                    api.repos.graph(repoId, { simplified: "true" }),
                ]);

                if (cancelled) return;

                const branchNames = branchNamesOf(branchList);

                const localHeads = graph?.local?.branchHeads || graph?.branchHeads || {};
                const remoteHeads = graph?.remote?.branchHeads || {};
                const commits: PublicCommit[] = [
                    ...(Array.isArray(graph?.commits) ? graph.commits : []),
                    ...(Array.isArray(graph?.local?.commits) ? graph.local.commits : []),
                    ...(Array.isArray(graph?.remote?.commits) ? graph.remote.commits : []),
                ];

                const commitMap = new Map<string, PublicCommit>();
                commits.forEach((commit) => {
                    if (!commit?.hash) return;
                    commitMap.set(commit.hash, commit);
                    if (commit.shortHash) {
                        commitMap.set(commit.shortHash, commit);
                    }
                });

                const resolveCommit = (hash: string): PublicCommit | null => {
                    if (!hash) return null;
                    const exact = commitMap.get(hash);
                    if (exact) return exact;
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

                const branchSummaries: BranchSummary[] = Array.from(allBranchesSet).map((name) => {
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
                setError(errorMessage(err, "브랜치 정보를 불러오는 데 실패했습니다."));
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

    // PublicReposPage 의 <Link state={{ repo }}> 로 전달된다
    const locationRepo = (location.state as { repo?: PublicRepo } | null)?.repo;
    const [repoInfo, setRepoInfo] = useState<PublicRepo | null>(locationRepo || null);
    const [loading, setLoading] = useState(!locationRepo);
    const [error, setError] = useState("");
    const { downloading, download } = useRepoArchiveDownload();
    const [downloadError, setDownloadError] = useState("");

    useEffect(() => {
        if (!repoId) {
            setError("저장소 ID가 제공되지 않았습니다.");
            setLoading(false);
            return;
        }
        if (locationRepo) return;

        let cancelled = false;
        async function fetchRepo(id: string) {
            setLoading(true);
            setError("");
            try {
                const attempt = await api.repos.listPublic({ repoId: id });
                if (cancelled) return;
                const found = listOf<PublicRepo>(attempt, REPO_LIST_KEYS).find((repo) => matchesRepoId(repo, id));

                if (found) {
                    setRepoInfo(found);
                    return;
                }

                const fallbackList = await api.repos.listPublic();
                if (cancelled) return;
                const fallbackRepo = listOf<PublicRepo>(fallbackList, REPO_LIST_KEYS).find((repo) => matchesRepoId(repo, id));

                if (fallbackRepo) {
                    setRepoInfo(fallbackRepo);
                } else {
                    setError("해당 저장소를 찾을 수 없습니다.");
                }
            } catch (err) {
                if (!cancelled) {
                    setError(errorMessage(err, "저장소 정보를 불러오지 못했습니다."));
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        fetchRepo(repoId);
        return () => {
            cancelled = true;
        };
    }, [repoId, locationRepo]);

    const repoDisplayName = useMemo(() => repoInfo?.name || "저장소", [repoInfo]);
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
        setDownloadError((await download(repoId, repoDisplayName)) ?? "");
    }, [repoId, repoDisplayName, download]);

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
                        <span className="spinner" /> 저장소 정보를 불러오는 중입니다...
                    </div>
                )}

                {error && (
                    <div className="panel error-box">
                        {error}
                    </div>
                )}

                {!loading && !error && repoId && (
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
