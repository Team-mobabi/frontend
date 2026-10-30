import { useEffect, useMemo, useRef, useState } from "react";

interface ConfettiBurstProps {
    count?: number;
    duration?: number;
    onDone?: () => void;
}

export default function ConfettiBurst({ count = 40, duration = 1200, onDone }: ConfettiBurstProps) {
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

    // onDone 의 참조가 매 렌더 바뀌어도 타이머가 다시 시작되지 않도록 최신 값만 ref 에 보관한다
    const onDoneRef = useRef(onDone);
    useEffect(() => {
        onDoneRef.current = onDone;
    }, [onDone]);

    useEffect(() => {
        const t = setTimeout(() => { setAlive(false); onDoneRef.current?.(); }, duration + 400);
        return () => clearTimeout(t);
    }, [duration]);

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
