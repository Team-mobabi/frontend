import React, { useState } from "react";
import { useAuth } from "../features/auth/AuthContext";

export default function LoginPage() {
    const { login, signup } = useAuth();
    const [mode, setMode] = useState("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);

    const onSubmit = async (e) => {
        e.preventDefault();
        setErr("");
        setLoading(true);
        try {
            if (mode === "login") await login(email, password);
            else await signup(email, password);
        } catch (e) {
            setErr(e?.data?.message || e?.message || "요청 실패");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: "70vh", display: "grid", placeItems: "center" }}>
            <form className="panel" style={{ width: 360, display: "grid", gap: 12 }} onSubmit={onSubmit}>
                <h3 style={{ margin: 0 }}>{mode === "login" ? "로그인" : "회원가입"}</h3>
                <input className="input" type="email" placeholder="이메일" value={email} onChange={(e)=>setEmail(e.target.value)} required />
                <input className="input" type="password" placeholder="비밀번호" value={password} onChange={(e)=>setPassword(e.target.value)} required />
                {err && <div className="empty" style={{ color: "var(--danger)" }}>{err}</div>}
                <button className="btn btn-primary" type="submit" disabled={loading}>
                    {loading ? "처리 중..." : (mode === "login" ? "로그인" : "가입 후 로그인")}
                </button>
                <button type="button" className="btn btn-ghost" onClick={()=>setMode(mode==="login"?"signup":"login")}>
                    {mode === "login" ? "회원가입으로 전환" : "로그인으로 전환"}
                </button>
            </form>
        </div>
    );
}
