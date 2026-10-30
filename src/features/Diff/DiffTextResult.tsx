import DiffContentDisplay from "./DiffContentDisplay";
import type { DiffTextState } from "./useDiffText";

interface DiffTextResultProps extends DiffTextState {
    compact?: boolean;
    collapsible?: boolean;
}

// useDiffText 결과를 로딩/에러/diff 본문으로 표시
export default function DiffTextResult({ diffText, loading, error, compact, collapsible }: DiffTextResultProps) {
    if (loading) {
        return <div>변경사항 로딩 중...</div>;
    }

    if (error) {
        return <div style={{ color: "var(--danger)" }}>{error}</div>;
    }

    return <DiffContentDisplay diffContent={diffText} compact={compact} collapsible={collapsible} />;
}
