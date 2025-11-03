import React, { useEffect, useState } from "react";
import { useGit } from "../GitCore/GitContext";
import WorkingDiffView from "./WorkingDiffView";
import StagedDiffView from "./StagedDiffView";
import CompareDiffView from "./CompareDiffView";

export default function DiffView({ initialTab = "changes", embedded = false }) {
    const { state } = useGit();
    const [activeDiff, setActiveDiff] = useState(initialTab);

    useEffect(() => {
        setActiveDiff(initialTab);
    }, [initialTab]);

    if (!state.selectedRepoId) {
        return <div style={{ padding: 20 }}>저장소를 선택하세요.</div>;
    }

    return (
        <div className={`diff-page-container${embedded ? " embedded" : ""}`} style={embedded ? undefined : { padding: "0 16px" }}>
            <div className="sub-tabs" style={{ borderBottom: "1px solid #ddd", marginBottom: 16 }}>
                <button
                    className={`tab-btn ${activeDiff === "changes" ? "active" : ""}`}
                    onClick={() => setActiveDiff("changes")}
                >
                    현재 변경사항
                </button>
                <button
                    className={`tab-btn ${activeDiff === "compare" ? "active" : ""}`}
                    onClick={() => setActiveDiff("compare")}
                >
                    저장/버전 비교
                </button>
            </div>

            {activeDiff === "changes" && (
                <div className="changes-container" style={{ display: "flex", gap: 16 }}>
                    <div className="working-diff-panel" style={{ flex: 1, border: "1px solid #eee", borderRadius: 8 }}>
                        <h4 style={{ padding: "8px 12px", borderBottom: "1px solid #eee", margin: 0, backgroundColor: "#fcfcfc" }}>
                            작업 중인 변경사항 (Unstaged)
                        </h4>
                        <div style={{ padding: 12 }}>
                            <WorkingDiffView />
                        </div>
                    </div>
                    <div className="staged-diff-panel" style={{ flex: 1, border: "1px solid #eee", borderRadius: 8 }}>
                        <h4 style={{ padding: "8px 12px", borderBottom: "1px solid #eee", margin: 0, backgroundColor: "#fcfcfc" }}>
                            올릴 예정인 변경사항 (Staged)
                        </h4>
                        <div style={{ padding: 12 }}>
                            <StagedDiffView />
                        </div>
                    </div>
                </div>
            )}

            {activeDiff === "compare" && <CompareDiffView />}
        </div>
    );
}