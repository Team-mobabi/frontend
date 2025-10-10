import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./features/auth/AuthContext";
import { GitProvider } from "./features/GitCore/GitContext.jsx";
import HomePage from "./pages/Home/HomePage";
import LoginPage from "./pages/LoginPage";
import SplashPage from "./pages/Splash/SplashPage";
import SignupPage from "./pages/SignupPage"; // ⬅️ 추가
import "./assets/styles/App.css";

function Gate() {
    const { user, busy } = useAuth();
    if (busy) return null;

    if (!user) {
        // 비로그인 상태: 랜딩/로그인/회원가입만 접근 허용
        return (
            <Routes>
                <Route path="/" element={<SplashPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} /> {/* ⬅️ 추가 */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        );
    }

    // 로그인 상태: /app으로
    return (
        <GitProvider>
            <Routes>
                <Route path="/app" element={<HomePage />} />
                <Route path="/" element={<Navigate to="/app" replace />} />
                <Route path="/login" element={<Navigate to="/app" replace />} />
                <Route path="/signup" element={<Navigate to="/app" replace />} /> {/* ⬅️ 가드 */}
                <Route path="*" element={<Navigate to="/app" replace />} />
            </Routes>
        </GitProvider>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Gate />
            </BrowserRouter>
        </AuthProvider>
    );
}
