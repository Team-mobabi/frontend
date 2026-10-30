import { Fragment, type MouseEvent, type ReactNode } from "react";
import CommitNode from "./CommitNode";
import BranchLine, { type LineSegment } from "./BranchLine";
import CommitCaption from "./CommitCaption";
import type { BranchLabel, MergeAction, NodeData, Positions } from "./graphLayout";

export type GraphSideName = "local" | "remote";

interface GraphPanelProps {
    side: GraphSideName;
    height: number;
    positions: Positions;
    labels: Record<string, BranchLabel>;
    lineSegments: Record<string, LineSegment>;
    lastAction: MergeAction | null;
    nodeColor: (hash: string, node: NodeData) => string | undefined;
    onShowTip: (evt: MouseEvent, lines: string[]) => void;
    onHideTip: () => void;
    // local 전용: 브랜치 라벨 클릭 → 병합, 커밋 클릭 → 되돌리기
    onLabelClick?: (branch: string) => void;
    onNodeClick?: (hash: string) => void;
    children?: ReactNode;
}

// local/remote 커밋 그래프 패널. local만 클릭(병합/리셋)과 HEAD/FF 칩을 지원한다.
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
    const prefix = isLocal ? "l" : "r";

    return (
        <div className="panel">
            <h3>{isLocal ? "Local" : "Remote"}</h3>
            <div className="commit-graph" style={{ height: `${height}px`, position: "relative" }}>
                {children}

                <BranchLine lineSegments={lineSegments} remote={!isLocal} />
                {Object.entries(labels).map(([name, info]) => (
                    <div
                        key={`label-${prefix}-${name}`}
                        className="branch-label"
                        style={{
                            left: info.point.x,
                            top: info.point.y,
                            borderColor: info.color,
                            color: info.color,
                            cursor: onLabelClick ? undefined : "default",
                        }}
                        onClick={onLabelClick ? () => onLabelClick(name) : undefined}
                    >
                        {name}
                    </div>
                ))}

                {Object.entries(positions).map(([hash, node]) => {
                    const isMergeCommit = (isLocal && node.isMerge) || (node.parents && node.parents.length > 1);
                    const recentNode = lastAction?.type === "merge" && !!lastAction.commitHash && hash === lastAction.commitHash;

                    const tipLines = isLocal
                        ? [
                              "커밋(저장 기록)입니다.",
                              `메시지: ${node.message || "(없음)"}`,
                              `식별자: ${node.shortHash || hash.slice(0, 7)}`,
                              ...(node.author ? [`작성자: ${node.author}`] : []),
                              ...(isMergeCommit ? ["🔀 병합 커밋"] : []),
                              ...(node.isHead ? [`📍 ${node.isHead} 브랜치의 최신 커밋`] : []),
                          ]
                        : [`Commit: ${hash}`, `Message: ${node.message}`, `Branch: ${node.branch}`];

                    return (
                        <Fragment key={`${prefix}-${hash}`}>
                            <CommitNode
                                position={node}
                                isMerge={isMergeCommit}
                                recent={recentNode}
                                color={nodeColor(hash, node)}
                                onClick={onNodeClick ? () => onNodeClick(hash) : undefined}
                                onMouseEnter={(e) => onShowTip(e, tipLines)}
                                onMouseLeave={onHideTip}
                                title={onNodeClick ? "클릭하여 이 커밋으로 되돌리기 (Soft/Hard 선택 가능)" : undefined}
                            />
                            <CommitCaption
                                position={node}
                                message={node.message}
                                hashLabel={isLocal ? node.shortHash || hash.slice(0, 7) : hash.slice(0, 7)}
                                isMerge={isMergeCommit}
                                isHead={isLocal && !!node.isHead}
                                fastForward={
                                    isLocal && lastAction?.type === "merge" && lastAction.fastForward && node.branch === lastAction.target
                                }
                                zIndex={isLocal ? 0 : 1}
                            />
                        </Fragment>
                    );
                })}
            </div>
        </div>
    );
}
