import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import UserSearchModal from "../Modal/UserSearchModal";
import logoImage from '../../assets/styles/logo.png';
import { useAuth } from "../../features/auth/AuthContext";
import { useGit } from '../../features/GitCore/GitContext';
import { repoIdOf } from "../../features/GitCore/gitUtils";
import { useRepoArchiveDownload } from "../../features/Repo/useRepoArchiveDownload";
import CollaboratorModal from '../../components/Modal/CollaboratorModal';
import { useToast } from "../Toast/ToastProvider";

export default function Header() {
    const nav = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    const [modalOpen, setModalOpen] = useState(false);
    const { state, dispatch } = useGit();
    const repoId = state.selectedRepoId;
    const repositories = state.repositories || [];
    const currentRepo = repositories.find((repo) => repoIdOf(repo) === String(repoId));
    const collabModalOpen = state.collaboratorModal?.open ?? false;
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { downloading: downloadingRepo, download } = useRepoArchiveDownload();
    const toast = useToast();
    const inRepositoryView = location.pathname.startsWith("/app");
    const canDownloadRepository = Boolean(repoId && inRepositoryView);

    const handleSignout = () => {
        logout();
    };

    const handleDownloadRepo = async () => {
        if (!repoId) return;
        const failure = await download(repoId, currentRepo?.name);
        if (failure) toast.show(failure, "error");
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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

            <button className="btn btn-ghost" onClick={() => nav("/public-repos")} title="공개 저장소 탐색">
                🌍 공개 저장소 탐색
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