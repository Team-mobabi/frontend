import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import "d3-transition";
import { easeCubicOut } from "d3-ease";
import { NODE_R, smoothEdgePath, type LineSegment, type Point } from "./graphPath";
import type { BranchLabel, MergeAction, NodeData, Positions } from "./graphLayout";

export type GraphSideName = "local" | "remote";

export interface TipAnchor {
    clientX: number;
    clientY: number;
}

interface GraphPanelProps {
    side: GraphSideName;
    height: number;
    positions: Positions;
    labels: Record<string, BranchLabel>;
    lineSegments: Record<string, LineSegment>;
    lastAction: MergeAction | null;
    nodeColor: (hash: string, node: NodeData) => string | undefined;
    onShowTip: (at: TipAnchor, lines: string[]) => void;
    onHideTip: () => void;
    // local 전용: 브랜치 라벨 클릭 → 병합, 커밋 클릭 → 되돌리기
    onLabelClick?: (branch: string) => void;
    onNodeClick?: (hash: string) => void;
    children?: ReactNode;
}

interface NodeDatum {
    hash: string;
    node: NodeData;
    color: string;
    isMerge: boolean;
    recent: boolean;
    head: boolean;
    fastForward: boolean;
    hashLabel: string;
    tip: string[];
}

interface EdgeDatum {
    key: string;
    seg: LineSegment;
}

interface LabelDatum {
    name: string;
    point: Point;
    color: string;
}

const DURATION = 550;
const DEFAULT_COLOR = "#4B5AE4";
const CAPTION_MAX = 16;
const CAPTION_X = NODE_R + 10;

// 브랜치 라벨은 head 커밋의 왼쪽에 붙인다 (캡션은 오른쪽)
const labelTransform = (d: { point: Point }) => `translate(${d.point.x - NODE_R - 8},${d.point.y})`;

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

// 이전 렌더에서의 노드 좌표 — 새 노드는 첫 부모 자리에서 자라나듯 등장시킨다
type PositionMemo = Map<string, Point>;

// local/remote 커밋 그래프. D3로 SVG를 그리고 줌·패닝과 위치 전환 애니메이션을 지원한다.
export default function GraphPanel({
    side,
    height,
    positions,
    labels,
    lineSegments,
    lastAction,
    nodeColor,
    onShowTip,
    onHideTip,
    onLabelClick,
    onNodeClick,
    children,
}: GraphPanelProps) {
    const isLocal = side === "local";
    const svgRef = useRef<SVGSVGElement | null>(null);
    const viewportRef = useRef<SVGGElement | null>(null);
    const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
    const prevPos = useRef<PositionMemo>(new Map());
    const fittedHashes = useRef<Set<string>>(new Set());

    // 콜백은 최신 값을 ref로 들고 있어 D3 이벤트 핸들러를 매 렌더 다시 붙이지 않아도 된다
    const handlers = useRef({ onShowTip, onHideTip, onLabelClick, onNodeClick });
    handlers.current = { onShowTip, onHideTip, onLabelClick, onNodeClick };

    // positions에는 전체/짧은 해시가 같은 노드를 가리키므로 객체 기준으로 중복 제거
    const nodes = useMemo<NodeDatum[]>(() => {
        const seen = new Set<NodeData>();
        const out: NodeDatum[] = [];
        for (const [hash, node] of Object.entries(positions)) {
            if (seen.has(node)) continue;
            seen.add(node);
            const isMerge = (isLocal && node.isMerge) || node.parents.length > 1;
            const shortHash = node.shortHash || hash.slice(0, 7);
            out.push({
                hash,
                node,
                color: nodeColor(hash, node) || DEFAULT_COLOR,
                isMerge,
                recent: lastAction?.type === "merge" && !!lastAction.commitHash && hash === lastAction.commitHash,
                head: isLocal && !!node.isHead,
                fastForward: isLocal && lastAction?.type === "merge" && lastAction.fastForward && node.branch === lastAction.target,
                hashLabel: shortHash,
                tip: isLocal
                    ? [
                          "커밋(저장 기록)입니다.",
                          `메시지: ${node.message || "(없음)"}`,
                          `식별자: ${shortHash}`,
                          ...(node.author ? [`작성자: ${node.author}`] : []),
                          ...(isMerge ? ["🔀 병합 커밋"] : []),
                          ...(node.isHead ? [`📍 ${node.isHead} 브랜치의 최신 커밋`] : []),
                      ]
                    : [`Commit: ${hash}`, `Message: ${node.message}`, `Branch: ${node.branch}`],
            });
        }
        return out;
        // nodeColor는 부모에서 매 렌더 새로 만들어지므로 의존성에서 제외 (색은 positions/labels 변화에 따라 바뀜)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [positions, labels, lastAction, isLocal]);

    const edges = useMemo<EdgeDatum[]>(
        () => Object.entries(lineSegments).filter(([, seg]) => seg?.points?.length >= 2).map(([key, seg]) => ({ key, seg })),
        [lineSegments],
    );

    const labelData = useMemo<LabelDatum[]>(
        () => Object.entries(labels).map(([name, info]) => ({ name, point: info.point, color: info.color })),
        [labels],
    );

    // 그래프 전체가 보이도록 가운데 정렬 (확대는 하지 않음)
    const fit = useCallback((animate: boolean) => {
        const svg = svgRef.current;
        const vp = viewportRef.current;
        const zb = zoomRef.current;
        if (!svg || !vp || !zb) return;
        const box = vp.getBBox();
        const width = svg.clientWidth;
        if (!box.width || !width) return;
        const scale = Math.min(1, (width - 32) / box.width, (height - 24) / (box.height + 24));
        const tx = (width - box.width * scale) / 2 - box.x * scale;
        const ty = 12 - Math.min(0, box.y) * scale;
        const t = zoomIdentity.translate(tx, ty).scale(scale);
        const sel = select(svg);
        if (animate) sel.transition().duration(400).call(zb.transform, t);
        else sel.call(zb.transform, t);
    }, [height]);

    // 줌 동작 1회 설정
    useEffect(() => {
        const svg = svgRef.current;
        const vp = viewportRef.current;
        if (!svg || !vp) return;
        const zb = zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.4, 2.5])
            // 휠 스크롤은 페이지 스크롤에 양보하고, ctrl/⌘ + 휠일 때만 확대
            .filter((event: Event) => {
                if (event.type === "wheel") return (event as WheelEvent).ctrlKey || (event as WheelEvent).metaKey;
                return !(event as globalThis.MouseEvent).button;
            })
            .on("zoom", (event) => {
                select(vp).attr("transform", event.transform.toString());
            });
        zoomRef.current = zb;
        select(svg).call(zb).on("dblclick.zoom", null);
        return () => {
            select(svg).on(".zoom", null);
        };
    }, []);

    // 데이터 변경 시 D3 join으로 그리기
    useEffect(() => {
        const vp = viewportRef.current;
        if (!vp) return;
        const root = select(vp);
        const prev = prevPos.current;

        // 새 노드의 시작점: 이전에 있던 부모 위치 → 없으면 제자리
        const startOf = (d: NodeDatum): Point => {
            const before = prev.get(d.hash);
            if (before) return before;
            for (const p of d.node.parents) {
                const parentPrev = prev.get(p) ?? [...prev.entries()].find(([h]) => h.startsWith(p) || p.startsWith(h))?.[1];
                if (parentPrev) return parentPrev;
            }
            return { x: d.node.x, y: d.node.y };
        };

        // --- edges ---
        root.select<SVGGElement>("g.edges")
            .selectAll<SVGPathElement, EdgeDatum>("path")
            .data(edges, (d) => d.key)
            .join(
                (enter) =>
                    enter
                        .append("path")
                        .attr("fill", "none")
                        .attr("stroke-linecap", "round")
                        .attr("d", (d) => smoothEdgePath(d.seg.points[0], d.seg.points[1]))
                        .attr("opacity", 0)
                        .call((e) => e.transition().delay(DURATION * 0.4).duration(DURATION).attr("opacity", 1)),
                (update) =>
                    update.call((u) =>
                        u.transition().duration(DURATION).ease(easeCubicOut)
                            .attr("d", (d) => smoothEdgePath(d.seg.points[0], d.seg.points[1]))
                            .attr("opacity", 1),
                    ),
                (exit) => exit.call((x) => x.transition().duration(250).attr("opacity", 0).remove()),
            )
            .attr("class", (d) =>
                ["branch-path", isLocal ? "" : "remote", d.seg.type === "merge" ? "is-merge" : "", d.seg.recent ? "is-recent" : ""]
                    .filter(Boolean)
                    .join(" "),
            )
            .attr("stroke", (d) => d.seg.color || "var(--accent)");

        // --- nodes (원 + 캡션) ---
        const nodeSel = root.select<SVGGElement>("g.nodes")
            .selectAll<SVGGElement, NodeDatum>("g.gnode")
            .data(nodes, (d) => d.hash)
            .join(
                (enter) => {
                    const g = enter.append("g").attr("class", "gnode");
                    g.attr("transform", (d) => {
                        const s = startOf(d);
                        return `translate(${s.x},${s.y})`;
                    });
                    g.append("circle").attr("class", "gnode-halo").attr("r", NODE_R + 5);
                    g.append("circle").attr("class", "gnode-dot").attr("r", 0)
                        .transition().duration(DURATION).ease(easeCubicOut).attr("r", NODE_R);
                    const cap = g.append("g").attr("class", "gnode-caption").attr("opacity", 0);
                    cap.append("rect").attr("class", "gnode-msg-bg").attr("rx", 5);
                    // 캡션은 노드 오른쪽에 두어 세로 연결선과 겹치지 않게 한다
                    cap.append("text").attr("class", "gnode-msg").attr("x", CAPTION_X).attr("y", -3);
                    cap.append("text").attr("class", "gnode-hash").attr("x", CAPTION_X).attr("y", 12);
                    cap.transition().delay(DURATION * 0.5).duration(DURATION).attr("opacity", 1);
                    return g;
                },
                (update) => update,
                (exit) => exit.call((x) => x.transition().duration(250).attr("opacity", 0).remove()),
            );

        nodeSel
            .classed("is-merge", (d) => d.isMerge)
            .classed("is-head", (d) => d.head)
            .classed("is-recent", (d) => d.recent)
            .classed("clickable", () => !!handlers.current.onNodeClick)
            .transition().duration(DURATION).ease(easeCubicOut)
            .attr("transform", (d) => `translate(${d.node.x},${d.node.y})`);

        nodeSel.select<SVGCircleElement>("circle.gnode-dot").attr("fill", (d) => (d.isMerge ? "#7c3aed" : d.color));
        nodeSel.select<SVGCircleElement>("circle.gnode-halo").attr("stroke", (d) => d.color);
        nodeSel.select<SVGTextElement>("text.gnode-msg").text((d) => truncate(d.node.message || "", CAPTION_MAX));
        nodeSel.select<SVGTextElement>("text.gnode-hash").each(function (d) {
            // 해시 + 상태 칩(Merge/HEAD/FF)을 tspan으로 이어 붙인다
            const t = select(this);
            t.selectAll("tspan").remove();
            t.append("tspan").attr("class", "gnode-hash-text").text(d.hashLabel);
            if (d.isMerge) t.append("tspan").attr("class", "gnode-chip chip-merge-t").attr("dx", 6).text("Merge");
            if (d.head) t.append("tspan").attr("class", "gnode-chip chip-head-t").attr("dx", 6).text("HEAD");
            if (d.fastForward) t.append("tspan").attr("class", "gnode-chip chip-ff-t").attr("dx", 6).text("FF");
        });
        // 메시지 배경 박스 크기를 텍스트에 맞춘다
        nodeSel.each(function () {
            const g = select(this);
            const text = g.select<SVGTextElement>("text.gnode-msg").node();
            if (!text) return;
            const b = text.getBBox();
            g.select("rect.gnode-msg-bg")
                .attr("x", b.x - 5)
                .attr("y", b.y - 2)
                .attr("width", b.width ? b.width + 10 : 0)
                .attr("height", b.height ? b.height + 4 : 0);
        });

        nodeSel
            .on("click", (_e, d) => handlers.current.onNodeClick?.(d.hash))
            .on("mouseenter", (e: globalThis.MouseEvent, d) => handlers.current.onShowTip(e, d.tip))
            .on("mousemove", (e: globalThis.MouseEvent, d) => handlers.current.onShowTip(e, d.tip))
            .on("mouseleave", () => handlers.current.onHideTip());

        // --- branch labels ---
        const labelSel = root.select<SVGGElement>("g.labels")
            .selectAll<SVGGElement, LabelDatum>("g.glabel")
            .data(labelData, (d) => d.name)
            .join(
                (enter) => {
                    const g = enter.append("g").attr("class", "glabel").attr("opacity", 0)
                        .attr("transform", labelTransform);
                    g.append("rect").attr("rx", 11).attr("height", 22).attr("y", -11);
                    g.append("text").attr("text-anchor", "end").attr("x", -10).attr("dy", "0.35em");
                    g.transition().delay(DURATION * 0.6).duration(DURATION).attr("opacity", 1);
                    return g;
                },
                (update) => update,
                (exit) => exit.call((x) => x.transition().duration(250).attr("opacity", 0).remove()),
            );
        labelSel.classed("clickable", () => !!handlers.current.onLabelClick)
            .transition().duration(DURATION).ease(easeCubicOut)
            .attr("transform", labelTransform);
        labelSel.select("text").text((d) => d.name).attr("fill", (d) => d.color);
        labelSel.select<SVGRectElement>("rect").attr("stroke", (d) => d.color).each(function (d) {
            const w = Math.max(44, d.name.length * 7.2 + 20);
            select(this).attr("x", -w).attr("width", w);
        });
        labelSel.on("click", (_e, d) => handlers.current.onLabelClick?.(d.name));

        // 다음 렌더를 위해 현재 좌표 기억
        prevPos.current = new Map(nodes.map((d) => [d.hash, { x: d.node.x, y: d.node.y }]));

        // 처음 그리거나 저장소가 바뀌었을 때(이전 노드와 겹치는 게 없을 때)만 화면 맞춤 — 사용자가 옮겨 둔 시점은 유지
        const known = fittedHashes.current;
        const isNewGraph = nodes.length > 0 && !nodes.some((d) => known.has(d.hash));
        fittedHashes.current = new Set(nodes.map((d) => d.hash));
        if (isNewGraph) requestAnimationFrame(() => fit(false));
    }, [nodes, edges, labelData, isLocal, fit]);

    return (
        <div className="panel">
            <div className="d3-graph-head">
                <h3>{isLocal ? "Local" : "Remote"}</h3>
                <button type="button" className="d3-graph-fit" onClick={() => fit(true)} title="그래프 전체 보기">
                    ⤢ 맞춤
                </button>
            </div>
            <div className="commit-graph d3-graph" style={{ height: `${height}px` }}>
                {children}
                <svg ref={svgRef} className="d3-graph-svg" width="100%" height={height} role="img" aria-label={`${isLocal ? "로컬" : "원격"} 커밋 그래프`}>
                    <g ref={viewportRef}>
                        <g className="edges" />
                        <g className="nodes" />
                        <g className="labels" />
                    </g>
                </svg>
                {nodes.length === 0 && <div className="d3-graph-empty">아직 저장된 기록이 없어요</div>}
            </div>
        </div>
    );
}
