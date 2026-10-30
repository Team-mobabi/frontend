export interface Point {
    x: number;
    y: number;
}

export interface LineSegment {
    points: Point[];
    color?: string;
    type?: "merge" | "normal";
    recent?: boolean;
}

export const NODE_R = 12;
const EDGE_GAP = NODE_R + 2; // 노드 테두리 바깥에서 선이 시작되도록

function offsetPoint(p0: Point, p1: Point, delta: number): Point {
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p0.x + (dx / len) * delta, y: p0.y + (dy / len) * delta };
}

// 두 커밋 사이를 원 가장자리부터 가장자리까지 부드러운 곡선으로 잇는다
export function smoothEdgePath(p0: Point | undefined, p1: Point | undefined): string {
    if (!p0 || !p1) return "";
    const s = offsetPoint(p0, p1, EDGE_GAP);
    const e = offsetPoint(p1, p0, EDGE_GAP);
    const midX = (s.x + e.x) / 2;
    return `M ${s.x} ${s.y} C ${midX} ${s.y}, ${midX} ${e.y}, ${e.x} ${e.y}`;
}
