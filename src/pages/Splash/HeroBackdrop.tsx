import { useEffect, useRef } from "react";
import { select } from "d3-selection";
import "d3-transition";
import { easeLinear } from "d3-ease";

const W = 1440;
const H = 720;
const COLORS = ["#4B5AE4", "#22c55e", "#f59e0b", "#8b5cf6"];

// 화면을 가로지르는 브랜치 곡선 — main에서 갈라졌다 다시 합쳐지는 모양
const BRANCHES = [
    `M -40 ${H * 0.62} C ${W * 0.25} ${H * 0.62}, ${W * 0.35} ${H * 0.62}, ${W * 1.05} ${H * 0.62}`,
    `M ${W * 0.12} ${H * 0.62} C ${W * 0.22} ${H * 0.62}, ${W * 0.24} ${H * 0.42}, ${W * 0.36} ${H * 0.42} S ${W * 0.56} ${H * 0.42}, ${W * 0.66} ${H * 0.62}`,
    `M ${W * 0.48} ${H * 0.62} C ${W * 0.56} ${H * 0.62}, ${W * 0.58} ${H * 0.8}, ${W * 0.7} ${H * 0.8} S ${W * 0.9} ${H * 0.8}, ${W * 1.05} ${H * 0.8}`,
    `M -40 ${H * 0.24} C ${W * 0.3} ${H * 0.24}, ${W * 0.6} ${H * 0.24}, ${W * 1.05} ${H * 0.24}`,
];

// 랜딩 히어로 뒤에 깔리는 은은한 커밋 흐름 배경 (장식용)
export default function HeroBackdrop() {
    const ref = useRef<SVGSVGElement | null>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const svg = select(el);
        svg.selectAll("*").remove();
        const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

        BRANCHES.forEach((d, i) => {
            const color = COLORS[i % COLORS.length];
            const path = svg.append("path").attr("d", d).attr("fill", "none")
                .attr("stroke", color).attr("stroke-width", 2).attr("stroke-linecap", "round").attr("opacity", 0.16);
            const node = path.node();
            if (!node) return;
            const len = node.getTotalLength();

            // 경로 위에 고정된 커밋 점
            const count = Math.max(3, Math.round(len / 180));
            for (let k = 1; k < count; k++) {
                const p = node.getPointAtLength((len * k) / count);
                svg.append("circle").attr("cx", p.x).attr("cy", p.y).attr("r", 5)
                    .attr("fill", color).attr("opacity", 0.18);
            }

            if (reduced) return;

            // 경로를 따라 천천히 흐르는 빛 점
            const runner = svg.append("circle").attr("r", 4).attr("fill", color).attr("opacity", 0.45);
            const loop = () => {
                runner
                    .transition()
                    .delay(i * 900)
                    .duration(9000 + i * 1500)
                    .ease(easeLinear)
                    .attrTween("transform", () => (t: number) => {
                        const p = node.getPointAtLength(t * len);
                        return `translate(${p.x},${p.y})`;
                    })
                    .on("end", loop);
            };
            loop();
        });

        return () => {
            svg.selectAll("*").interrupt();
        };
    }, []);

    return <svg ref={ref} className="hero-backdrop" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" />;
}
