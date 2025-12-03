import React, { useState } from "react";
import { useGit } from "../../features/GitCore/GitContext.jsx";
import { repoIdOf } from "../../features/GitCore/gitUtils.js";
import CreateRepoModal from "../Modal/CreateRepoModal.jsx";
import { api } from "../../features/API.js";

export default function Sidebar() {
    const { state, dispatch } = useGit();
    const repos = state.repositories || [];
    const activeId = state.selectedRepoId;
    const [createModalOpen, setCreateModalOpen] = useState(false);

    const handleDeleteRepo = async (e, repo) => {
        e.stopPropagation();
        const rid = repoIdOf(repo);
        if (window.confirm(`'${repo.name}' 저장소를 정말로 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
            try {
                // 안전한 삭제를 위해 먼저 main 브랜치로 전환
                try {
                    // 현재 브랜치 확인
                    const graph = await api.저장소.그래프(rid);
                    const currentBranch = graph?.currentBranch || "main";
                    
                    // main 브랜치가 아니면 main으로 전환
                    if (currentBranch !== "main") {
                        await api.가지.전환(rid, "main");
                    }
                } catch (switchError) {
                    // 브랜치 전환 실패해도 삭제는 시도 (main이 없거나 이미 main일 수 있음)
                    console.warn("브랜치 전환 실패 (삭제 계속 진행):", switchError);
                }
                
                // 브랜치 전환 후 삭제 실행
                await api.저장소.삭제(rid);
                
                // 삭제된 저장소가 현재 선택된 저장소라면 선택 해제
                if (String(activeId) === String(rid)) {
                    dispatch({ type: "SELECT_REPO", payload: null });
                }
                
                dispatch({ type: "REMOVE_REPO", payload: rid });
            } catch (error) {
                // 403 권한 오류인 경우 특별한 메시지 표시
                if (error.status === 403) {
                    const errorMsg = error.data?.message || error.message || "권한이 없습니다";
                    alert(`삭제 실패: ${errorMsg}\n\n저장소 소유자만 삭제할 수 있습니다.`);
                    console.error("[저장소 삭제] 403 권한 오류:", {
                        repoId: rid,
                        repoName: repo.name,
                        error: error.data,
                        token: api.auth.getToken() ? "있음" : "없음"
                    });
                } else {
                    const errorMsg = error.data?.message || error.message || "알 수 없는 오류가 발생했습니다";
                    alert(`삭제 실패: ${errorMsg}`);
                    console.error("[저장소 삭제] 오류:", {
                        repoId: rid,
                        repoName: repo.name,
                        status: error.status,
                        error: error.data || error.message
                    });
                }
            }
        }
    };

    const handleRepoCreated = (newRepo) => {
        const repoId = newRepo.repoId || newRepo.id;

        dispatch({ type: "ADD_REPO", payload: newRepo });
        dispatch({ type: "SELECT_REPO", payload: repoId });
    };

    return (
        <div className="sidebar">
            <h3>내 저장소</h3>
            <div className="repo-list">
                {(repos.length ? repos : []).map((r) => {
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