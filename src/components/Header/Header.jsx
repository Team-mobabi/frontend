import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import UserSearchModal from "../Modal/UserSearchModal.jsx";
import logoImage from '../../assets/styles/logo.png';
import { useAuth } from "../../features/auth/AuthContext.jsx";
import { useGit } from '../../features/GitCore/GitContext';
import CollaboratorModal from '../../components/Modal/CollaboratorModal';

export default function Header() {
    const nav = useNavigate();
    const { user, logout } = useAuth();
    const [modalOpen, setModalOpen] = useState(false);
    const { state } = useGit();
    const repoId = state.selectedRepoId;
    const [collabModalOpen, setCollabModalOpen] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    const handleSignout = () => {
        logout();
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
                <button
                    className="btn btn-ghost btn-secondary"
                    onClick={() => setCollabModalOpen(true)}
                    title="현재 리포지토리 협업자 관리"
                >
                    ⚙️ 협업자 관리
                </button>
            )}
            <CollaboratorModal
                open={collabModalOpen}
                onClose={() => setCollabModalOpen(false)}
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