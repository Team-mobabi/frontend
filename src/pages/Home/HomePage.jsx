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
import DiffView from "../../features/Diff/DiffView";
import { useAuth } from "../../features/auth/AuthContext";
import BeginnerHelp from "../BeginnerHelp";

export default function HomePage(){
    const loc = useLocation();
    const nav = useNavigate();
    const { state, dispatch } = useGit();
    const { user } = useAuth();

    const [showWelcome, setShowWelcome] = useState(Boolean(loc.state?.welcome));
    const [showHelpModal, setShowHelpModal] = useState(false); // --- 👇 도움말 모달 상태 추가 ---
    const username = loc.state?.username || "환영합니다!";

    // ... (useEffect 코드들은 이전과 동일) ...
    useEffect(() => {
        if (loc.state?.welcome) nav(".", { replace: true, state: {} });
    }, [loc.state, nav]);

    useEffect(() => {
        if (!user) {
            dispatch({ type: "SET_REPOS", payload: [] });
            dispatch({ type: "SELECT_REPO", payload: null });
            return;
        }

        (async () => {
            try {
                const list = await api.repos.list();
                const arr = Array.isArray(list) ? list : (list?.items || []);
                dispatch({ type: "SET_REPOS", payload: arr });

                const currentRepoId = state.selectedRepoId;
                const repoIdIsValid = arr.some(repo =>
                    (repo.id || repo.repoId || repo._id) === currentRepoId
                );

                if (currentRepoId && !repoIdIsValid) {
                    dispatch({ type: "SELECT_REPO", payload: null });
                    if (arr.length) {
                        dispatch({ type: "SELECT_REPO", payload: arr[0]?.id || arr[0]?.repoId || arr[0]?._id });
                    }
                } else if (!currentRepoId && arr.length) {
                    dispatch({ type: "SELECT_REPO", payload: arr[0]?.id || arr[0]?.repoId || arr[0]?._id });
                }
            } catch {}
        })();
    }, [user, dispatch, state.selectedRepoId]);

    useEffect(() => {
        const repoId = state.selectedRepoId;
        if (!repoId) {
            return;
        }

        let cancelled = false;

        api.pullRequests.list(repoId)
            .then(data => {
                if (cancelled) return;
                const next = data?.pullRequests || data || [];
                dispatch({ type: 'SET_PRS', payload: Array.isArray(next) ? next : [] });
            })
            .catch(err => {
                if (cancelled) return;
                console.error('[HomePage] Failed to refresh PR list:', err);
            });

        return () => {
            cancelled = true;
        };
    }, [dispatch, state.selectedRepoId, state.graphVersion]);


    const renderCurrentView = () => {
        switch (state.currentView) {
            case "graph":
                return (
                    <>
                        <DiffStatsView />
                        <RepositoryView />
                    </>
                );
            case "diff":
                return <DiffView />;
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
                        // ... (탭 버튼 코드는 이전과 동일) ...
                        <div className="view-tabs">
                            {/* ... 탭 버튼들 ... */}
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

            {/* --- 👇 도움말 버튼 추가 --- */}
            <button
                className="help-button"
                onClick={() => setShowHelpModal(true)}
                title="도움말 보기"
            >
                ?
            </button>

            {/* --- 👇 도움말 모달 조건부 렌더링 --- */}
            {showHelpModal && (
                <BeginnerHelp onClose={() => setShowHelpModal(false)} />
            )}
        </div>
    );
}