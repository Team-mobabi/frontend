import React, { useEffect, useState } from "react";
import { useGit } from "../../features/GitCore/GitContext";
import { api } from "../../features/API";
import AddModal from "./AddModal";
import StagingSummary from "./StagingSummary";
import RemoteConnectModal from "../../components/Modal/RemoteConnectModal.jsx";
import PushConfirmModal from "../../components/Modal/PushConfirmModal";

const STEP_LABEL = { 1: "원격에서 받아오기", 2: "파일 담기", 3: "메시지 쓰고 저장", 4: "원격으로 올리기" };

// --- Helper Functions ---
function normalizeBranchList(input) {
    if (!input) return ["main"];
    if (!Array.isArray(input) && Array.isArray(input.branches)) {
        return normalizeBranchList(input.branches);
    }
    if (Array.isArray(input)) {
        const names = input
            .map((b) => (typeof b === "string" ? b : (b?.name || "")))
            .filter(Boolean);
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

// --- Component ---
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

    const [pushConfirmOpen, setPushConfirmOpen] = useState(false);
    const [commitsToPush, setCommitsToPush] = useState([]);

    // --- Effects ---
    useEffect(() => {
        if (repoId) {
            setMsg("");
            setPullOpen(false);
            setPushOpen(false);
        }
    }, [repoId]);

    useEffect(() => {
        if (!repoId) return;
        Promise.all([
            api.repos.status(repoId),
            api.repos.graph(repoId),
            api.branches.list(repoId)
        ])
            .then(([st, graph, list]) => {
                const fetchedBranches = normalizeBranchList(list);
                setBranches(fetchedBranches);
                let currentBranch = selBranch;
                if (!fetchedBranches.includes(selBranch)) {
                    currentBranch = fetchedBranches[0] || "main";
                    setSelBranch(currentBranch);
                }
                setNeedsInitialPush(Boolean(st.isEmpty));

                const stagedFiles = Array.isArray(st?.files) ? st.files : [];
                const localCommitsToPush = findMissingCommits(graph, currentBranch, "push");

                if (stagedFiles.length > 0) {
                    setStep(3);
                    const stagedFileNames = stagedFiles.map(f => f.path || f.file || f.name || String(f));
                    dispatch({ type: "ADD_SELECTED", payload: stagedFileNames });
                } else if (localCommitsToPush.length > 0) {
                    setStep(4);
                } else if (st.isEmpty) {
                    setStep(2);
                } else {
                    setStep(1);
                }
            })
            .catch((err) => {
                console.error("Status Check: Failed to fetch repo data:", err);
                setNeedsInitialPush(true);
                setStep(1);
                api.branches.list(repoId)
                    .then(list => {
                        const fetchedBranches = normalizeBranchList(list);
                        setBranches(fetchedBranches);
                    })
                    .catch(() => setBranches(["main"]));
            });
    }, [repoId, dispatch, selBranch]);

    // --- Handlers ---
    const fail = (e, fb) => setToast(e?.message || fb || "오류가 발생했어요.");

    const guard = (targetStep, fn) => {
        if (!repoId) return setToast("레포지토리를 먼저 선택해주세요.");
        if (step !== targetStep && !(needsInitialPush && targetStep === 2 && step === 1)) {
            setToast(`먼저 “${STEP_LABEL[step]}”를 진행해주세요!`);
            return;
        }
        if (busy) return;
        fn();
    };

    const handlePull = async (branchName) => {
        setBusy(true);
        setPullOpen(false);
        try {
            await api.branches.switch(repoId, branchName);
            const graph = await api.repos.graph(repoId);
            const transfer = findMissingCommits(graph, branchName, "pull");

            const pullResult = await api.repos.pull(repoId, {branch: branchName});
            if (pullResult?.hasConflict) {
                setToast("충돌이 발생했습니다! AI가 해결책을 제안합니다.");
                dispatch({type: "OPEN_CONFLICT_MODAL"});
            } else {
                if (transfer.length > 0) {
                    const payload = {
                        type: "pull",
                        branch: branchName,
                        commits: transfer,
                        files: summarizeFiles(transfer)
                    };
                    dispatch({type: "SET_TRANSFER", payload});
                    dispatch({type: "SET_ANIMATION_START", payload: "pull"});
                }
                setTimeout(() => {
                    setStep(2);
                    setToast("원격에서 받아왔어요.");
                    // 기존 코드 유지 (그래프/통계 갱신)
                    dispatch({type: "GRAPH_DIRTY"});
                }, 600);
            }
        } catch (e) {
            console.error("[ActionButtons] Pull 실패:", e);
            if (e.message?.includes("커밋되지 않은 변경사항") || e.message?.includes("Uncommitted Changes")) {
                // 🔽 여기만 바꿔주세요
                setToast("커밋되지 않은 변경사항이 있습니다. 먼저 파일을 담아 커밋해주세요.");
                setStep(2);           // 담기 단계로 이동
                setOpenAdd(true);     // 업로드/추가 모달 자동 오픈
            } else if (e?.status === 409 && e.message?.includes("empty or branch does not exist")) {
                setToast("원격 저장소가 비어있거나 브랜치가 없습니다. '파일 담기'부터 시작해주세요!");
                setNeedsInitialPush(true);
                setStep(2);
            } else {
                fail(e, "받아오기에 실패했어요.");
            }
            dispatch({type: "SET_ANIMATION_END"});
        } finally {
            setBusy(false);
        }
    }

    const handleAddConfirm = async (selection) => {
        setOpenAdd(false);
        if (!selection || selection.length === 0) return;

        setBusy(true);
        try {
            const uploadResult = await api.repos.upload(repoId, selection);
            const uploadedFileNames = Array.isArray(uploadResult?.saved) ? uploadResult.saved : [];
            if (uploadedFileNames.length > 0) {
                await api.repos.add(repoId, uploadedFileNames);
            }
            const stagedNames = uploadedFileNames;

            if (stagedNames.length > 0) {
                dispatch({ type: "ADD_SELECTED", payload: stagedNames });
                dispatch({ type: "SET_ANIMATION_START", payload: "add" });
                setStep(3);
                setToast(`${stagedNames.length}개 파일을 담았어요.`);
                // 기존 코드 유지 (그래프/통계 갱신)
                dispatch({ type: "GRAPH_TICK" });
            } else {
                setToast("파일은 담겼으나, staged 목록이 비어있습니다.");
            }
        } catch (e) {
            fail(e, "파일 담기에 실패했어요.");
        } finally {
            setBusy(false);
        }
    };

    const handleCommit = async () => {
        const text = msg.trim();
        if (!text) return;
        setBusy(true);
        dispatch({ type: "SET_ANIMATION_START", payload: "commit" });

        try {
            await api.repos.commit(repoId, text);
            setMsg("");
            dispatch({ type: "COMMIT_SUCCESS", message: text });
            // 기존 코드 유지 (그래프/통계 갱신)
            dispatch({ type: "GRAPH_TICK" });
            await new Promise(resolve => setTimeout(resolve, 600));
            setStep(4);
            if (needsInitialPush) setNeedsInitialPush(false);
        } catch (e) {
            fail(e, "버전 저장에 실패했어요.");
            dispatch({ type: "SET_ANIMATION_END" });
        } finally {
            setBusy(false);
        }
    };

    const handlePush = async (branchName) => {
        setPushOpen(false);
        try {
            await api.branches.switch(repoId, branchName);
            const graph = await api.repos.graph(repoId);
            const transfer = findMissingCommits(graph, branchName, "push");
            setCommitsToPush(transfer);
            setPushConfirmOpen(true);
        } catch (e) {
            if (
                e.message?.includes("리모트") ||
                e.message?.includes("No such device or address") ||
                e.message?.includes("Could not resolve host")
            ) {
                setToast("원격 저장소 주소를 먼저 연결해야 합니다.");
                setRetryPushBranch(branchName);
                setRemoteModalOpen(true);
            } else {
                // 🔧 템플릿 리터럴로 수정
                fail(e, `${branchName} 브랜치 정보를 가져오는 중 오류 발생`);
            }
        }
    };

    const executePush = async (branchName) => {
        setPushConfirmOpen(false);
        setBusy(true);
        dispatch({ type: "SET_ANIMATION_START", payload: "push" });

        const payload = {
            type: "push",
            branch: branchName,
            commits: commitsToPush,
            files: summarizeFiles(commitsToPush)
        };
        dispatch({ type: "SET_TRANSFER", payload });

        try {
            await api.repos.push(repoId, { branch: branchName });

            setTimeout(() => {
                setStep(1);
                setToast("원격으로 올렸어요.");
                // 기존 코드 유지 (그래프/통계 갱신)
                dispatch({ type: "GRAPH_DIRTY" });
                setCommitsToPush([]);
                setBusy(false);
            }, 600);
        } catch (e) {
            dispatch({ type: "SET_ANIMATION_END" });
            if (e.message?.includes("does not exist on remote") || e.message?.includes("no upstream")) {
                // 🔧 문자열 깨짐 수정
                if (window.confirm(`'${branchName}' 브랜치가 원격 저장소에 없습니다.
새 브랜치로 '게시(Publish)'하시겠습니까?`)) {
                    try {
                        setBusy(true);
                        await api.repos.push(repoId, { branch: branchName, setUpstream: true });
                        setTimeout(() => {
                            setStep(1);
                            // 🔧 템플릿 리터럴로 수정
                            setToast(`'${branchName}' 브랜치를 원격에 게시했습니다.`);
                            dispatch({ type: "GRAPH_DIRTY" });
                            setBusy(false);
                        }, 600);
                    } catch (pushErr) {
                        fail(pushErr, "브랜치 게시에 실패했습니다.");
                        setBusy(false);
                    }
                } else {
                    setBusy(false);
                }
            } else {
                fail(e, "올리기에 실패했어요.");
                setBusy(false);
            }
            setCommitsToPush([]);
        }
    };

    // 브랜치 생성 (switch 옵션 제거)
    const handleCreateBranch = async () => {
        setPullOpen(false);
        const newBranchName = prompt(`'${selBranch}' 브랜치에서 시작할 새 브랜치 이름을 입력하세요:`)?.trim();
        if (!newBranchName) return setToast("브랜치 이름이 유효하지 않습니다.");
        setBusy(true);
        try {
            await api.branches.create(repoId, { name: newBranchName, from: selBranch });
            setToast(`'${newBranchName}' 브랜치를 만들었습니다!`);
            setBranches(prev => (prev.includes(newBranchName) ? prev : [...prev, newBranchName]).sort());
            // 그래프 갱신
            dispatch({ type: "GRAPH_TICK" });
        } catch (e) {
            fail(e, "브랜치 생성에 실패했어요.");
        } finally {
            setBusy(false);
        }
    };

    // (참조되고 있어 정의 필요) 브랜치 삭제
    const handleDeleteBranch = async (branchName) => {
        setPullOpen(false);
        if (branchName === "main") {
            setToast("'main' 브랜치는 삭제할 수 없습니다.");
            return;
        }
        if (!window.confirm(`'${branchName}' 브랜치를 정말로 삭제하시겠습니까?`)) {
            return;
        }
        setBusy(true);
        try {
            await api.branches.delete(repoId, branchName);
            setToast(`'${branchName}' 브랜치를 삭제했습니다.`);
            setBranches(prev => prev.filter(b => b !== branchName));
            if (selBranch === branchName) {
                setSelBranch("main");
                await api.branches.switch(repoId, "main");
            }
            dispatch({ type: "GRAPH_TICK" });
        } catch (e) {
            fail(e, "브랜치 삭제에 실패했어요.");
        } finally {
            setBusy(false);
        }
    };

    // --- Button Locks ---
    const lock1 = step !== 1 || busy;
    const lock2 = step !== 2 || busy;
    const lock3 = step !== 3 || busy;
    const lock4 = step !== 4 || busy;
    const isCommitDisabled = lock3 || !msg.trim();

    // --- Render ---
    return (
        <>
            <div className="panel">
                <div className="controls">
                    {needsInitialPush && step === 1 ? (
                        <button
                            className="btn btn-success"
                            onClick={() => {
                                setStep(2);
                                setToast("'파일 담기' 단계로 이동합니다.");
                            }}
                        >
                            초기 업로드 시작하기 (파일 담기)
                        </button>
                    ) : (
                        <div className={`btn-split-wrap ${lock1 ? "locked" : ""}`}>
                            <button
                                className="btn btn-split-action"
                                onClick={() => guard(1, () => handlePull(selBranch))}
                                disabled={lock1}
                            >
                                {selBranch} 에서 받아오기
                            </button>
                            <button
                                className="btn btn-split-trigger"
                                onClick={() => guard(1, () => setPullOpen(!pullOpen))}
                                disabled={lock1}
                            >
                                ▼
                            </button>
                            {pullOpen && !lock1 && (
                                <div className="combo-menu">
                                    {branches.map((b) => (
                                        <div key={b} className="combo-item-wrap">
                                            <button
                                                className={`combo-item ${b === selBranch ? "active" : ""}`}
                                                onClick={() => {
                                                    setSelBranch(b);
                                                    setPullOpen(false);
                                                }}
                                            >
                                                {b}
                                            </button>
                                            {b !== "main" && (
                                                <button
                                                    className="combo-item-delete"
                                                    title={`${b} 삭제`}
                                                    onClick={() => handleDeleteBranch(b)}
                                                >
                                                    🗑️
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <div style={{ borderTop: "1px solid var(--line)", margin: "4px 0" }} />
                                    <button className="combo-item" onClick={handleCreateBranch}>
                                        + 새 브랜치 만들기...
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <button
                        className={`btn ${lock2 ? "btn-locked" : ""}`}
                        onClick={() => guard(2, () => setOpenAdd(true))}
                        disabled={lock2}
                    >
                        파일 담기
                    </button>

                    <input
                        className="input"
                        placeholder="커밋 메시지"
                        value={msg}
                        onChange={(e) => setMsg(e.target.value)}
                        readOnly={lock3}
                        disabled={lock3}
                    />

                    <button
                        className={`btn btn-success ${isCommitDisabled ? "btn-locked" : ""}`}
                        onClick={() => guard(3, handleCommit)}
                        disabled={isCommitDisabled}
                    >
                        버전 저장
                    </button>

                    <div className={`btn-split-wrap primary ${lock4 ? "locked" : ""}`}>
                        <button
                            className="btn btn-primary btn-split-action"
                            onClick={() => guard(4, () => handlePush(selBranch))}
                            disabled={lock4}
                        >
                            {selBranch} 으로 올리기
                        </button>
                        <button
                            className="btn btn-primary btn-split-trigger"
                            onClick={() => guard(4, () => setPushOpen(!pushOpen))}
                            disabled={lock4}
                        >
                            ▼
                        </button>
                        {pushOpen && !lock4 && (
                            <div className="combo-menu">
                                {branches.map((b) => (
                                    <button
                                        key={b}
                                        className={`combo-item ${b === selBranch ? "active" : ""}`}
                                        onClick={() => {
                                            setSelBranch(b);
                                            setPushOpen(false);
                                        }}
                                    >
                                        {b}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <StagingSummary
                    files={state.stagingArea}
                    onRemove={(name) => dispatch({ type: "REMOVE_FROM_STAGING", payload: name })}
                />
            </div>

            <AddModal
                open={openAdd}
                onCancel={() => setOpenAdd(false)}
                onConfirm={handleAddConfirm}
            />

            <RemoteConnectModal
                open={remoteModalOpen}
                repoId={repoId}
                onClose={() => setRemoteModalOpen(false)}
                onConnected={() => {
                    setRemoteModalOpen(false);
                    handlePush(retryPushBranch);
                }}
            />

            <PushConfirmModal
                open={pushConfirmOpen}
                onClose={() => setPushConfirmOpen(false)}
                onConfirm={() => executePush(selBranch)}
                branch={selBranch}
                commits={commitsToPush}
            />

            {toast && (
                <div
                    style={{
                        position: "fixed",
                        bottom: "20px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: "rgba(0,0,0,0.7)",
                        color: "white",
                        padding: "10px 20px",
                        borderRadius: "8px",
                        zIndex: 1000
                    }}
                >
                    {toast}
                    <button
                        onClick={() => setToast("")}
                        style={{
                            marginLeft: "10px",
                            background: "none",
                            border: "none",
                            color: "white",
                            cursor: "pointer"
                        }}
                    >
                        X
                    </button>
                </div>
            )}
        </>
    );
}
