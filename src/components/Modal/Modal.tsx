import { useEffect, type CSSProperties, type ReactNode } from "react";

interface ModalProps {
    open: boolean;
    title: ReactNode;
    onClose: () => void;
    children: ReactNode;
    /** modal-actions 영역에 들어갈 버튼들 */
    footer?: ReactNode;
    width?: CSSProperties["width"];
    /** 처리 중에는 배경 클릭·ESC·닫기 버튼으로 닫히지 않는다 */
    busy?: boolean;
    closeOnBackdrop?: boolean;
    className?: string;
    bodyClassName?: string;
    bodyStyle?: CSSProperties;
    style?: CSSProperties;
}

export default function Modal({
    open,
    title,
    onClose,
    children,
    footer,
    width,
    busy = false,
    closeOnBackdrop = true,
    className,
    bodyClassName,
    bodyStyle,
    style,
}: ModalProps) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !busy) onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, busy, onClose]);

    if (!open) return null;

    const requestClose = () => {
        if (!busy) onClose();
    };

    return (
        <div className="modal-backdrop" onClick={closeOnBackdrop ? requestClose : undefined}>
            <div
                className={className ? `modal ${className}` : "modal"}
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
                style={width !== undefined ? { width, ...style } : style}
            >
                <div className="modal-head">
                    <h4>{title}</h4>
                    <button className="modal-close" onClick={requestClose} disabled={busy} aria-label="닫기">
                        ×
                    </button>
                </div>
                <div className={bodyClassName ? `modal-body ${bodyClassName}` : "modal-body"} style={bodyStyle}>
                    {children}
                </div>
                {footer && <div className="modal-actions">{footer}</div>}
            </div>
        </div>
    );
}
