import React, { createContext, useContext, useEffect, useState } from "react";
import { api, getToken, clearToken } from "../API";
import { LS_KEY as LAST_REPO_KEY } from "../GitCore/GitContext.jsx";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [busy, setBusy] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const t = getToken();
                if (t) {
                    const me = await api.users.me(); // users.me 호출
                    setUser(me);
                } else {
                    setUser(null);
                }
            } catch {
                clearToken();
                setUser(null);
                try {
                    localStorage.removeItem(LAST_REPO_KEY);
                } catch {}
            } finally {
                setBusy(false);
            }
        })();
    }, []);

    const refresh = async () => {
        const me = await api.users.me(); // users.me 호출
        setUser(me);
        return me;
    };

    const login = async ({ email, password }) => {
        try {
            localStorage.removeItem(LAST_REPO_KEY);
        } catch {}

        // 토큰 검증·저장은 api.auth.login에서 처리
        await api.auth.login({ email, password });
        return await refresh();
    };

    const logout = async () => {
        try {
            await api.auth.logout(); // auth.logout 호출
        } catch (err) {
            console.error("Logout API failed:", err);
        }

        clearToken();
        setUser(null);
        try {
            localStorage.removeItem(LAST_REPO_KEY);
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