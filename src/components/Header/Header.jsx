import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import UserSearchModal from "../Modal/UserSearchModal.jsx";
import logoImage from '../../assets/styles/logo.png';
import { useAuth } from "../../features/auth/AuthContext.jsx";

export default function Header() {
    const nav = useNavigate();
    const { user, signout } = useAuth();
    const [modalOpen, setModalOpen] = useState(false);

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

            {user?.email && <span className="user-email-display">{user.email}</span>}

            <button className="btn btn-ghost" onClick={handleSignout}>로그아웃</button>

            <UserSearchModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
            />
        </header>
    );
}