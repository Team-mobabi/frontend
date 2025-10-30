import React, { createContext, useContext, useEffect, useState } from "react";
import { api, getToken, setToken, clearToken } from "../API";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [busy, setBusy] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const t = getToken();
                if (t) {
                    const me = await api.users.me(); // 'user' -> 'users' (복수)
                    setUser(me);
                } else {
                    setUser(null);
                }
            } catch {
                clearToken();
                setUser(null);
                try {
                    localStorage.removeItem("selectedRepoId");
                } catch {}
            } finally {
                setBusy(false);
            }
        })();
    }, []);

    const refresh = async () => {
        const me = await api.users.me(); // 'user' -> 'users' (복수)
        setUser(me);
        return me;
    };

    const login = async ({ email, password }) => {
        try {
            localStorage.removeItem("selectedRepoId");
        } catch {}

        // 'signin' -> 'login' (API.js 명세 기준)
        const res = await api.auth.login({ email, password });

        // RefreshToken 저장 로직 (이전 요청사항 반영)
        const accessToken = res?.accessToken;
        const refreshToken = res?.refreshToken;

        if (!accessToken || !refreshToken) {
            throw new Error("로그인 토큰을 받지 못했습니다.");
        }

        setToken(accessToken, refreshToken);
        return await refresh();
    };

    const logout = async () => { // 'signout' -> 'logout'
        try {
            await api.auth.logout(); // 'signout' -> 'logout' (API.js 명세 기준)
        } catch (err) {
            console.error("Logout API failed:", err);
        }

        clearToken();
        setUser(null);
        try {
            localStorage.removeItem("selectedRepoId");
        } catch {}

        try {
            const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || "/mobabi/ui";
            window.location.assign(`${base}/`);
        } catch {
            window.location.assign("/");
        }
    };

    return (
        <AuthCtx.Provider value={{ user, busy, setUser, refresh, login, logout }}>
            {children}
        </AuthCtx.Provider>
    );
}

export const useAuth = () => useContext(AuthCtx);