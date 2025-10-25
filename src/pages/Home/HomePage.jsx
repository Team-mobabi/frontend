import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Header from "../../components/Header/Header";
import Sidebar from "../../components/Sidebar/Sidebar";
import ActionButtons from "../../features/ControlPanel/ActionButtons";
import RepositoryView from "../../features/Visualization/RepositoryView";
import DiffStatsView from "../../features/Diff/DiffStatsView";
import Toast from "../../components/Toast/Toast";
import ConfettiBurst from "../../components/Confetti/ConfettiBurst";
import { useGit } from "../../features/GitCore/GitContext";
import { api } from "../../features/API";
import PullRequestListView from "../../features/Visualization/PullRequestListView";
import PullRequestDetailView from "../../features/Visualization/PullRequestDetailView";
import FileBrowserView from "../../features/FileBrowser/FileBrowserView";

export default function HomePage(){
    const loc = useLocation();
    const nav = useNavigate();
    const { state, dispatch } = useGit();

    const [showWelcome, setShowWelcome] = useState(Boolean(loc.state?.welcome));
    const username = loc.state?.username || "환영합니다!";

    useEffect(() => {
        if (loc.state?.welcome) nav(".", { replace: true, state: {} });
    }, [loc.state, nav]);

    useEffect(() => {
        (async () => {
            try {
                const list = await api.repos.list();
                const arr = Array.isArray(list) ? list : (list?.items || []);
                dispatch({ type: "SET_REPOS", payload: arr });
                if (!state.selectedRepoId && arr.length) {
                    dispatch({ type: "SELECT_REPO", payload: arr[0]?.id || arr[0]?.repoId || arr[0]?._id });
                }
            } catch {}
        })();
    }, []);

    const renderCurrentView = () => {
        switch (state.currentView) {
            case "graph":
                return (
                    <>
                        <DiffStatsView />
                        <RepositoryView />
                    </>
                );
            case "diff": // ★ 신규 뷰
                return <DiffSummaryView />;
            case "prs":
                return <PullRequestListView />;
            case "pr_detail":
                return <PullRequestDetailView />;
            case "files":
                return <FileBrowserView />;
            default:
                return (
                    <>
                        <DiffStatsView />
                        <RepositoryView />
                    </>
                );
        }
    };

    return (
        <div className="home-page">
            <Header />
            {showWelcome && (
                <>
                    <Toast message={`${username} 님, 가입을 환영해요! 🎉`} onClose={() => setShowWelcome(false)} />
                    <ConfettiBurst count={60} duration={1400} onDone={() => {}} />
                </>
            )}
            <div className="main-content">
                <Sidebar />
                <div className="main-column">
                    <ActionButtons />

                    {state.currentView !== "pr_detail" && (
                        <div className="view-tabs">
                            <button
                                className={`tab-btn ${state.currentView === "graph" ? "active" : ""}`}
                                onClick={() => dispatch({ type: "SET_VIEW", payload: "graph" })}
                            >
                                그래프
                            </button>

                            <button
                                className={`tab-btn ${state.currentView === "files" ? "active" : ""}`}
                                onClick={() => dispatch({ type: "SET_VIEW", payload: "files" })}
                            >
                                파일
                            </button>

                            <button
                                className={`tab-btn ${state.currentView === "prs" ? "active" : ""}`}
                                onClick={() => dispatch({ type: "SET_VIEW", payload: "prs" })}
                            >
                                Pull Requests
                                {state.prList.length > 0 && <span className="tab-badge">{state.prList.length}</span>}
                            </button>
                        </div>
                    )}

                    {renderCurrentView()}
                </div>
            </div>
        </div>
    );
}
