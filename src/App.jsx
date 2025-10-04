import React from "react";
import { AuthProvider, useAuth } from "./features/auth/AuthContext";
import { GitProvider } from "./features/GitCore/GitContext";
import HomePage from "./pages/Home/HomePage";
import LoginPage from "./pages/LoginPage";
import "./assets/styles/App.css";
import logo from "./assets/styles/logo.png";

function Gate() {
    const { user, busy } = useAuth();
    if (busy) return null;
    if (!user) return <LoginPage />;
    return (
        <GitProvider>
            <div className="App">
                <div className="app-header">
                    <div className="app-logo">
                        <img src={logo} alt="mobabi logo" />
                    </div>
                    <div className="app-title">mobabi</div>
                    <div className="app-spacer" />
                </div>
                <HomePage />
            </div>
        </GitProvider>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <Gate />
        </AuthProvider>
    );
}
