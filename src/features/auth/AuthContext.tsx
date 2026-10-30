import { createContext, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { api, getToken, clearToken } from "../../lib/api";
import { clearLastRepo } from "../../lib/storageKeys";
import type { User } from "../../types/api";

interface AuthContextValue {
    user: User | null;
    busy: boolean;
    setUser: Dispatch<SetStateAction<User | null>>;
    refresh: () => Promise<User>;
    login: (credentials: { email: string; password: string }) => Promise<User>;
    logout: () => Promise<void>;
}

const AuthCtx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [busy, setBusy] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                if (getToken()) {
                    setUser(await api.users.me());
                } else {
                    setUser(null);
                }
            } catch {
                clearToken();
                setUser(null);
                clearLastRepo();
            } finally {
                setBusy(false);
            }
        })();
    }, []);

    const refresh = async () => {
        const me = await api.users.me();
        setUser(me);
        return me;
    };

    const login = async ({ email, password }: { email: string; password: string }) => {
        clearLastRepo();
        // 토큰 검증·저장은 api.auth.login에서 처리
        await api.auth.login({ email, password });
        return await refresh();
    };

    const logout = async () => {
        await api.auth.logout();
        setUser(null);
        clearLastRepo();
        window.location.assign(import.meta.env.BASE_URL || "/");
    };

    return (
        <AuthCtx.Provider value={{ user, busy, setUser, refresh, login, logout }}>
            {children}
        </AuthCtx.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthCtx);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
