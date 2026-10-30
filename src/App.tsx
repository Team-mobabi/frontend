import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./features/auth/AuthContext";
import { GitProvider } from "./features/GitCore/GitContext";
import { ToastProvider } from "./components/Toast/ToastProvider";
import HomePage from "./pages/Home/HomePage";
import LoginPage from "./pages/LoginPage";
import SplashPage from "./pages/Splash/SplashPage";
import SignupPage from "./pages/SignupPage";
import PublicReposPage from "./pages/PublicReposPage";
import PublicRepoDetailPage from "./pages/PublicRepoDetailPage";
import SettingsPage from "./pages/SettingsPage";

function Gate() {
    const { user, busy } = useAuth();
    if (busy) {
        return (
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div className="spinner" role="status" aria-label="로딩 중" />
            </div>
        );
    }

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
                <Route path="/public-repos/:repoId" element={<PublicRepoDetailPage />} />
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
            <ToastProvider>
                <BrowserRouter basename={import.meta.env.BASE_URL}>
                    <Gate />
                </BrowserRouter>
            </ToastProvider>
        </AuthProvider>
    );
}