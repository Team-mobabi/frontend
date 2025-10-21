import React, { useEffect, useState } from "react";
import { useGit } from "../../features/GitCore/GitContext";
import { api } from "../../features/API";
import AddModal from "./AddModal";
import StagingSummary from "./StagingSummary";
import RemoteConnectModal from "./RemoteConnectModal";

const STEP_LABEL = { 1: "원격에서 받아오기", 2: "파일 담기", 3: "메시지 쓰고 저장", 4: "원격으로 올리기" };

function normalizeBranchList(input) {
    if (!input) return ["main"];
    if (!Array.isArray(input) && Array.isArray(input.branches)) { return normalizeBranchList(input.branches); }
    if (Array.isArray(input)) {
        const names = input.map((b) => typeof b === "string" ? b : (b?.name || "")).filter(Boolean);
        return names.length ? names : ["main"];
    }
    return Object.keys(input || {}).length ? Object.keys(input || {}) : ["main"];
}

function fileListOf(c) {
    const a = c?.files || [];
    if (Array.isArray(a) && a.length) return a.map(String);
    return [];
}

function findMissingCommits(graph, branch, direction) {
    const local = graph?.local ?? {};
    const remote = graph?.remote ?? {};
    const lb = local?.branches?.[branch] || [];
    const rb = remote?.branches?.[branch] || [];
    const lhashes = lb.map((c) => c?.hash || "");
    const rhashes = rb.map((c) => c?.hash || "");

    if (direction === "push") {
        const base = rhashes[rhashes.length - 1];
        return base ? lb.slice(lhashes.lastIndexOf(base) + 1) : lb;
    } else {
        const base = lhashes[lhashes.length - 1];
        return base ? rb.slice(rhashes.lastIndexOf(base) + 1) : rb;
    }
}

function summarizeFiles(commits) {
    return Array.from(new Set(commits.flatMap(c => fileListOf(c)).map(String)));
}

export default function ActionButtons() {
    const { state, dispatch } = useGit();
    const repoId = state.selectedRepoId;
    const [step, setStep] = useState(1);
    const [msg, setMsg] = useState("");
    const [openAdd, setOpenAdd] = useState(false);
    const [toast, setToast] = useState("");
    const [busy, setBusy] = useState(false);
    const [needsInitialPush, setNeedsInitialPush] = useState(false);
    const [branches, setBranches] = useState(["main"]);
    const [selBranch, setSelBranch] = useState("main");
    const [pullOpen, setPullOpen] = useState(false);
    const [pushOpen, setPushOpen] = useState(false);
    const [remoteModalOpen, setRemoteModalOpen] = useState(false);
    const [retryPushBranch, setRetryPushBranch] = useState(null);

    useEffect(() => {
        if (repoId) {
            setStep(1);
            setMsg("");
            setPullOpen(false);
            setPushOpen(false);
        }
    }, [repoId]);

    useEffect(() => {
        if (repoId) {
            api.repos.status(repoId).then(st => setNeedsInitialPush(st.isEmpty)).catch(() => setNeedsInitialPush(true));
            api.branches.list(repoId).then(list => {
                const branches = normalizeBranchList(list);
                setBranches(branches);
                if (!branches.includes(selBranch)) {
                    setSelBranch(branches[0] || "main");
                }
            });
        }
    }, [repoId, state.graphVersion]);

    const fail = (e, fb) => setToast(e?.message || fb || "오류가 발생했어요.");
    const guard = (targetStep, fn) => {
        if (!repoId) return setToast("레포지토리를 먼저 선택해주세요.");
        if (step !== targetStep && !needsInitialPush) return setToast(`먼저 “${STEP_LABEL[step]}”를 진행해주세요!`);
        if (busy) return;
        fn();
    };

    const handleAddConfirm = async (selection) => {
        setOpenAdd(false);
        if (!selection || selection.length === 0) return;
        setBusy(true);
        try {
            const isFileUpload = selection[0] instanceof File;
            let stagedNames = [];
            if (isFileUpload) {
                const uploadResult = await api.repos.upload(repoId, selection);
                const uploadedFileNames = uploadResult?.saved || [];
                if (uploadedFileNames.length > 0) await api.repos.add(repoId, uploadedFileNames);
                stagedNames = uploadedFileNames;
            } else {
                await api.repos.add(repoId, selection);
                stagedNames = selection;
            }
            if (stagedNames.length > 0) {
                dispatch({ type: "ADD_SELECTED", payload: stagedNames });
                dispatch({ type: "SET_ANIMATION_START", payload: "add" });
                setStep(3);
                setToast(`${stagedNames.length}개 파일을 담았어요.`);
            }
        } catch (e) { fail(e, "파일 담기에 실패했어요."); }
        finally { setBusy(false); }
    };

    const handleCommit = async () => {
        const text = msg.trim();
        if (!text) return;
        setBusy(true);
        dispatch({ type: "SET_ANIMATION_START", payload: "commit" });
        setTimeout(async () => {
            try {
                await api.repos.commit(repoId, text);
                dispatch({ type: "COMMIT_SUCCESS", message: text });
                setMsg("");
                setStep(4);
                if(needsInitialPush) setNeedsInitialPush(false);
            } catch (e) {
                fail(e, "버전 저장에 실패했어요.");
                dispatch({ type: "SET_ANIMATION_END" });
            } finally {
                setBusy(false);
            }
        }, 600);
    };

    const handlePush = async (branchName) => {
        setBusy(true);
        setPushOpen(false);
        try {
            await api.branches.switch(repoId, branchName);
            const graph = await api.repos.graph(repoId);
            const transfer = findMissingCommits(graph, branchName, "push");
            if (transfer.length > 0) {
                const payload = { type: "push", branch: branchName, commits: transfer, files: summarizeFiles(transfer) };
                dispatch({ type: "SET_TRANSFER", payload });
                dispatch({ type: "SET_ANIMATION_START", payload: "push" });
            }
            await api.repos.push(repoId, { branch: branchName });
            setTimeout(() => {
                setStep(1);
                setToast("원격으로 올렸어요.");
            }, 600);
        } catch (e) {
            if (e.message?.includes("리모트") || e.message?.includes("No such device or address")) {
                setToast("원격 저장소 주소를 먼저 연결해야 합니다.");
                setRetryPushBranch(branchName);
                setRemoteModalOpen(true);
            } else {
                fail(e, "올리기에 실패했어요.");
            }
            dispatch({ type: "SET_ANIMATION_END" });
        } finally {
            setBusy(false);
        }
    };

    const handlePull = async (branchName) => {
        setBusy(true);
        setPullOpen(false);
        try {
            await api.branches.switch(repoId, branchName);
            const graph = await api.repos.graph(repoId);
            const transfer = findMissingCommits(graph, branchName, "pull");
            if (transfer.length > 0) {
                const payload = { type: "pull", branch: branchName, commits: transfer, files: summarizeFiles(transfer) };
                dispatch({ type: "SET_TRANSFER", payload });
                dispatch({ type: "SET_ANIMATION_START", payload: "pull" });
            }
            await api.repos.pull(repoId, { branch: branchName });
            setTimeout(() => {
                setStep(2);
                setToast("원격에서 받아왔어요.");
            }, 600);
        } catch (e) {
            if (e?.status === 409) {
                if (e.message?.includes("empty or branch does not exist")) {
                    setToast("원격 저장소가 비어있습니다. '파일 담기'부터 시작해주세요!");
                    setNeedsInitialPush(true);
                    setStep(2);
                } else {
                    setToast("로컬에 푸시하지 않은 변경사항이 있습니다. 먼저 'Push'를 시도해주세요!");
                }
            } else {
                fail(e, "받아오기에 실패했어요.");
            }
            dispatch({ type: "SET_ANIMATION_END" });
        } finally {
            setBusy(false);
        }
    };

    const handleCreateBranch = async () => {
        setPullOpen(false);
        const newBranchName = prompt(`'${selBranch}' 브랜치에서 시작할 새 브랜치 이름을 입력하세요:`);
        if (!newBranchName || !newBranchName.trim()) {
            setToast("브랜치 이름이 유효하지 않습니다.");
            return;
        }
        const finalName = newBranchName.trim();
        setBusy(true);
        try {
            await api.branches.create(repoId, { name: finalName, from: selBranch });
            setToast(`'${finalName}' 브랜치를 만들었습니다!`);
            setSelBranch(finalName);
            setBranches(prev => [...prev, finalName]);
            dispatch({ type: "GRAPH_DIRTY" });
        } catch (e) {
            fail(e, "브랜치 생성에 실패했어요.");
        } finally {
            setBusy(false);
        }
    };

    const handleRemoteConnected = () => {
        setRemoteModalOpen(false);
        setToast("원격 저장소가 연결되었습니다. 자동으로 푸시를 재시도합니다.");
        if (retryPushBranch) {
            handlePush(retryPushBranch);
            setRetryPushBranch(null);
        }
    };

    const lock1 = step !== 1;
    const lock2 = step !== 2;
    const lock3 = step !== 3;
    const lock4 = step !== 4;

    return (
        <>
            <div className="panel">
                <div className="controls">
                    {needsInitialPush && step === 1 ? (
                        <button className="btn btn-success" onClick={() => { setStep(2); setToast("'파일 담기' 단계로 이동합니다."); }}>
                            초기 업로드 시작하기 (파일 담기)
                        </button>
                    ) : (
                        <div className={`btn-split-wrap ${lock1 ? 'locked' : ''}`}>
                            <button className="btn btn-split-action" onClick={() => guard(1, () => handlePull(selBranch))} disabled={lock1}>
                                {selBranch} 에서 받아오기
                            </button>
                            <button className="btn btn-split-trigger" onClick={() => guard(1, () => setPullOpen(!pullOpen))} disabled={lock1}>▼</button>
                            {pullOpen && !lock1 && (
                                <div className="combo-menu">
                                    {branches.map((b) => (<button key={b} className={`combo-item ${b === selBranch ? "active" : ""}`} onClick={() => { setSelBranch(b); setPullOpen(false); }}>{b}</button>))}
                                    <div style={{ borderTop: '1px solid var(--line)', margin: '4px 0' }} />
                                    <button className="combo-item" onClick={handleCreateBranch}>+ 새 브랜치 만들기...</button>
                                </div>
                            )}
                        </div>
                    )}

                    <button className={`btn ${lock2 ? "btn-locked" : ""}`} onClick={() => guard(2, () => setOpenAdd(true))}>파일 담기</button>
                    <input className="input" placeholder="커밋 메시지" value={msg} onChange={(e) => setMsg(e.target.value)} readOnly={lock3} />
                    <button className={`btn btn-success ${lock3 || !msg.trim() ? "btn-locked" : ""}`} onClick={() => guard(3, handleCommit)}>버전 저장</button>

                    <div className={`btn-split-wrap primary ${lock4 ? 'locked' : ''}`}>
                        <button className="btn btn-primary btn-split-action" onClick={() => guard(4, () => handlePush(selBranch))} disabled={lock4}>
                            {selBranch} 으로 올리기
                        </button>
                        <button className="btn btn-primary btn-split-trigger" onClick={() => guard(4, () => setPushOpen(!pushOpen))} disabled={lock4}>▼</button>
                        {pushOpen && !lock4 && (
                            <div className="combo-menu">
                                {branches.map((b) => (<button key={b} className={`combo-item ${b === selBranch ? "active" : ""}`} onClick={() => { setSelBranch(b); setPushOpen(false); }}>{b}</button>))}
                            </div>
                        )}
                    </div>
                </div>
                <StagingSummary files={state.stagingArea} onRemove={(name) => dispatch({ type: "REMOVE_FROM_STAGING", payload: name })}/>
            </div>
            <AddModal open={openAdd} onCancel={() => setOpenAdd(false)} onConfirm={handleAddConfirm} />
            <RemoteConnectModal
                open={remoteModalOpen}
                repoId={repoId}
                onClose={() => setRemoteModalOpen(false)}
                onConnected={handleRemoteConnected}
            />
        </>
    );
}