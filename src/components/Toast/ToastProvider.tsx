import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type ToastKind = "info" | "success" | "error";

interface ToastItem {
    id: number;
    message: ReactNode;
    kind: ToastKind;
}

interface ToastContextValue {
    show: (message: ReactNode, kind?: ToastKind, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const KIND_STYLE: Record<ToastKind, string | undefined> = {
    info: undefined,
    success: "var(--success, #16a34a)",
    error: "var(--danger, #dc2626)",
};

// alert() 대신 화면 하단에 잠깐 떠 있는 알림
export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const nextId = useRef(0);
    const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

    useEffect(() => {
        const pending = timers.current;
        return () => pending.forEach(clearTimeout);
    }, []);

    const show = useCallback((message: ReactNode, kind: ToastKind = "info", duration = 2600) => {
        const id = nextId.current++;
        setToasts((prev) => [...prev, { id, message, kind }]);
        timers.current.set(
            id,
            setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
                timers.current.delete(id);
            }, duration),
        );
    }, []);

    return (
        <ToastContext.Provider value={{ show }}>
            {children}
            {toasts.length > 0 && (
                <div className="toast-root" role="status" aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {toasts.map((t) => (
                        <div
                            key={t.id}
                            className="toast-card"
                            style={KIND_STYLE[t.kind] ? { borderColor: KIND_STYLE[t.kind], color: KIND_STYLE[t.kind] } : undefined}
                        >
                            {t.message}
                        </div>
                    ))}
                </div>
            )}
        </ToastContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast must be used within ToastProvider");
    return ctx;
}
