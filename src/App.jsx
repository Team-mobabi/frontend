import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./features/auth/AuthContext"; // 경로 확인
import { GitProvider } from "./features/GitCore/GitContext.jsx"; // 경로 확인
import HomePage from "./pages/Home/HomePage"; // 경로 확인
import LoginPage from "./pages/LoginPage"; // 경로 확인
import SplashPage from "./pages/Splash/SplashPage"; // 경로 확인
import SignupPage from "./pages/SignupPage"; // 경로 확인
import PublicReposPage from "./pages/PublicReposPage";
import SettingsPage from "./pages/SettingsPage";
import "./assets/styles/App.css"; // 경로 확인

function Gate() {
    const { user, busy } = useAuth();
    if (busy) return null; // 또는 로딩 스피너

    if (!user) {
        return (
            <Routes>
                <Route path="/" element={<SplashPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        );
    }

    // 로그인 상태
    return (
        <GitProvider>
            <Routes>
                <Route path="/app" element={<HomePage />} />
                <Route path="/public-repos" element={<PublicReposPage />} />
                <Route path="/users/:userId/public-repos" element={<PublicReposPage />} />
                <Route path="/settings" element={<SettingsPage />} />

                {/* 로그인 상태에서 / (루트)로 오면 /app으로 리다이렉트 */}
                <Route path="/" element={<Navigate to="/app" replace />} />

                <Route path="/login" element={<Navigate to="/app" replace />} />
                <Route path="/signup" element={<Navigate to="/app" replace />} />
                <Route path="*" element={<Navigate to="/app" replace />} />
            </Routes>
        </GitProvider>
    );
}

export default function App() {
    return (
        <AuthProvider>
            {/* ▼▼▼ 여기에 basename 추가 ▼▼▼ */}
            <BrowserRouter basename="/mobabi/ui">
                <Gate />
            </BrowserRouter>
            {/* ▲▲▲ ▲▲▲ ▲▲▲ */}
        </AuthProvider>
    );
}