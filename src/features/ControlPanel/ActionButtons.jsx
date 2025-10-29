import React, { useEffect, useState } from "react";
import { useGit } from "../../features/GitCore/GitContext";
import { api } from "../../features/API";
import AddModal from "./AddModal";
import StagingSummary from "./StagingSummary";
import RemoteConnectModal from "../../components/Modal/RemoteConnectModal.jsx";
import PushConfirmModal from "../../components/Modal/PushConfirmModal";
import CommitConfirmModal from "../../components/Modal/CommitConfirmModal";

const STEP_LABEL = { 1: "서버에서 최신 내용 가져오기", 2: "변경된 파일 담기", 3: "변경 내용 설명 쓰고 저장", 4: "서버에 올리기" };

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

function findMissingCommits(graph, localBranch, direction, remoteBranch = null) {
    const remoteBranchName = remoteBranch || localBranch;
    const local = graph?.local ?? {};
    const remote = graph?.remote ?? {};
    const lb = local?.branches?.[localBranch] || [];
    const rb = remote?.branches?.[remoteBranchName] || [];
    const lhashes = lb.map((c) => c?.hash || "");
    const rhashes = rb.map((c) => c?.hash || "");

    if (direction === "push") {
        let localBaseIndex = -1;
        let remoteBaseIndex = -1;

        for (let i = 0; i < rhashes.length; i++) {
            const idx = lhashes.indexOf(rhashes[i]);
            if (idx !== -1) {
                localBaseIndex = idx;
                remoteBaseIndex = i;
                break;
            }
        }

        if (localBaseIndex === -1) return lb;

        const ahead = localBaseIndex;
        const behind = remoteBaseIndex;

        if (behind > 0) {
            const commits = lb.slice(0, localBaseIndex);
            commits._diverged = true;
            commits._behind = behind;
            return commits;
        }

        return lb.slice(0, localBaseIndex);
    } else {
        let baseIndex = -1;
        for (let i = 0; i < lhashes.length; i++) {
            const idx = rhashes.indexOf(lhashes[i]);
            if (idx !== -1) {
                baseIndex = idx;
                break;
            }
        }
        return baseIndex !== -1 ? rb.slice(0, baseIndex) : rb;
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

    const [pushConfirmOpen, setPushConfirmOpen] = useState(false);
    const [commitsToPush, setCommitsToPush] = useState([]);
    const [isDivergedPush, setIsDivergedPush] = useState(false);
    const [commitModalOpen, setCommitModalOpen] = useState(false);
    const [hasPushableCommits, setHasPushableCommits] = useState(false);
    const [pushTargetBranch, setPushTargetBranch] = useState("main");

    const [actionHint, setActionHint] = useState("");
    useEffect(() => {
        if (repoId) {
            setMsg("");
            setPullOpen(false);
            setPushOpen(false);
        }
    }, [repoId]);

    useEffect(() => {
        if (!toast) return;
        setActionHint(toast);
        const t = setTimeout(() => setActionHint(""), 6000);
        return () => clearTimeout(t);
    }, [toast]);

    useEffect(() => {
        if (!repoId) return;
        Promise.all([
            api.repos.status(repoId),
            api.repos.graph(repoId),
        ])
            .then(([st, graph]) => {
                const localBranches = Object.keys(graph?.local?.branches || {});
                const remoteBranchesList = Object.keys(graph?.remote?.branches || {});
                const allKnownBranches = [...new Set([...localBranches, ...remoteBranchesList])];
                const fetchedBranches = normalizeBranchList(allKnownBranches).sort();
                setBranches(fetchedBranches);

                let currentBranch = selBranch;
                if (!fetchedBranches.includes(selBranch)) {
                    currentBranch = fetchedBranches[0] || "main";
                    setSelBranch(currentBranch);
                }
                setPushTargetBranch(currentBranch);

                const stagedFiles = Array.isArray(st?.files) ? st.files : [];
                const localCommitsToPush = findMissingCommits(graph, currentBranch, "push");

                const remoteBranches = graph?.remote?.branches || {};
                const isNewLocalBranch = !remoteBranches[currentBranch];

                const canPush = localCommitsToPush.length > 0 || localCommitsToPush._diverged || isNewLocalBranch;
                setHasPushableCommits(canPush);

                if (stagedFiles.length > 0) {
                    setStep(3);
                    const stagedFileNames = stagedFiles.map(f => f.path || f.file || f.name || String(f));
                    dispatch({ type: "ADD_SELECTED", payload: stagedFileNames });
                } else if (canPush) {
                    setStep(4);
                } else if (st.isEmpty) {
                    setNeedsInitialPush(true);
                    setStep(1);
                } else if (step > 2) {
                    setStep(1);
                }
            })
            .catch((err) => {
                console.error("상태 확인: 프로젝트 정보를 가져오는데 실패했습니다:", err);
                setNeedsInitialPush(true);
                setStep(1);
                setBranches(["main"]);
            });
    }, [repoId, dispatch, selBranch, state.graphVersion]);

    const fail = (e, fb) => setToast(e?.message || fb || "오류가 발생했어요.");

    const guard = (targetStep, fn) => {
        if (!repoId) return setToast("프로젝트 저장 공간을 먼저 선택해주세요.");

        const isInitialPushAddClick = needsInitialPush && step === 1 && targetStep === 2;

        if (step !== targetStep && !isInitialPushAddClick) {
            setToast(`먼저 "${STEP_LABEL[step]}" 단계를 진행해주세요!`);
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

            const pushTransfer = findMissingCommits(graph, branchName, "push");
            if (pushTransfer._diverged && transfer.length > 0) {
                const behind = transfer.length;
                const ahead = pushTransfer.length;

                if (!window.confirm(
                    `⚠️ 주의: 로컬과 원격 브랜치가 분기되었습니다.\n\n` +
                    `로컬: ${ahead}개 커밋 앞섬 (아직 Push 안 됨)\n` +
                    `원격: ${behind}개 커밋 앞섬\n\n` +
                    `가져오기를 실행하면 로컬의 변경사항이 병합됩니다.\n` +
                    `(Hard Reset을 했다면 Reset이 취소됩니다!)\n\n` +
                    `그래도 가져오시겠습니까?`
                )) {
                    setBusy(false);
                    return;
                }
            }

            const pullResult = await api.repos.pull(repoId, {branch: branchName});
            if (pullResult?.hasConflict) {
                setToast("내용 겹침(충돌)이 발생했습니다! AI가 해결책을 제안합니다.");
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
                    setToast("서버에서 최신 내용을 가져왔어요.");
                    dispatch({type: "GRAPH_DIRTY"});
                }, 600);
            }
        } catch (e) {
            console.error("[ActionButtons] 가져오기 실패:", e);
            if (e.message?.includes("커밋되지 않은 변경사항") || e.message?.includes("Uncommitted Changes")) {
                setToast("아직 저장하지 않은 변경사항이 있습니다. 먼저 '파일 담기' 후 '현재 상태 저장'을 해주세요.");
                setStep(2);
                setOpenAdd(true);
            } else if (e?.status === 409 && e.message?.includes("empty or branch does not exist")) {
                setToast("서버 저장소가 비어있거나 선택한 작업 버전이 없습니다. '파일 담기'부터 시작해주세요!");
                setNeedsInitialPush(true);
                setStep(2);
            } else {
                fail(e, "서버에서 내용을 가져오는데 실패했어요.");
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
                setToast(`${stagedNames.length}개 파일을 다음 버전에 포함하도록 담았어요.`);
                dispatch({ type: "GRAPH_TICK" });
            } else {
                setToast("선택한 파일이 없거나 이미 담겨있습니다.");
            }
        } catch (e) {
            fail(e, "파일을 담는 데 실패했어요.");
        } finally {
            setBusy(false);
        }
    };

    const handleCommit = async () => {
        setCommitModalOpen(false);
        const text = msg.trim();
        if (!text) {
            setToast("변경 내용을 설명하는 메시지를 입력해야 합니다.");
            return;
        }
        setBusy(true);
        dispatch({ type: "SET_ANIMATION_START", payload: "commit" });

        try {
            await api.repos.commit(repoId, text);
            setMsg("");
            dispatch({ type: "COMMIT_SUCCESS", message: text });
            dispatch({ type: "GRAPH_TICK" });
            await new Promise(resolve => setTimeout(resolve, 600));
            setStep(4);
            if (needsInitialPush) setNeedsInitialPush(false);
        } catch (e) {
            fail(e, "변경 내용을 저장하는 데 실패했어요.");
            dispatch({ type: "SET_ANIMATION_END" });
        } finally {
            setBusy(false);
        }
    };

    const handlePush = async (branchName) => {
        setPushOpen(false);
        try {
            const graph = await api.repos.graph(repoId);
            const transfer = findMissingCommits(graph, selBranch, "push", branchName);

            const isDiverged = Boolean(transfer._diverged);
            if (isDiverged) {
                const behind = transfer._behind || 0;
                if (!window.confirm(
                    `⚠️ 경고: 원격 저장소가 로컬보다 ${behind}개의 커밋 앞서 있습니다.\n\n` +
                    `이 상태에서 Push하면 원격의 커밋이 삭제될 수 있습니다.\n` +
                    `일반적으로 먼저 "가져오기(Pull)"를 해야 합니다.\n\n` +
                    `그래도 강제로 Push하시겠습니까? (Force Push)`
                )) {
                    return;
                }
            }

            setCommitsToPush(transfer);
            setIsDivergedPush(isDiverged);
            setPushConfirmOpen(true);
        } catch (e) {
            if (
                e.message?.includes("리모트") ||
                e.message?.includes("No such device or address") ||
                e.message?.includes("Could not resolve host")
            ) {
                setToast("온라인 서버 주소를 먼저 연결해야 합니다.");
                setRetryPushBranch(branchName);
                setRemoteModalOpen(true);
            } else {
                fail(e, `${branchName} 버전 정보를 가져오는 중 오류가 발생했습니다.`);
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
            const pushPayload = {
                branch: branchName,
                force: isDivergedPush
            };

            await api.repos.push(repoId, pushPayload);

            setTimeout(() => {
                setStep(1);
                setToast("서버에 성공적으로 올렸어요.");
                dispatch({ type: "GRAPH_DIRTY" });
                setCommitsToPush([]);
                setBusy(false);
            }, 600);
        } catch (e) {
            dispatch({ type: "SET_ANIMATION_END" });
            if (e.message?.includes("does not exist on remote") || e.message?.includes("no upstream")) {
                if (window.confirm(`'${branchName}' 버전이 서버에 없습니다.\n서버에 새 버전으로 '${branchName}'을(를) 만들어 올릴까요? (처음 올리기)`)) {
                    try {
                        setBusy(true);
                        await api.repos.push(repoId, { branch: branchName, setUpstream: true });
                        setTimeout(() => {
                            setStep(1);
                            setToast(`'${branchName}' 버전을 서버에 새로 만들어 올렸습니다.`);
                            dispatch({ type: "GRAPH_DIRTY" });
                            setBusy(false);
                        }, 600);
                    } catch (pushErr) {
                        fail(pushErr, "버전을 서버에 새로 만들어 올리는 데 실패했습니다.");
                        setBusy(false);
                        setStep(1);
                    }
                } else {
                    setBusy(false);
                    setStep(1);
                }
            } else {
                fail(e, "서버에 올리는 데 실패했어요.");
                setBusy(false);
                setStep(1);
            }
            setCommitsToPush([]);
        }
    };

    const handleCreateBranch = async () => {
        setPullOpen(false);
        const newBranchName = prompt(`현재 '${selBranch}' 버전에서 시작하는 새 작업 버전의 이름을 입력하세요:`)?.trim();
        if (!newBranchName) return setToast("버전 이름이 올바르지 않습니다.");
        if (newBranchName.includes(" ")) return setToast("버전 이름에는 공백을 포함할 수 없습니다.");
        setBusy(true);
        try {
            await api.branches.create(repoId, { name: newBranchName, from: selBranch });
            setToast(`'${newBranchName}' 작업 버전을 만들었습니다!`);
            setBranches(prev => (prev.includes(newBranchName) ? prev : [...prev, newBranchName]).sort());
            dispatch({ type: "GRAPH_TICK" });
        } catch (e) {
            fail(e, "새 작업 버전을 만드는 데 실패했어요.");
        } finally {
            setBusy(false);
        }
    };

    const handleDeleteBranch = async (branchName) => {
        setPullOpen(false);
        if (branchName === "main") {
            setToast("'main' 기본 버전은 삭제할 수 없습니다.");
            return;
        }
        if (!window.confirm(`'${branchName}' 작업 버전을 정말로 삭제하시겠습니까?\n(서버에 있는 버전은 삭제되지 않습니다.)`)) {
            return;
        }
        setBusy(true);
        try {
            await api.branches.delete(repoId, branchName);
            setToast(`'${branchName}' 작업 버전을 삭제했습니다.`);
            setBranches(prev => prev.filter(b => b !== branchName));
            if (selBranch === branchName) {
                setSelBranch("main");
                await api.branches.switch(repoId, "main");
            }
            dispatch({ type: "GRAPH_TICK" });
        } catch (e) {
            fail(e, "작업 버전을 삭제하는 데 실패했어요.");
        } finally {
            setBusy(false);
        }
    };

    const lock1 = step !== 1 || busy;
    const lock2 = (step !== 2 && (step !== 1 || !needsInitialPush)) || busy;
    const lock3 = step !== 3 || busy;
    const lock4 = step !== 4 || !hasPushableCommits || busy;

    return (
        <>
            <div className="panel">
                <div className="controls">
                    {needsInitialPush && step === 1 ? (
                        <button
                            className="btn btn-success"
                            onClick={() => {
                                guard(2, () => {
                                    setStep(2);
                                    setToast("'파일 담기' 단계로 이동합니다.");
                                });
                            }}
                        >
                            시작하기 (파일 담기)
                        </button>
                    ) : (
                        <div className={`btn-split-wrap ${lock1 ? "locked" : ""}`}>
                            <button
                                className="btn btn-split-action"
                                onClick={() => guard(1, () => handlePull(selBranch))}
                                disabled={lock1}
                                title={`'${selBranch}' 버전의 최신 내용을 서버에서 가져옵니다.`}
                            >
                                {selBranch} 에서 가져오기
                            </button>
                            <button
                                className="btn btn-split-trigger"
                                onClick={() => guard(1, () => setPullOpen(!pullOpen))}
                                disabled={lock1}
                                title="가져올 작업 버전 선택"
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
                                                title={`'${b}' 버전 선택`}
                                            >
                                                {b}
                                            </button>
                                            {b !== "main" && (
                                                <button
                                                    className="combo-item-delete"
                                                    title={`'${b}' 작업 버전 삭제`}
                                                    onClick={() => handleDeleteBranch(b)}
                                                >
                                                    🗑️
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <div style={{ borderTop: "1px solid var(--line)", margin: "4px 0" }} />
                                    <button className="combo-item" onClick={handleCreateBranch} title="현재 버전에서 새 작업 버전 만들기">
                                        + 새 작업 버전 만들기...
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <button
                        className={`btn ${lock2 ? "btn-locked" : ""}`}
                        onClick={() => guard(2, () => setOpenAdd(true))}
                        disabled={lock2}
                        title="변경된 파일 중 다음 버전에 포함할 파일을 선택합니다."
                    >
                        파일 담기
                    </button>

                    <button
                        className={`btn btn-success ${lock3 ? "btn-locked" : ""}`}
                        onClick={() => guard(3, () => setCommitModalOpen(true))}
                        disabled={lock3}
                        title="담긴 파일들을 하나의 작업 단위로 저장합니다."
                    >
                        현재 상태 저장
                    </button>

                    <div className={`btn-split-wrap primary ${lock4 ? "locked" : ""}`}>
                        {(() => {
                            const twoBranches = Array.isArray(branches) && branches.length === 2;
                            const otherBranch = twoBranches ? branches.find((b) => b !== pushTargetBranch) : null;
                            return (
                                <>
                                    <button
                                        className="btn btn-primary btn-split-action"
                                        onClick={() => guard(4, () => handlePush(pushTargetBranch))}
                                        disabled={lock4}
                                        title={`'${pushTargetBranch}' 버전의 저장된 내용을 서버에 올립니다.`}
                                    >
                                        {pushTargetBranch} 으로 올리기
                                    </button>
                                    <button
                                        className="btn btn-primary btn-split-trigger"
                                        onClick={() => guard(4, () => {
                                            if (twoBranches && otherBranch) {
                                                setPushTargetBranch(otherBranch);
                                                setToast(`올릴 브랜치를 '${otherBranch}'(으)로 전환했어요.`);
                                            } else {
                                                setPushOpen(!pushOpen);
                                            }
                                        })}
                                        disabled={lock4}
                                        title={twoBranches ? "다른 브랜치로 전환" : "올릴 작업 버전 선택"}
                                    >
                                        ▼
                                    </button>
                                    {! (Array.isArray(branches) && branches.length === 2) && pushOpen && !lock4 && (
                                        <div className="combo-menu">
                                            {branches.map((b) => (
                                                <button
                                                    key={b}
                                                    className={`combo-item ${b === pushTargetBranch ? "active" : ""}`}
                                                    onClick={() => {
                                                        setPushTargetBranch(b);
                                                        setPushOpen(false);
                                                    }}
                                                    title={`'${b}' 버전으로 올리기 선택`}
                                                >
                                                    {b}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                </div>

                {actionHint && (
                    <div
                        style={{
                            marginTop: 10,
                            padding: "10px 12px",
                            background: "var(--panel-2)",
                            border: "1px solid var(--line)",
                            borderRadius: 8,
                            color: "var(--text)",
                        }}
                    >
                        {actionHint}
                    </div>
                )}

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
                    if (retryPushBranch) {
                        handlePush(retryPushBranch);
                        setRetryPushBranch(null);
                    }
                }}
            />

            <PushConfirmModal
                open={pushConfirmOpen}
                onClose={() => setPushConfirmOpen(false)}
                onConfirm={() => executePush(pushTargetBranch)}
                branch={pushTargetBranch}
                commits={commitsToPush}
                isDiverged={isDivergedPush}
            />

            <CommitConfirmModal
                open={commitModalOpen}
                onClose={() => setCommitModalOpen(false)}
                onConfirm={handleCommit}
                message={msg}
                onMessageChange={setMsg}
            />

        </>
    );
}