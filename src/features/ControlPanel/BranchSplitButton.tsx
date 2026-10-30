import type { ReactNode } from "react";

interface BranchSplitButtonProps {
    /** 주 버튼 DOM id (튜토리얼 툴팁 대상) */
    id?: string;
    /** "primary"면 파란 버튼 스타일 */
    variant?: "default" | "primary";
    label: ReactNode;
    title: string;
    triggerTitle: string;
    /** AI 추천 단계로 강조할지 */
    suggested?: boolean;
    disabled?: boolean;
    onAction: () => void;

    open: boolean;
    onToggle: () => void;
    branches: string[];
    selected: string;
    onSelect: (branch: string) => void;
    itemTitle: (branch: string) => string;
    /** 주어지면 'main' 외 가지 옆에 삭제 버튼 표시 */
    onDelete?: (branch: string) => void;
    /** 주어지면 메뉴 하단에 '새 작업 버전 만들기' 표시 */
    onCreate?: () => void;
}

// 가져오기/올리기용 분할 버튼: 왼쪽은 실행, 오른쪽 ▼은 작업 버전(가지) 선택 메뉴
export default function BranchSplitButton({
    id,
    variant = "default",
    label,
    title,
    triggerTitle,
    suggested = false,
    disabled = false,
    onAction,
    open,
    onToggle,
    branches,
    selected,
    onSelect,
    itemTitle,
    onDelete,
    onCreate,
}: BranchSplitButtonProps) {
    const primary = variant === "primary";
    const ai = suggested ? " ai-suggested" : "";

    const item = (b: string) => (
        <button
            key={onDelete ? undefined : b}
            className={`combo-item ${b === selected ? "active" : ""}`}
            onClick={() => onSelect(b)}
            title={itemTitle(b)}
        >
            {b}
        </button>
    );

    return (
        <div className={`btn-split-wrap${primary ? " primary" : ""}${ai}`} data-ai-suggested={suggested}>
            <button
                id={id}
                className={`btn${primary ? " btn-primary" : ""} btn-split-action${ai}`}
                data-ai-suggested={suggested}
                onClick={onAction}
                disabled={disabled}
                title={suggested ? `🤖 AI 추천: ${title}` : title}
            >
                {suggested && "🤖 "}
                {label}
            </button>
            <button className={`btn${primary ? " btn-primary" : ""} btn-split-trigger`} onClick={onToggle} disabled={disabled} title={triggerTitle}>
                ▼
            </button>
            {open && (
                <div className="combo-menu">
                    {branches.map((b) =>
                        onDelete ? (
                            <div key={b} className="combo-item-wrap">
                                {item(b)}
                                {b !== "main" && (
                                    <button className="combo-item-delete" title={`'${b}' 작업 버전 삭제`} onClick={() => onDelete(b)}>
                                        🗑️
                                    </button>
                                )}
                            </div>
                        ) : (
                            item(b)
                        ),
                    )}
                    {onCreate && (
                        <>
                            <div style={{ borderTop: "1px solid var(--line)", margin: "4px 0" }} />
                            <button className="combo-item" onClick={onCreate} title="현재 버전에서 새 작업 버전 만들기">
                                + 새 작업 버전 만들기...
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
