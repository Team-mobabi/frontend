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
                    const me = await api.user.me();
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
        const me = await api.user.me();
        setUser(me);
        return me;
    };

    const login = async ({ email, password }) => {
        try {
            localStorage.removeItem("selectedRepoId");
        } catch {}

        const res = await api.auth.signin({ email, password });
        const token = res?.token || res?.accessToken || res?.access_token || res?.jwt || res?.id_token;
        if (!token) throw new Error("로그인 토큰을 받지 못했습니다.");
        setToken(token);
        return await refresh();
    };

    const signout = async () => {
        try { await api.auth.signout(); } catch {}
        clearToken();
        setUser(null);
        try {
            localStorage.removeItem("selectedRepoId");
        } catch {}
        window.location.assign("/login");
    };

    return (
        <AuthCtx.Provider value={{ user, busy, setUser, refresh, login, signout }}>
            {children}
        </AuthCtx.Provider>
    );
}

export const useAuth = () => useContext(AuthCtx);