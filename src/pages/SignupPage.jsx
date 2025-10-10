import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../features/API";
import { useAuth } from "../features/auth/AuthContext";

export default function SignupPage() {
    const nav = useNavigate();
    const { login } = useAuth(); // ⬅️ 컨텍스트에서 login 사용
    const [form, setForm] = useState({ email: "", password: "" });
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");

    const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const onSubmit = async (e) => {
        e.preventDefault();
        setErr("");
        if (!form.email.trim() || !form.password.trim()) {
            setErr("모든 항목을 입력해주세요.");
            return;
        }
        setBusy(true);
        try {
            await api.auth.signup({
                email: form.email.trim(),
                password: form.password,
            });
            // 회원가입 성공 후 컨텍스트 login으로 자동 로그인 + 사용자 컨텍스트 갱신
            await login({ email: form.email.trim(), password: form.password });
            nav("/app", { state: { welcome: true } });
        } catch (e) {
            const msg = (e?.data?.message || e?.message || "회원가입에 실패했습니다.").toString();
            setErr(Array.isArray(msg) ? msg.join("\n") : msg);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="splash" style={{ justifyContent: "center", alignItems: "center" }}>
            <form className="modal" onSubmit={onSubmit} style={{ width: 420, padding: 16 }}>
                <div className="modal-head"><h4>회원가입</h4></div>
                <div className="modal-body" style={{ display: "grid", gap: 10 }}>
                    <input className="input" type="email" name="email" placeholder="이메일" value={form.email} onChange={onChange} />
                    <input className="input" type="password" name="password" placeholder="비밀번호" value={form.password} onChange={onChange} />
                    {err && <div style={{ color: "var(--danger)", fontSize: 12, whiteSpace: "pre-line" }}>{err}</div>}
                </div>
                <div className="modal-actions" style={{ justifyContent: "flex-end" }}>
                    <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "가입 중…" : "가입하기"}</button>
                </div>
            </form>
        </div>
    );
}
