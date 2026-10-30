import type { Point } from "./BranchLine";

interface CommitCaptionProps {
    position: Point;
    message: string;
    hashLabel: string;
    isMerge?: boolean;
    isHead?: boolean;
    fastForward?: boolean;
    zIndex?: number;
}

// 커밋 노드 아래에 표시되는 메시지 + 해시/상태 칩
export default function CommitCaption({ position, message, hashLabel, isMerge, isHead, fastForward, zIndex = 0 }: CommitCaptionProps) {
    return (
        <div
            style={{
                position: "absolute",
                left: position.x,
                top: position.y,
                transform: "translateX(-50%)",
                paddingTop: "22px",
                width: 180,
                textAlign: "center",
                pointerEvents: "none",
                zIndex,
            }}
        >
            <div
                style={{
                    fontSize: 12,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    padding: "2px 4px",
                    background: "rgba(255,255,255,0.7)",
                    backdropFilter: "blur(4px)",
                    borderRadius: "4px",
                }}
            >
                {message}
            </div>
            <div style={{ display: "inline-flex", gap: 6, alignItems: "center", marginTop: 4, fontSize: 11, color: "var(--muted)" }}>
                <span>{hashLabel}</span>
                {isMerge && <span className="chip-merge">Merge</span>}
                {isHead && (
                    <span className="chip-head" style={{ background: "#f59e0b", color: "white", padding: "2px 6px", borderRadius: "4px", fontSize: "10px" }}>
                        HEAD
                    </span>
                )}
                {fastForward && <span className="chip-ff">FF</span>}
            </div>
        </div>
    );
}
