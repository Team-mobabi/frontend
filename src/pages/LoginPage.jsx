import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";

export default function LoginPage() {
    const nav = useNavigate();
    const { login } = useAuth();
    const [form, setForm] = useState({ email: "", password: "" });
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");

    const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const onSubmit = async (e) => {
        e.preventDefault();
        setErr("");
        if (!form.email.trim() || !form.password.trim()) {
            setErr("이메일과 비밀번호를 입력하세요.");
            return;
        }
        setBusy(true);
        try {
            await login({ email: form.email.trim(), password: form.password });
            nav("/app");
        } catch (e) {
            const msg = (e?.data?.message || e?.message || "로그인에 실패했습니다.").toString();
            setErr(Array.isArray(msg) ? msg.join("\n") : msg);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="splash" style={{ justifyContent: "center", alignItems: "center" }}>
            <form className="auth-form" onSubmit={onSubmit}>
                <div className="auth-header">
                    <h4>로그인</h4>
                </div>
                <div className="auth-body">
                    <div className="form-group">
                        <label htmlFor="email">이메일</label>
                        <input className="input" id="email" type="email" name="email" placeholder="email@example.com" value={form.email} onChange={onChange} disabled={busy} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">비밀번호</label>
                        <input className="input" id="password" type="password" name="password" placeholder="비밀번호" value={form.password} onChange={onChange} disabled={busy} />
                    </div>
                    {err && <div className="auth-error">{err}</div>}
                </div>
                <div className="auth-actions">
                    <button className="btn btn-primary" type="submit" disabled={busy}>
                        {busy ? "로그인 중…" : "로그인"}
                    </button>
                </div>
                <div className="auth-footer">
                    계정이 없으신가요? <Link to="/signup">회원가입</Link>
                </div>
            </form>
        </div>
    );
}