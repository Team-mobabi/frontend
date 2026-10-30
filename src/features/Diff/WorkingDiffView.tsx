import { api } from "../../lib/api";
import { useGit } from "../GitCore/GitContext";
import DiffTextResult from "./DiffTextResult";
import { useDiffText } from "./useDiffText";

export default function WorkingDiffView() {
    const { state } = useGit();

    const result = useDiffText({
        repoId: state.selectedRepoId,
        load: api.repos.diffWorking,
        reloadKey: state.gitStatusCounter,
        emptyText: "작업 중인 변경사항이 없습니다.",
        errorText: "작업 중인 변경사항을 불러오는 데 실패했습니다.",
        initialLoading: true,
    });

    return <DiffTextResult {...result} />;
}
