import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import UserSearchModal from "../Modal/UserSearchModal.jsx";
import logoImage from '../../assets/styles/logo.png';
import { useAuth } from "../../features/auth/AuthContext.jsx";
import { useGit } from '../../features/GitCore/GitContext';
import CollaboratorModal from '../../components/Modal/CollaboratorModal';

export default function Header() {
    const nav = useNavigate();
    const { user, signout } = useAuth();
    const [modalOpen, setModalOpen] = useState(false);
    const { state } = useGit();
    const repoId = state.selectedRepoId;
    const [collabModalOpen, setCollabModalOpen] = useState(false);

    const handleSignout = () => {
        signout();
    };

    return (
        <header className="app-header">
            <Link to="/app" className="app-logo">
                <img src={logoImage} alt="Mobabi Logo" />
            </Link>
            <div className="app-title">Mobabi</div>
            <div className="app-spacer" />

            <Link to="/public-repos" className="btn btn-ghost header-link-btn">
                🌍 공개 레포 탐색
            </Link>

            <button className="btn btn-ghost header-link-btn" onClick={() => setModalOpen(true)} title="사용자 검색">
                🔍 사용자 검색
            </button>
            {repoId && (
                <button
                    className="btn btn-secondary" // (기존 버튼 스타일에 맞게)
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

            {user?.email && <span className="user-email-display">{user.email}</span>}

            <button className="btn btn-ghost" onClick={handleSignout}>로그아웃</button>

            <UserSearchModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
            />
        </header>
    );
}