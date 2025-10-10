import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
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
        <form className="modal" onSubmit={onSubmit} style={{ width: 420, margin: "10vh auto", padding: 16 }}>
            <div className="modal-head"><h4>로그인</h4></div>
            <div className="modal-body" style={{ display: "grid", gap: 10 }}>
                <input className="input" type="email" name="email" placeholder="이메일" value={form.email} onChange={onChange} />
                <input className="input" type="password" name="password" placeholder="비밀번호" value={form.password} onChange={onChange} />
                {err && <div style={{ color: "var(--danger)", fontSize: 12, whiteSpace: "pre-line" }}>{err}</div>}
            </div>
            <div className="modal-actions" style={{ justifyContent: "flex-end" }}>
                <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "로그인 중…" : "로그인"}</button>
            </div>
        </form>
    );
}
