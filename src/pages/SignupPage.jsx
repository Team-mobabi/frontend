import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../features/API";
import { useAuth } from "../features/auth/AuthContext";

export default function SignupPage() {
    const nav = useNavigate();
    const { login } = useAuth();
    const [form, setForm] = useState({ email: "", password: "" });
    const [code, setCode] = useState("");
    const [step, setStep] = useState("credentials");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");

    const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
    const onCodeChange = (e) => setCode(e.target.value);

    const handleResendCode = async () => {
        setErr("");
        if (!form.email) return;
        setBusy(true);
        try {
            await api.email.sendVerification({ email: form.email.trim() });
            setErr("인증 코드를 다시 전송했습니다.");
        } catch (e) {
            const msg = (e?.data?.message || e?.message || "코드 재전송에 실패했습니다.").toString();
            setErr(Array.isArray(msg) ? msg.join("\n") : msg);
        } finally {
            setBusy(false);
        }
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        setErr("");
        setBusy(true);

        if (step === "credentials") {
            if (!form.email.trim() || !form.password.trim()) {
                setErr("모든 항목을 입력해주세요.");
                setBusy(false);
                return;
            }
            try {
                await api.auth.signup({
                    email: form.email.trim(),
                    password: form.password,
                });
            } catch (e) {
                const msg = (e?.data?.message || e?.message || "").toString();
                if (msg.includes("이메일 인증이 필요합니다") || msg.includes("already exists")) {
                    console.warn("User already exists, proceeding to verification.");
                } else {
                    setErr(Array.isArray(msg) ? msg.join("\n") : (msg || "회원가입에 실패했습니다."));
                    setBusy(false);
                    return;
                }
            }

            try {
                await api.email.sendVerification({ email: form.email.trim() });
                setStep("verification");
                setErr("이메일로 전송된 인증 코드를 확인하세요.");
            } catch (e) {
                const msg = (e?.data?.message || e?.message || "인증 메일 발송에 실패했습니다.").toString();
                setErr(Array.isArray(msg) ? msg.join("\n") : msg);
            } finally {
                setBusy(false);
            }
        } else if (step === "verification") {
            if (!code.trim()) {
                setErr("인증 코드를 입력해주세요.");
                setBusy(false);
                return;
            }
            try {
                await api.email.verifyCode({
                    email: form.email.trim(),
                    code: code.trim(),
                });
                await login({ email: form.email.trim(), password: form.password });
                nav("/app", { state: { welcome: true } });
            } catch (e) {
                const msg = (e?.data?.message || e?.message || "인증에 실패했습니다.").toString();
                setErr(Array.isArray(msg) ? msg.join("\n") : msg);
            } finally {
                setBusy(false);
            }
        }
    };

    return (
        <div className="splash" style={{ justifyContent: "center", alignItems: "center" }}>
            <form className="auth-form" onSubmit={onSubmit}>
                <div className="auth-header">
                    <h4>{step === "credentials" ? "회원가입" : "이메일 인증"}</h4>
                </div>
                <div className="auth-body">
                    {step === "credentials" ? (
                        <>
                            <div className="form-group">
                                <label htmlFor="email">이메일</label>
                                <input className="input" id="email" type="email" name="email" placeholder="email@example.com" value={form.email} onChange={onChange} disabled={busy} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="password">비밀번호</label>
                                <input className="input" id="password" type="password" name="password" placeholder="비밀번호" value={form.password} onChange={onChange} disabled={busy} />
                            </div>
                        </>
                    ) : (
                        <div className="form-group">
                            <label htmlFor="email">이메일</label>
                            <input className="input" id="email" type="email" name="email" value={form.email} disabled={true} />

                            <label htmlFor="password" style={{ marginTop: 10 }}>비밀번호</label>
                            <input className="input" id="password" type="password" name="password" value="••••••••" disabled={true} />

                            <label htmlFor="code" style={{ marginTop: 10 }}>인증 코드</label>
                            <input className="input" id="code" type="text" name="code" placeholder="이메일로 전송된 코드" value={code} onChange={onCodeChange} disabled={busy} />
                        </div>
                    )}
                    {err && <div className={step === "verification" && err.includes("전송") ? "auth-success" : "auth-error"}>{err}</div>}
                </div>
                <div className="auth-actions">
                    {step === "credentials" ? (
                        <button className="btn btn-primary" type="submit" disabled={busy}>
                            {busy ? "가입 중…" : "인증 메일 받기"}
                        </button>
                    ) : (
                        <div style={{ display: "flex", gap: 10, width: "100%" }}>
                            <button className="btn" type="button" onClick={handleResendCode} disabled={busy} style={{ flex: 1 }}>
                                코드 재전송
                            </button>
                            <button className="btn btn-primary" type="submit" disabled={busy} style={{ flex: 2 }}>
                                {busy ? "인증 중…" : "인증하고 시작하기"}
                            </button>
                        </div>
                    )}
                </div>
                <div className="auth-footer">
                    이미 계정이 있으신가요? <Link to="/login">로그인</Link>
                </div>
            </form>
        </div>
    );
}