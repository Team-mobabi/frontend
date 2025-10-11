import React from "react";
import { useAuth } from "../../features/auth/AuthContext";

export default function Header() {
    const { user, signout } = useAuth();

    const handleLogout = () => {
        signout();
    };

    return (
        <header className="app-header">
            <div className="app-logo" />
            <div className="app-title">mobabi</div>
            <div className="app-spacer" />
            <div className="user-info" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className="text-sm text-gray-600">
                    {/* 5. user 객체가 있으면 이메일을, 없으면 '사용자'를 표시합니다. */}
                    {user ? user.email : "사용자"}
                </span>
                <button
                    className="btn btn-warn"
                    onClick={handleLogout}
                    title="로그아웃"
                >
                    로그아웃
                </button>
            </div>
        </header>
    );
}