import DiffLines from "../Diff/DiffLines";
import { PR_DIFF_THEME } from "../Diff/diffLineStyle";

interface CollapsibleDiffFileProps {
    path: string;
    status?: string;
    additions?: number;
    deletions?: number;
    patch?: string;
    expanded: boolean;
    onToggle: () => void;
}

// 변경 요청 상세의 파일별 diff (헤더 클릭으로 접기/펼치기)
export default function CollapsibleDiffFile({ path, status, additions, deletions, patch, expanded, onToggle }: CollapsibleDiffFileProps) {
    return (
        <div className="pr-diff-file">
            <div
                className="pr-diff-file-header"
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "var(--panel-2)",
                    border: "1px solid var(--line)",
                    borderBottom: expanded ? "none" : "1px solid var(--line)",
                    padding: "8px 12px",
                    borderTopLeftRadius: 8,
                    borderTopRightRadius: 8,
                    borderBottomLeftRadius: expanded ? 0 : 8,
                    borderBottomRightRadius: expanded ? 0 : 8,
                    cursor: "pointer",
                    userSelect: "none",
                }}
                onClick={onToggle}
            >
                <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1 }}>
                    <span style={{ fontSize: "14px", color: "var(--sub)" }}>{expanded ? "▼" : "▶"}</span>
                    <span className="file-path" style={{ fontFamily: "var(--font-mono)" }}>{path}</span>
                    {status && (
                        <span className="file-status" style={{ textTransform: "uppercase", fontSize: 12, color: "var(--sub)" }}>
                            {status}
                        </span>
                    )}
                </div>
                {additions || deletions ? (
                    <div className="file-stats" style={{ fontSize: 12, color: "var(--sub)" }}>
                        +{additions || 0} −{deletions || 0}
                    </div>
                ) : null}
            </div>
            {expanded && (
                <pre
                    className="pr-diff"
                    style={{
                        margin: 0,
                        border: "1px solid var(--line)",
                        borderTop: "none",
                        borderBottomLeftRadius: 8,
                        borderBottomRightRadius: 8,
                        overflowX: "auto",
                        padding: "8px 12px",
                        background: "var(--panel-bg)",
                    }}
                >
                    <PrPatch patch={patch} />
                </pre>
            )}
        </div>
    );
}

// patch가 비어 있으면 안내 문구, 아니면 줄 단위 색칠
export function PrPatch({ patch }: { patch?: string }) {
    if (!patch) {
        return <code style={{ color: "var(--sub)" }}>이 파일에 대한 차이가 없습니다.</code>;
    }
    return (
        <code>
            <DiffLines text={patch} theme={PR_DIFF_THEME} />
        </code>
    );
}
