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
        if (window.confirm(`'${repo.name}' 레포지토리를 정말로 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
            try {
                await api.repos.delete(rid);
                dispatch({ type: "REMOVE_REPO", payload: rid });
            } catch (error) {
                alert(`삭제 실패: ${error.message}`);
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
            <h3>내 레포지토리</h3>
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
                새 레포 만들기
            </button>

            <CreateRepoModal
                open={createModalOpen}
                onClose={() => setCreateModalOpen(false)}
                onRepoCreated={handleRepoCreated}
            />
        </div>
    );
}