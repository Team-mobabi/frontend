import React from 'react';

function toSmoothPath(points) {
    if (!points || points.length < 2) return '';
    const [p0, p1] = points; // 이제 항상 2개의 점만 처리합니다.
    const midX = (p0.x + p1.x) / 2;
    const c1 = { x: midX, y: p0.y };
    const c2 = { x: midX, y: p1.y };
    return `M ${p0.x} ${p0.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p1.x} ${p1.y}`;
}

export default function BranchLine({ lineSegments, remote }) {
    if (!lineSegments || typeof lineSegments !== 'object') return null;

    return (
        <svg className="branch-svg">
            {Object.entries(lineSegments).map(([key, info]) => {
                if (!info?.points || info.points.length < 2) return null;
                const d = toSmoothPath(info.points);
                return (
                    <path
                        key={key}
                        className={`branch-path ${remote ? 'remote' : ''}`}
                        d={d}
                        style={{ stroke: info.color }}
                    />
                );
            })}
        </svg>
    );
}