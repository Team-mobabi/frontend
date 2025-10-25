import React from "react";

const NODE_R = 12;          // .commit-node width/height = 24px
const NODE_BORDER = 2;      // border: 2px solid white;
const OFFSET = NODE_R + NODE_BORDER;

/**
 * 두 점 사이를 원의 가장자리부터 가장자리까지 자연스럽게 연결하는 곡선
 */
function offsetPoint(p0, p1, delta) {
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p0.x + (dx / len) * delta, y: p0.y + (dy / len) * delta };
}

function makeSmoothPath(p0, p1) {
    if (!p0 || !p1) return "";
    // 노드 반지름만큼 안쪽으로 오프셋
    const s = offsetPoint(p0, p1, OFFSET);
    const e = offsetPoint(p1, p0, OFFSET);

    // 약간의 곡률을 줘서 선이 부드럽게 이어지도록
    const midX = (s.x + e.x) / 2;
    const c1 = { x: midX, y: s.y };
    const c2 = { x: midX, y: e.y };

    return `M ${s.x} ${s.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${e.x} ${e.y}`;
}

export default function BranchLine({ lineSegments, remote }) {
    if (!lineSegments || typeof lineSegments !== "object") return null;

    return (
        <svg className="branch-svg">
            {Object.entries(lineSegments).map(([key, seg]) => {
                const pts = seg?.points;
                if (!pts || pts.length < 2) return null;

                const d = makeSmoothPath(pts[0], pts[1]);
                const cls = [
                    "branch-path",
                    remote ? "remote" : "",
                    seg.type === "merge" ? "is-merge" : "",
                    seg.recent ? "is-recent" : "",
                ]
                    .filter(Boolean)
                    .join(" ");

                return (
                    <path
                        key={key}
                        className={cls}
                        d={d}
                        stroke={seg.color || "var(--accent)"}
                        fill="none"
                        strokeLinecap="round"
                        strokeWidth="2.4"
                    />
                );
            })}
        </svg>
    );
}
