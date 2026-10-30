import type { CSSProperties, ReactNode } from "react";

interface ErrorTextProps {
    children: ReactNode;
    /** 목록 자리에 들어가는 빈 상태(.empty) 형태로 보여준다 */
    empty?: boolean;
    style?: CSSProperties;
}

// 폼/모달 하단의 빨간 오류 문구. 내용이 비어 있으면 아무것도 그리지 않는다
export default function ErrorText({ children, empty = false, style }: ErrorTextProps) {
    if (!children) return null;
    if (empty) {
        return <div className="empty" style={{ color: "var(--danger)", ...style }}>{children}</div>;
    }
    return <div style={{ color: "var(--danger)", fontSize: 12, whiteSpace: "pre-line", ...style }}>{children}</div>;
}
