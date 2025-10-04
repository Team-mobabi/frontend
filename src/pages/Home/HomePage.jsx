import React, { useEffect } from "react";
import { useGit } from "../../features/GitCore/GitContext";
import { api } from "../../features/API";
import Sidebar from "../../components/Layout/Sidebar";
import ActionButtons from "../../features/ControlPanel/ActionButtons";
import RepositoryView from "../../features/Visualization/RepositoryView";

export default function HomePage() {
    const { dispatch } = useGit();

    useEffect(() => {
        let on = true;
        (async () => {
            try {
                const list = await api.repos.list();
                if (!on) return;
                dispatch({ type: "SET_REPOS", payload: list });
            } catch {
                dispatch({ type: "SET_REPOS", payload: [] });
            }
        })();
        return () => { on = false; };
    }, [dispatch]);

    return (
        <div className="home-page">
            <div className="main-content">
                <Sidebar />
                <div>
                    <ActionButtons />
                    <RepositoryView />
                </div>
            </div>
        </div>
    );
}
