import type { ChangeEvent, InputHTMLAttributes } from "react";

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & { id: string; label: string };

// 라벨 + 입력창 한 줄 (form-group)
export function AuthField({ id, label, ...inputProps }: AuthFieldProps) {
    return (
        <div className="form-group">
            <label htmlFor={id}>{label}</label>
            <input className="input" id={id} name={id} {...inputProps} />
        </div>
    );
}

interface CredentialFieldsProps {
    email: string;
    password: string;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

// 로그인/회원가입 공통 이메일·비밀번호 입력
export function CredentialFields({ email, password, onChange }: CredentialFieldsProps) {
    return (
        <>
            <AuthField id="email" label="이메일" type="email" placeholder="email@example.com" value={email} onChange={onChange} />
            <AuthField id="password" label="비밀번호" type="password" placeholder="비밀번호" value={password} onChange={onChange} />
        </>
    );
}

// 폼 하단 안내/오류 메시지. 빈 문자열이면 렌더하지 않는다
export function AuthMessage({ message, success = false }: { message: string; success?: boolean }) {
    if (!message) return null;
    return <div className={success ? "auth-success" : "auth-error"}>{message}</div>;
}
