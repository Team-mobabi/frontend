import React, { useEffect, useMemo, useState } from "react";

export default function ConfettiBurst({ count = 40, duration = 1200, onDone }) {
    const [alive, setAlive] = useState(true);
    const pieces = useMemo(() => {
        return new Array(count).fill(0).map((_, i) => ({
            id: i,
            left: Math.random() * 100, // vw
            size: 6 + Math.random() * 8,
            rotate: Math.random() * 360,
            delay: Math.random() * 120,
            time: 800 + Math.random() * 800,
        }));
    }, [count]);

    useEffect(() => {
        const t = setTimeout(() => { setAlive(false); onDone && onDone(); }, duration + 400);
        return () => clearTimeout(t);
    }, [duration, onDone]);

    if (!alive) return null;

    return (
        <div className="confetti-stage" aria-hidden="true">
            {pieces.map(p => (
                <div
                    key={p.id}
                    className="confetti-piece"
                    style={{
                        left: `${p.left}vw`,
                        width: p.size,
                        height: p.size * 0.4,
                        transform: `rotate(${p.rotate}deg)`,
                        animationDuration: `${p.time}ms`,
                        animationDelay: `${p.delay}ms`,
                    }}
                />
            ))}
        </div>
    );
}
