import React from 'react';

function toSmoothPath(points) {
    if (!points || points.length < 2) return '';
    const [p0, ...rest] = points;
    let d = `M ${p0.x} ${p0.y}`;
    let prev = p0;
    for (const p1 of rest) {
        const midX = (prev.x + p1.x) / 2;
        const c1 = { x: midX, y: prev.y };
        const c2 = { x: midX, y: p1.y };
        d += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p1.x} ${p1.y}`;
        prev = p1;
    }
    return d;
}

export default function BranchLine({ branches, remote }) {
    if (!branches || typeof branches !== 'object') return null;

    return (
        <svg className="branch-svg">
            {Object.entries(branches).map(([name, info]) => {
                if (!info?.points || info.points.length < 2) return null;
                const d = toSmoothPath(info.points);
                return (
                    <path
                        key={name}
                        className={`branch-path ${remote ? 'remote' : ''}`}
                        d={d}
                        style={{ stroke: info.color }}
                    />
                );
            })}
        </svg>
    );
}
