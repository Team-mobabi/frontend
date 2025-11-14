import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import UserSearchModal from "../Modal/UserSearchModal.jsx";
import logoImage from '../../assets/styles/logo.png';
import { useAuth } from "../../features/auth/AuthContext.jsx";
import { useGit } from '../../features/GitCore/GitContext';
import { api } from "../../features/API.js";
import CollaboratorModal from '../../components/Modal/CollaboratorModal';
import { stripGitFromArchive } from "../../utils/archiveUtils.js";

export default function Header() {
    const nav = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    const [modalOpen, setModalOpen] = useState(false);
    const { state, dispatch } = useGit();
    const repoId = state.selectedRepoId;
    const repositories = state.repositories || [];
    const currentRepo = repositories.find((repo) => String(repo?.id || repo?.repoId || repo?._id) === String(repoId));
    const collabModalState = state.collaboratorModal || {};
    const collabModalOpen = collabModalState.open;
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const [downloadingRepo, setDownloadingRepo] = useState(false);
    const inRepositoryView = location?.pathname?.startsWith("/app");
    const canDownloadRepository = Boolean(repoId && inRepositoryView);

    const handleSignout = () => {
        logout();
    };

    const handleDownloadRepo = async () => {
        if (!repoId) return;
        setDownloadingRepo(true);
        try {
            const blob = await api.repos.downloadRepo(repoId);
            let downloadBlob = blob;
            try {
                downloadBlob = await stripGitFromArchive(blob);
            } catch (stripError) {
                console.warn("[Header] Failed to strip .git directory, downloading original archive.", stripError);
            }
            const repoName = currentRepo?.name || `repo-${repoId}`;
            const blobUrl = URL.createObjectURL(downloadBlob);
            const link = document.createElement("a");
            link.href = blobUrl;
            link.download = `${repoName}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
        } catch (err) {
            alert(err?.message || "저장소 다운로드에 실패했습니다.");
        } finally {
            setDownloadingRepo(false);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        };

        if (dropdownOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [dropdownOpen]);

    return (
        <header className="app-header">
            <Link to="/app" className="app-logo">
                <img src={logoImage} alt="Mobabi Logo" />
            </Link>
            <div className="app-title">Mobabi</div>
            <div className="app-spacer" />

            <button className="btn btn-ghost" onClick={() => nav("/public-repos")} title="공개 레포 탐색">
                🌍 공개 레포 탐색
            </button>

            <button className="btn btn-ghost" onClick={() => setModalOpen(true)} title="사용자 검색">
                🔍 사용자 검색
            </button>
            {repoId && (
                <>
                        {canDownloadRepository && (
                            <div className="header-download-group">
                                <button
                                    className="btn btn-ghost"
                                    onClick={handleDownloadRepo}
                                    title="저장소 다운로드 시 .git 폴더는 포함되지 않습니다."
                                    disabled={downloadingRepo}
                                >
                                    {downloadingRepo ? "⬇️ 다운로드 중..." : "⬇️ 저장소 다운로드"}
                                </button>
                            </div>
                        )}
                    <button
                        className="btn btn-ghost btn-secondary"
                        onClick={() => {
                            if (!repoId) return;
                            dispatch({ type: "OPEN_COLLABORATOR_MODAL", payload: { repoId } });
                        }}
                        title="현재 리포지토리 협업자 관리"
                    >
                        ⚙️ 협업자 관리
                    </button>
                </>
            )}
            <CollaboratorModal
                open={collabModalOpen}
                onClose={() => dispatch({ type: "CLOSE_COLLABORATOR_MODAL" })}
            />

            {/* 사용자 드롭다운 메뉴 */}
            {user?.email && (
                <div className="user-dropdown" ref={dropdownRef}>
                    <button
                        className="user-email-button"
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        title="계정 메뉴 열기"
                    >
                        {user.email}
                        <span className="dropdown-arrow">{dropdownOpen ? "▲" : "▼"}</span>
                    </button>

                    {dropdownOpen && (
                        <div className="user-dropdown-menu">
                            <button
                                className="dropdown-item"
                                onClick={() => {
                                    setDropdownOpen(false);
                                    nav("/settings");
                                }}
                            >
                                ⚙️ 계정 설정
                            </button>
                            <div className="dropdown-divider" />
                            <button
                                className="dropdown-item"
                                onClick={() => {
                                    setDropdownOpen(false);
                                    handleSignout();
                                }}
                            >
                                🚪 로그아웃
                            </button>
                        </div>
                    )}
                </div>
            )}

            <UserSearchModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
            />
        </header>
    );
}