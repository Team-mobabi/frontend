import React, { useEffect, useState } from "react";

export default function Toast({ message, duration = 2200, onClose }) {
    const [open, setOpen] = useState(true);

    useEffect(() => {
        const t = setTimeout(() => {
            setOpen(false);
            onClose && onClose();
        }, duration);
        return () => clearTimeout(t);
    }, [duration, onClose]);

    if (!open) return null;

    return (
        <div className="toast-root">
            <div className="toast-card">{message}</div>
        </div>
    );
}
