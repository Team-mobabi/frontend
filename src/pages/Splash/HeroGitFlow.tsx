import { useEffect, useRef } from "react";
import { select, type Selection } from "d3-selection";
import "d3-transition";
import { easeCubicInOut, easeBackOut } from "d3-ease";
import { HERO_STEP_COLORS, type HeroStep } from "./heroSteps";


interface HeroGitFlowProps {
    onStep: (step: HeroStep) => void;
}

const W = 420;
const H = 250;
const REMOTE_Y = 62;
const LOCAL_Y = 150;
const XS = [70, 150, 230, 310];
const R = 11;
const ACCENT = "#4B5AE4";

type Svg = Selection<SVGSVGElement, unknown, null, undefined>;
type G = Selection<SVGGElement, unknown, null, undefined>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// x1 커밋 오른쪽 끝에서 시작하는 길이 0의 선 — 호출부에서 x2를 transition으로 늘린다
function edge(layer: G, x1: number, y: number, color: string, dashed = false) {
    return layer
        .append("line")
        .attr("x1", x1 + R)
        .attr("x2", x1 + R)
        .attr("y1", y)
        .attr("y2", y)
        .attr("stroke", color)
        .attr("stroke-width", 2.6)
        .attr("stroke-linecap", "round")
        .attr("stroke-dasharray", dashed ? "4 5" : null)
        .attr("opacity", dashed ? 0.6 : 1);
}

function node(layer: G, x: number, y: number, color: string) {
    return layer
        .append("circle")
        .attr("cx", x)
        .attr("cy", y)
        .attr("r", R)
        .attr("fill", color)
        .attr("stroke", "#fff")
        .attr("stroke-width", 2.5)
        .style("filter", "drop-shadow(0 3px 6px rgba(20,24,60,.2))");
}

// 노드 아래 짧은 설명 (예: 팀원 작업 / 내 작업)
function caption(layer: G, x: number, y: number, text: string, color: string) {
    return layer
        .append("text")
        .attr("x", x)
        .attr("y", y + R + 15)
        .attr("text-anchor", "middle")
        .attr("class", "hero-caption")
        .attr("fill", color)
        .attr("opacity", 0)
        .text(text)
        .call((t) => t.transition().duration(300).attr("opacity", 1));
}

// 정적인 기본 장면: 서버(원격) 3커밋, 내 컴퓨터(로컬) 2커밋
function drawBase(svg: Svg) {
    svg.selectAll("*").remove();
    const bg = svg.append("g");
    [
        { y: REMOTE_Y, label: "서버 · Remote", w: 92 },
        { y: LOCAL_Y, label: "내 컴퓨터 · Local", w: 108 },
    ].forEach(({ y, label, w }) => {
        const pill = bg.append("g").attr("transform", `translate(14,${y - 34})`);
        pill.append("rect").attr("width", w).attr("height", 20).attr("rx", 10).attr("class", "hero-lane-pill");
        pill.append("text").attr("x", w / 2).attr("y", 10).attr("dy", "0.35em").attr("text-anchor", "middle").attr("class", "hero-lane-label").text(label);
        bg.append("line")
            .attr("x1", 14).attr("x2", W - 14).attr("y1", y).attr("y2", y)
            .attr("stroke", "#e5e8f0").attr("stroke-width", 1).attr("stroke-dasharray", "2 6");
    });

    const edges = svg.append("g").attr("class", "hero-edges");
    const nodes = svg.append("g").attr("class", "hero-nodes");
    const fx = svg.append("g").attr("class", "hero-fx");

    for (let i = 0; i < 2; i++) {
        edge(edges, XS[i], REMOTE_Y, ACCENT, true).attr("x2", XS[i + 1] - R);
    }
    edge(edges, XS[0], LOCAL_Y, ACCENT).attr("x2", XS[1] - R);
    XS.slice(0, 3).forEach((x) => node(nodes, x, REMOTE_Y, ACCENT).attr("opacity", 0.75));
    XS.slice(0, 2).forEach((x) => node(nodes, x, LOCAL_Y, ACCENT));

    return { edges, nodes, fx };
}

async function play(svg: Svg, onStep: (s: HeroStep) => void, alive: () => boolean) {
    const { edges, nodes, fx } = drawBase(svg);
    svg.attr("opacity", 0).transition().duration(400).attr("opacity", 1);
    onStep(0);
    await sleep(700);
    if (!alive()) return;

    // 1) Pull: 서버의 최신 커밋이 내 컴퓨터로 내려온다
    onStep(1);
    const pulled = node(fx, XS[2], REMOTE_Y, HERO_STEP_COLORS[1]);
    await pulled.transition().duration(900).ease(easeCubicInOut).attr("cy", LOCAL_Y).end();
    if (!alive()) return;
    await edge(edges, XS[1], LOCAL_Y, ACCENT).transition().duration(400).attr("x2", XS[2] - R).end();
    pulled.transition().duration(400).attr("fill", ACCENT);
    caption(fx, XS[2], LOCAL_Y, "팀원 작업", HERO_STEP_COLORS[1]);
    await sleep(500);
    if (!alive()) return;

    // 2) Add: 수정한 파일이 스테이징 바구니에 담긴다
    onStep(2);
    const box = fx.append("g").attr("transform", `translate(${XS[3] - 50},${LOCAL_Y + 30})`).attr("opacity", 0);
    box.append("rect").attr("width", 116).attr("height", 54).attr("rx", 10)
        .attr("fill", "rgba(59,130,246,.06)").attr("stroke", HERO_STEP_COLORS[2]).attr("stroke-dasharray", "5 4");
    box.append("text").attr("x", 58).attr("y", 14).attr("text-anchor", "middle").attr("class", "hero-box-label").text("담은 파일");
    await box.transition().duration(300).attr("opacity", 1).end();
    const files = ["app.js", "README"].map((name, i) => {
        const chip = fx.append("g").attr("transform", `translate(${W + 20},${H - 10})`).attr("opacity", 0);
        chip.append("rect").attr("x", -26).attr("y", -10).attr("width", 52).attr("height", 20).attr("rx", 10).attr("fill", HERO_STEP_COLORS[2]);
        chip.append("text").attr("text-anchor", "middle").attr("dy", "0.35em").attr("class", "hero-chip-text").text(name);
        chip.transition().delay(i * 220).duration(700).ease(easeBackOut)
            .attr("opacity", 1)
            .attr("transform", `translate(${XS[3] - 22 + i * 56},${LOCAL_Y + 64})`);
        return chip;
    });
    await sleep(1300);
    if (!alive()) return;

    // 3) Commit: 담은 파일이 하나의 저장 기록(커밋)이 된다
    onStep(3);
    await Promise.all(
        files.map((chip) => chip.transition().duration(600).ease(easeCubicInOut)
            .attr("transform", `translate(${XS[3]},${LOCAL_Y})`).attr("opacity", 0).end()),
    );
    box.transition().duration(300).attr("opacity", 0).remove();
    if (!alive()) return;
    await edge(edges, XS[2], LOCAL_Y, HERO_STEP_COLORS[3]).transition().duration(350).attr("x2", XS[3] - R).end();
    const committed = node(nodes, XS[3], LOCAL_Y, HERO_STEP_COLORS[3]).attr("r", 0);
    await committed.transition().duration(500).ease(easeBackOut).attr("r", R).end();
    caption(fx, XS[3], LOCAL_Y, "내 작업", HERO_STEP_COLORS[3]);
    await sleep(500);
    if (!alive()) return;

    // 4) Push: 새 커밋이 서버로 올라간다
    onStep(4);
    const pushed = node(fx, XS[3], LOCAL_Y, HERO_STEP_COLORS[4]);
    await pushed.transition().duration(900).ease(easeCubicInOut).attr("cy", REMOTE_Y).end();
    if (!alive()) return;
    await edge(edges, XS[2], REMOTE_Y, HERO_STEP_COLORS[3], true).transition().duration(350).attr("x2", XS[3] - R).end();
    pushed.transition().duration(400).attr("fill", HERO_STEP_COLORS[3]);
    await sleep(1600);
    if (!alive()) return;

    await svg.transition().duration(400).attr("opacity", 0).end();
}

// 정적 최종 장면 (모션 줄이기 설정 사용자용)
function drawStatic(svg: Svg) {
    const { edges, nodes, fx } = drawBase(svg);
    caption(fx, XS[2], LOCAL_Y, "팀원 작업", HERO_STEP_COLORS[1]);
    caption(fx, XS[3], LOCAL_Y, "내 작업", HERO_STEP_COLORS[3]);
    edge(edges, XS[1], LOCAL_Y, ACCENT).attr("x2", XS[2] - R);
    node(nodes, XS[2], LOCAL_Y, ACCENT);
    edge(edges, XS[2], LOCAL_Y, HERO_STEP_COLORS[3]).attr("x2", XS[3] - R);
    node(nodes, XS[3], LOCAL_Y, HERO_STEP_COLORS[3]);
    edge(edges, XS[2], REMOTE_Y, HERO_STEP_COLORS[3], true).attr("x2", XS[3] - R);
    node(nodes, XS[3], REMOTE_Y, HERO_STEP_COLORS[3]);
}

// 랜딩 히어로: Pull → Add → Commit → Push 흐름을 D3로 반복 재생한다
export default function HeroGitFlow({ onStep }: HeroGitFlowProps) {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const onStepRef = useRef(onStep);
    onStepRef.current = onStep;

    useEffect(() => {
        const el = svgRef.current;
        if (!el) return;
        const svg = select(el);
        const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        if (reduced) {
            drawStatic(svg);
            return;
        }

        let alive = true;
        const isAlive = () => alive;
        (async () => {
            while (alive) {
                try {
                    await play(svg, (s) => onStepRef.current(s), isAlive);
                } catch {
                    // 언마운트 등으로 transition이 interrupt되면 end()가 reject된다
                    return;
                }
            }
        })();

        return () => {
            alive = false;
            svg.interrupt();
            svg.selectAll("*").interrupt();
        };
    }, []);

    return (
        <svg
            ref={svgRef}
            className="hero-gitflow"
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="서버에서 가져오기, 파일 담기, 저장, 올리기 순서로 진행되는 Git 흐름 애니메이션"
        />
    );
}
