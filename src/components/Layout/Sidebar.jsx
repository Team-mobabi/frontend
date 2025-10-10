import React, { useState } from "react";
import { useGit } from "../../features/GitCore/GitContext.jsx";
import { repoIdOf } from "../../features/GitCore/repoUtils.js";
import CreateRepoModal from "../Layout/CreateRepoModal";

export default function Sidebar() {
    const { state, dispatch } = useGit();
    const repos = state.repositories || [];
    const activeId = state.selectedRepoId;
    const [openNew, setOpenNew] = useState(false);

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
                            <div className="repo-branch">{r.defaultBranch || "main"}</div>
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
