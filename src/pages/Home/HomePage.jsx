import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Header from "../../components/Header/Header";
import Sidebar from "../../components/Layout/Sidebar";
import ActionButtons from "../../features/ControlPanel/ActionButtons";
import RepositoryView from "../../features/Visualization/RepositoryView";
import Toast from "../../components/Toast/Toast";
import ConfettiBurst from "../../components/Confetti/ConfettiBurst";
import { useGit } from "../../features/GitCore/GitContext";
import { api } from "../../features/API";

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
                    // 선택 복원이 안 되었으면 첫 레포 자동 선택
                    dispatch({ type: "SELECT_REPO", payload: arr[0]?.id || arr[0]?.repoId || arr[0]?._id });
                }
            } catch {}
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // 최초 1회
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
                <div className="workspace">
                    <ActionButtons />
                    <RepositoryView />
                </div>
            </div>
        </div>
    );
}
