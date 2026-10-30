import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Header from "../../components/Header/Header";
import Sidebar from "../../components/Sidebar/Sidebar";
import ActionButtons from "../../features/ControlPanel/ActionButtons";
import RepositoryView from "../../features/Visualization/RepositoryView";
import DiffStatsView from "../../features/Diff/DiffStatsView";
import { useToast } from "../../components/Toast/ToastProvider";
import ConfettiBurst from "../../components/Confetti/ConfettiBurst";
import { useGit } from "../../features/GitCore/GitContext";
import { api } from "../../lib/api";
import { createLogger } from "../../lib/logger";
import { repoIdOf } from "../../features/GitCore/gitUtils";
import type { PullRequest } from "../../types/api";
import PullRequestListView from "../../features/Visualization/PullRequestListView";
import PullRequestDetailView from "../../features/Visualization/PullRequestDetailView";
import FileBrowserView from "../../features/FileBrowser/FileBrowserView";
import DiffView from "../../features/Diff/DiffView";
import { useAuth } from "../../features/auth/AuthContext";
import BeginnerHelp from "../BeginnerHelp";

const log = createLogger("HomePage");

// 회원가입 직후 navigate("/app", { state: { welcome: true } }) 로 전달된다
interface HomeLocationState {
    welcome?: boolean;
    username?: string;
}

export default function HomePage(){
    const loc = useLocation();
    const locState = loc.state as HomeLocationState | null;
    const nav = useNavigate();
    const { state, dispatch } = useGit();
    const { user } = useAuth();

    const [showWelcome, setShowWelcome] = useState(Boolean(locState?.welcome));
    const [showHelpModal, setShowHelpModal] = useState(false);
    const username = locState?.username || "환영합니다!";
    const toast = useToast();
    const welcomeShown = useRef(false);
    const hideWelcome = useCallback(() => setShowWelcome(false), []);

    // 가입 환영 메시지는 한 번만 띄운다 (StrictMode 이중 실행 방지)
    useEffect(() => {
        if (!showWelcome || welcomeShown.current) return;
        welcomeShown.current = true;
        toast.show(`${username} 님, 가입을 환영해요! 🎉`, "success", 2200);
    }, [showWelcome, username, toast]);

    useEffect(() => {
        if (locState?.welcome) nav(".", { replace: true, state: {} });
    }, [locState, nav]);

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
                const repoIdIsValid = arr.some(repo => repoIdOf(repo) === currentRepoId);

                if (currentRepoId && !repoIdIsValid) {
                    dispatch({ type: "SELECT_REPO", payload: null });
                    if (arr.length) {
                        dispatch({ type: "SELECT_REPO", payload: repoIdOf(arr[0]) });
                    }
                } else if (!currentRepoId && arr.length) {
                    dispatch({ type: "SELECT_REPO", payload: repoIdOf(arr[0]) });
                }
            } catch {
                // 목록 갱신 실패 시 기존 상태를 유지한다
            }
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
                const next: PullRequest[] | undefined = Array.isArray(data) ? data : data?.pullRequests;
                dispatch({ type: 'SET_PRS', payload: Array.isArray(next) ? next : [] });
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                log.error('Failed to refresh PR list', err);
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
                return (
                    <>
                        <DiffStatsView />
                        <DiffView />
                    </>
                );
            case "prs":
                return (
                    <>
                        <DiffStatsView />
                        <PullRequestListView />
                    </>
                );
            case "pr_detail":
                return (
                    <>
                        <DiffStatsView />
                        <PullRequestDetailView />
                    </>
                );
            case "files":
                return (
                    <>
                        <DiffStatsView />
                        <FileBrowserView />
                    </>
                );
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
            {showWelcome && <ConfettiBurst count={60} duration={1400} onDone={hideWelcome} />}
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
                                협업하기
                                {state.prList.length > 0 && <span className="tab-badge">{state.prList.length}</span>}
                            </button>
                        </div>
                    )}

                    {renderCurrentView()}

                    {/* 도움말 버튼 - 오른쪽 하단 */}
                    <button
                        className="floating-help-button"
                        onClick={() => setShowHelpModal(true)}
                        title="도움말"
                    >
                        ?
                    </button>
                </div>
            </div>

            {/* 모달들 */}
            {showHelpModal && (
                <BeginnerHelp onClose={() => setShowHelpModal(false)} />
            )}
        </div>
    );
}