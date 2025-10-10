import React from "react";
import { api, clearToken } from "../../features/API";

export default function Header() {
    const handleLogout = async () => {
        try {
            // 서버 쪽 세션(있다면) 종료 시도 — 실패해도 무시
            await api.auth.signout();
        } catch (e) {
            console.warn("서버 로그아웃 실패:", e?.message || e);
        } finally {
            // 클라이언트 토큰/세션 정리
            try { clearToken(); } catch {}
            try { localStorage.removeItem("gitgui_token"); } catch {}
            try { sessionStorage.clear(); } catch {}
            // 로그인 페이지로 이동 (라우터 상황과 무관하게 확실히 이동)
            window.location.assign("/login");
        }
    };

    return (
        <header className="app-header">
            <div className="app-logo" />
            <div className="app-title">mobabi</div>
            <div className="app-spacer" />
            <div className="user-info" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className="text-sm text-gray-600">사용자명</span>
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
