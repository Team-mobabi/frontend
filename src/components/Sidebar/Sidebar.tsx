import { useState, type MouseEvent } from "react";
import { useGit } from "../../features/GitCore/GitContext";
import { repoIdOf } from "../../features/GitCore/gitUtils";
import CreateRepoModal from "../Modal/CreateRepoModal";
import { api, ApiError, errorMessage, getToken } from "../../lib/api";
import { createLogger } from "../../lib/logger";
import { useToast } from "../Toast/ToastProvider";
import type { Repo } from "../../types/api";

const log = createLogger("Sidebar");

export default function Sidebar() {
    const { state, dispatch } = useGit();
    const repos = state.repositories || [];
    const activeId = state.selectedRepoId;
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const toast = useToast();

    const handleDeleteRepo = async (e: MouseEvent<HTMLButtonElement>, repo: Repo) => {
        e.stopPropagation();
        const rid = repoIdOf(repo);
        if (window.confirm(`'${repo.name}' 저장소를 정말로 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
            try {
                // 안전한 삭제를 위해 먼저 main 브랜치로 전환
                try {
                    const graph = await api.repos.graph(rid);
                    const currentBranch = graph?.local?.currentBranch || graph?.currentBranch || "main";

                    if (currentBranch !== "main") {
                        await api.branches.switch(rid, "main");
                    }
                } catch (switchError) {
                    // 브랜치 전환 실패해도 삭제는 시도 (main이 없거나 이미 main일 수 있음)
                    log.warn("브랜치 전환 실패 (삭제 계속 진행)", switchError);
                }

                await api.repos.remove(rid);

                // 삭제된 저장소가 현재 선택된 저장소라면 선택 해제
                if (String(activeId) === String(rid)) {
                    dispatch({ type: "SELECT_REPO", payload: null });
                }

                dispatch({ type: "REMOVE_REPO", payload: rid });
            } catch (error) {
                const status = error instanceof ApiError ? error.status : undefined;
                // 403 권한 오류는 소유자 안내 메시지를 덧붙인다
                if (status === 403) {
                    toast.show(`삭제 실패: ${errorMessage(error, "권한이 없습니다")} — 저장소 소유자만 삭제할 수 있습니다.`, "error", 4000);
                    log.error("저장소 삭제 403 권한 오류", {
                        repoId: rid,
                        repoName: repo.name,
                        error: error instanceof ApiError ? error.data : undefined,
                        hasToken: Boolean(getToken()),
                    });
                } else {
                    toast.show(`삭제 실패: ${errorMessage(error, "알 수 없는 오류가 발생했습니다")}`, "error");
                    log.error("저장소 삭제 오류", { repoId: rid, repoName: repo.name, status, error });
                }
            }
        }
    };

    const handleRepoCreated = (newRepo: Repo) => {
        const repoId = newRepo.repoId || newRepo.id || null;

        dispatch({ type: "ADD_REPO", payload: newRepo });
        dispatch({ type: "SELECT_REPO", payload: repoId });
    };

    return (
        <div className="sidebar">
            <h3>내 저장소</h3>
            <div className="repo-list">
                {repos.map((r) => {
                    const rid = repoIdOf(r);
                    const active = String(rid) === String(activeId) ? "active" : "";
                    return (
                        <div
                            key={rid || r.name}
                            className={`repo-item ${active}`}
                            onClick={() => dispatch({ type: "SELECT_REPO", payload: rid })}
                        >
                            <div className="repo-dot" />
                            <div className="repo-name">{r.name}</div>
                            <div className="repo-item-right">
                                <div className="repo-branch">{r.defaultBranch || "main"}</div>
                                <button
                                    className="repo-item-delete"
                                    onClick={(e) => handleDeleteRepo(e, r)}
                                    title={`${r.name} 삭제`}
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => setCreateModalOpen(true)}>
                새 저장소 만들기
            </button>

            <CreateRepoModal
                open={createModalOpen}
                onClose={() => setCreateModalOpen(false)}
                onRepoCreated={handleRepoCreated}
            />
        </div>
    );
}
