import { useState } from "react";
import DiffView from "../Diff/DiffView";

interface ProcessToolbarProps {
    showGuide: boolean;
    onToggleGuide: () => void;
}

// 변경 사항 미리보기 / 단계 안내 토글 버튼 줄
export default function ProcessToolbar({ showGuide, onToggleGuide }: ProcessToolbarProps) {
    const [showChangesPanel, setShowChangesPanel] = useState(false);

    return (
        <>
            <div className="process-toolbar">
                <div className="process-toolbar-buttons">
                    <button className="btn btn-ghost" onClick={() => setShowChangesPanel((prev) => !prev)}>
                        {showChangesPanel ? "변경 사항 닫기" : "변경 사항 미리보기"}
                    </button>
                    <button className="btn btn-ghost" onClick={onToggleGuide}>
                        {showGuide ? "단계 안내 숨기기" : "단계 안내 보기"}
                    </button>
                </div>
                <span className="process-toolbar-hint">커밋이나 협업하기 전에 변경 내용을 확인해 보세요.</span>
            </div>

            {showChangesPanel && (
                <div className="changes-preview-panel">
                    <div className="changes-preview-header">
                        <h4>브랜치에 포함될 변경 사항</h4>
                        <button className="btn btn-ghost" onClick={() => setShowChangesPanel(false)}>
                            닫기
                        </button>
                    </div>
                    <DiffView embedded initialTab="changes" />
                </div>
            )}
        </>
    );
}
