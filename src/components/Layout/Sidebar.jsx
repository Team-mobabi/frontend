import React, { useState } from "react";
import { useGit } from "../../features/GitCore/GitContext.jsx";
import { repoIdOf } from "../../features/GitCore/repoUtils.js";
import CreateRepoModal from "../Layout/CreateRepoModal";
import { api } from "../../features/API.js";

export default function Sidebar() {
    const { state, dispatch } = useGit();
    const repos = state.repositories || [];
    const activeId = state.selectedRepoId;
    const [openNew, setOpenNew] = useState(false);

    const handleDeleteRepo = async (e, repo) => {
        e.stopPropagation();

        const rid = repoIdOf(repo);
        if (window.confirm(`'${repo.name}' 레포지토리를 정말로 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
            try {
                await api.repos.delete(rid);

                // ▼▼▼ [수정] UI를 즉시 업데이트하도록 dispatch 액션 변경 ▼▼▼
                dispatch({ type: "REMOVE_REPO", payload: rid });
                // ▲▲▲ [수정] UI를 즉시 업데이트하도록 dispatch 액션 변경 ▲▲▲

            } catch (error) {
                alert(`삭제 실패: ${error.message}`);
            }
        }
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

            <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => setOpenNew(true)}>
                새 레포 만들기
            </button>

            <CreateRepoModal open={openNew} onClose={() => setOpenNew(false)} dispatch={dispatch} />
        </div>
    );
}