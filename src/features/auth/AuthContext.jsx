import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../API";

const Ctx = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [busy, setBusy] = useState(true);

    const hydrate = async () => {
        try {
            const me = await api.user.me();
            setUser(me);
        } catch {
            setUser(null);
        } finally {
            setBusy(false);
        }
    };

    useEffect(() => {
        if (api.auth.getToken()) hydrate();
        else setBusy(false);
    }, []);

    const login = async (email, password) => {
        await api.auth.signin({ email, password });
        await hydrate();
    };

    const signup = async (email, password) => {
        await api.auth.signup({ email, password });
        await login(email, password);
    };

    const logout = async () => {
        await api.auth.signout();
        setUser(null);
    };

    return (
        <Ctx.Provider value={{ user, busy, login, signup, logout }}>
            {children}
        </Ctx.Provider>
    );
}

export const useAuth = () => useContext(Ctx);
