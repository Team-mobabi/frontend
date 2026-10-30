import { memo } from "react";
import { api } from "../../lib/api";
import { useGit } from "../GitCore/GitContext";
import DiffTextResult from "./DiffTextResult";
import { useDiffText } from "./useDiffText";

interface StagedDiffViewProps {
    compact?: boolean;
    collapsible?: boolean;
}

const StagedDiffView = memo(function StagedDiffView({ compact = false, collapsible = true }: StagedDiffViewProps) {
    const { state } = useGit();
    const stagingAreaLength = state.stagingArea?.length || 0;

    // 스테이징 변화가 연달아 올 수 있어 첫 로딩 이후엔 100ms 디바운스
    const result = useDiffText({
        repoId: state.selectedRepoId,
        load: api.repos.diffStaged,
        reloadKey: `${state.gitStatusCounter}:${stagingAreaLength}`,
        emptyText: "올릴 예정인 변경사항이 없습니다.",
        errorText: "올릴 예정인 변경사항을 불러오는 데 실패했습니다.",
        debounceMs: 100,
    });

    return <DiffTextResult {...result} compact={compact} collapsible={collapsible} />;
});

export default StagedDiffView;
