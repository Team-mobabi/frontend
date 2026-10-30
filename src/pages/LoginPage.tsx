import { useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { errorMessage } from "../lib/api";
import { AuthMessage, CredentialFields } from "../features/auth/AuthFormParts";

export default function LoginPage() {
    const nav = useNavigate();
    const { login } = useAuth();
    const [form, setForm] = useState({ email: "", password: "" });
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");

    const onChange = (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [e.target.name]: e.target.value });

    const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
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
            setErr(errorMessage(e, "로그인에 실패했습니다."));
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
                    <CredentialFields email={form.email} password={form.password} onChange={onChange} />
                    <AuthMessage message={err} />
                </div>
                <div className="auth-actions">
                    <button className="btn btn-primary" type="submit">
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