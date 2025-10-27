import React, { useEffect, useState } from "react";
import { useGit } from "../../features/GitCore/GitContext";
import { api } from "../../features/API";
import AddModal from "./AddModal";
import StagingSummary from "./StagingSummary";
import RemoteConnectModal from "../../components/Modal/RemoteConnectModal.jsx";
import PushConfirmModal from "../../components/Modal/PushConfirmModal";
import CommitConfirmModal from "../../components/Modal/CommitConfirmModal";

// 단계 라벨 수정
const STEP_LABEL = { 1: "서버에서 최신 내용 가져오기", 2: "변경된 파일 담기", 3: "변경 내용 설명 쓰고 저장", 4: "서버에 올리기" };

// --- Helper Functions ---
// (내부 로직 함수는 용어 변경 불필요)
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
    if (direction === "push") { // 서버에 올릴 커밋 찾기
        const base = rhashes[rhashes.length - 1];
        return base ? lb.slice(lhashes.lastIndexOf(base) + 1) : lb;
    } else { // 서버에서 가져올 커밋 찾기
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
    const [msg, setMsg] = useState(""); // '버전 저장' 메시지
    const [openAdd, setOpenAdd] = useState(false); // '파일 담기' 모달
    const [toast, setToast] = useState("");
    const [busy, setBusy] = useState(false);
    const [needsInitialPush, setNeedsInitialPush] = useState(false); // 처음 올리기 필요한지 여부
    const [branches, setBranches] = useState(["main"]); // 작업 버전 목록
    const [selBranch, setSelBranch] = useState("main"); // 선택된 작업 버전
    const [pullOpen, setPullOpen] = useState(false); // '가져오기' 메뉴
    const [pushOpen, setPushOpen] = useState(false); // '올리기' 메뉴
    const [remoteModalOpen, setRemoteModalOpen] = useState(false); // 서버 연결 모달
    const [retryPushBranch, setRetryPushBranch] = useState(null); // 올리기 재시도할 버전

    const [pushConfirmOpen, setPushConfirmOpen] = useState(false); // '올리기 확인' 모달
    const [commitsToPush, setCommitsToPush] = useState([]); // 서버에 올릴 기록 목록
    const [commitModalOpen, setCommitModalOpen] = useState(false); // '버전 저장 확인' 모달

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
            api.repos.status(repoId), // 현재 상태 확인
            api.repos.graph(repoId), // 기록 그래프 정보 가져오기
            api.branches.list(repoId) // 작업 버전 목록 가져오기
        ])
            .then(([st, graph, list]) => {
                const fetchedBranches = normalizeBranchList(list);
                setBranches(fetchedBranches);
                let currentBranch = selBranch;
                if (!fetchedBranches.includes(selBranch)) {
                    currentBranch = fetchedBranches[0] || "main";
                    setSelBranch(currentBranch);
                }
                setNeedsInitialPush(Boolean(st.isEmpty)); // 프로젝트가 비어있으면 처음 올리기 필요

                const stagedFiles = Array.isArray(st?.files) ? st.files : []; // '올릴 예정'인 파일 목록
                const localCommitsToPush = findMissingCommits(graph, currentBranch, "push"); // 서버에 없는 '저장된 기록'

                if (stagedFiles.length > 0) {
                    setStep(3); // '올릴 예정' 파일 있으면 -> 설명 쓰고 저장 단계
                    const stagedFileNames = stagedFiles.map(f => f.path || f.file || f.name || String(f));
                    dispatch({ type: "ADD_SELECTED", payload: stagedFileNames }); // UI에 반영
                } else if (localCommitsToPush.length > 0) {
                    setStep(4); // 서버에 없는 '저장된 기록' 있으면 -> 서버에 올리기 단계
                } else if (st.isEmpty) {
                    setStep(2); // 프로젝트가 비어있으면 -> 파일 담기 단계부터
                } else {
                    setStep(1); // 그 외 -> 서버에서 가져오기 단계부터
                }
            })
            .catch((err) => {
                console.error("상태 확인: 프로젝트 정보를 가져오는데 실패했습니다:", err);
                setNeedsInitialPush(true);
                setStep(1);
                api.branches.list(repoId) // 작업 버전 목록이라도 가져오기 시도
                    .then(list => {
                        const fetchedBranches = normalizeBranchList(list);
                        setBranches(fetchedBranches);
                    })
                    .catch(() => setBranches(["main"]));
            });
    }, [repoId, dispatch, selBranch, state.gitStatusCounter]); // 상태 변경 시 다시 확인

    // --- Handlers ---
    const fail = (e, fb) => setToast(e?.message || fb || "오류가 발생했어요.");

    const guard = (targetStep, fn) => {
        if (!repoId) return setToast("프로젝트 저장 공간을 먼저 선택해주세요.");
        if (step !== targetStep && !(needsInitialPush && targetStep === 2 && step === 1)) {
            // 현재 단계가 아니면 안내 메시지 표시
            setToast(`먼저 “${STEP_LABEL[step]}” 단계를 진행해주세요!`);
            return;
        }
        if (busy) return; // 작업 중이면 중복 실행 방지
        fn();
    };

    // '서버에서 가져오기' 처리
    const handlePull = async (branchName) => {
        setBusy(true);
        setPullOpen(false);
        try {
            await api.branches.switch(repoId, branchName); // 해당 작업 버전으로 이동
            const graph = await api.repos.graph(repoId);
            const transfer = findMissingCommits(graph, branchName, "pull"); // 가져올 기록 찾기

            const pullResult = await api.repos.pull(repoId, {branch: branchName}); // 실제 가져오기 실행
            if (pullResult?.hasConflict) {
                setToast("내용 겹침(충돌)이 발생했습니다! AI가 해결책을 제안합니다.");
                dispatch({type: "OPEN_CONFLICT_MODAL"}); // 충돌 해결 모달 열기 (가정)
            } else {
                if (transfer.length > 0) {
                    // 가져온 내용 애니메이션 표시 (가정)
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
                    setStep(2); // 다음 단계: 파일 담기
                    setToast("서버에서 최신 내용을 가져왔어요.");
                    dispatch({type: "GRAPH_DIRTY"}); // 그래프 새로고침 (가정)
                }, 600);
            }
        } catch (e) {
            console.error("[ActionButtons] 가져오기 실패:", e);
            if (e.message?.includes("커밋되지 않은 변경사항") || e.message?.includes("Uncommitted Changes")) {
                setToast("아직 저장하지 않은 변경사항이 있습니다. 먼저 '파일 담기' 후 '버전 저장'을 해주세요.");
                setStep(2); // '파일 담기' 단계로 이동
                setOpenAdd(true); // '파일 담기' 모달 자동 열기
            } else if (e?.status === 409 && e.message?.includes("empty or branch does not exist")) {
                setToast("서버 저장소가 비어있거나 선택한 작업 버전이 없습니다. '파일 담기'부터 시작해주세요!");
                setNeedsInitialPush(true); // 처음 올리기 필요
                setStep(2);
            } else {
                fail(e, "서버에서 내용을 가져오는데 실패했어요.");
            }
            dispatch({type: "SET_ANIMATION_END"}); // 애니메이션 중지 (가정)
        } finally {
            setBusy(false);
        }
    }

    // '파일 담기' 확인 처리
    const handleAddConfirm = async (selection) => {
        setOpenAdd(false);
        if (!selection || selection.length === 0) return; // 선택된 파일 없으면 종료

        setBusy(true);
        try {
            // 파일을 서버에 업로드 (필요하다면)
            const uploadResult = await api.repos.upload(repoId, selection);
            const uploadedFileNames = Array.isArray(uploadResult?.saved) ? uploadResult.saved : [];

            // '담기'(git add) 실행
            if (uploadedFileNames.length > 0) {
                await api.repos.add(repoId, uploadedFileNames);
            }
            const stagedNames = uploadedFileNames; // '담긴' 파일 이름 목록

            if (stagedNames.length > 0) {
                dispatch({ type: "ADD_SELECTED", payload: stagedNames }); // UI에 '담긴 목록' 업데이트 (가정)
                dispatch({ type: "SET_ANIMATION_START", payload: "add" }); // 애니메이션 시작 (가정)
                setStep(3); // 다음 단계: 설명 쓰고 저장
                setToast(`${stagedNames.length}개 파일을 다음 버전에 포함하도록 담았어요.`);
                dispatch({ type: "GRAPH_TICK" }); // 상태 변경 알림 (가정)
            } else {
                setToast("선택한 파일이 없거나 이미 담겨있습니다."); // 실패 또는 이미 처리된 경우 메시지 개선
            }
        } catch (e) {
            fail(e, "파일을 담는 데 실패했어요.");
        } finally {
            setBusy(false);
        }
    };

    // '버전 저장'(Commit) 처리
    const handleCommit = async () => {
        setCommitModalOpen(false);
        const text = msg.trim(); // 저장 메시지
        if (!text) {
            setToast("변경 내용을 설명하는 메시지를 입력해야 합니다.");
            return;
        }
        setBusy(true);
        dispatch({ type: "SET_ANIMATION_START", payload: "commit" }); // 애니메이션 시작 (가정)

        try {
            await api.repos.commit(repoId, text); // 실제 저장 실행
            setMsg(""); // 메시지 입력칸 비우기
            dispatch({ type: "COMMIT_SUCCESS", message: text }); // 성공 상태 업데이트 (가정)
            dispatch({ type: "GRAPH_TICK" }); // 상태 변경 알림
            await new Promise(resolve => setTimeout(resolve, 600)); // 애니메이션 시간 대기
            setStep(4); // 다음 단계: 서버에 올리기
            if (needsInitialPush) setNeedsInitialPush(false); // 처음 올리기 상태 해제
        } catch (e) {
            fail(e, "변경 내용을 저장하는 데 실패했어요.");
            dispatch({ type: "SET_ANIMATION_END" }); // 애니메이션 중지
        } finally {
            setBusy(false);
        }
    };

    // '서버에 올리기' 버튼 클릭 시 (확인 모달 열기 전)
    const handlePush = async (branchName) => {
        setPushOpen(false);
        try {
            await api.branches.switch(repoId, branchName); // 해당 작업 버전으로 이동
            const graph = await api.repos.graph(repoId);
            const transfer = findMissingCommits(graph, branchName, "push"); // 올릴 기록 찾기
            setCommitsToPush(transfer); // 올릴 내용 상태에 저장
            setPushConfirmOpen(true); // '올리기 확인' 모달 열기
        } catch (e) {
            // 서버 주소 연결 안 된 경우
            if (
                e.message?.includes("리모트") || // '리모트' 관련 에러
                e.message?.includes("No such device or address") ||
                e.message?.includes("Could not resolve host")
            ) {
                setToast("온라인 서버 주소를 먼저 연결해야 합니다.");
                setRetryPushBranch(branchName); // 연결 후 이 버전으로 올리기 시도
                setRemoteModalOpen(true); // 서버 연결 모달 열기
            } else {
                fail(e, `${branchName} 버전 정보를 가져오는 중 오류가 발생했습니다.`);
            }
        }
    };

    // '올리기 확인' 모달에서 확인 눌렀을 때 실제 '서버에 올리기' 실행
    const executePush = async (branchName) => {
        setPushConfirmOpen(false);
        setBusy(true);
        dispatch({ type: "SET_ANIMATION_START", payload: "push" }); // 애니메이션 시작

        // 올릴 내용 애니메이션 정보 설정 (가정)
        const payload = {
            type: "push",
            branch: branchName,
            commits: commitsToPush,
            files: summarizeFiles(commitsToPush)
        };
        dispatch({ type: "SET_TRANSFER", payload });

        try {
            await api.repos.push(repoId, { branch: branchName }); // 실제 올리기 실행

            setTimeout(() => {
                setStep(1); // 완료 후 첫 단계로 돌아감
                setToast("서버에 성공적으로 올렸어요.");
                dispatch({ type: "GRAPH_DIRTY" }); // 그래프 새로고침
                setCommitsToPush([]); // 올릴 내용 비우기
                setBusy(false);
            }, 600);
        } catch (e) {
            dispatch({ type: "SET_ANIMATION_END" }); // 애니메이션 중지
            // 서버에 해당 버전이 없는 경우 (처음 올리는 경우)
            if (e.message?.includes("does not exist on remote") || e.message?.includes("no upstream")) {
                if (window.confirm(`'${branchName}' 버전이 서버에 없습니다.\n서버에 새 버전으로 '${branchName}'을(를) 만들어 올릴까요? (처음 올리기)`)) {
                    try {
                        setBusy(true);
                        // 서버에 새 브랜치 만들면서 올리기 옵션 추가
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
                    }
                } else {
                    setBusy(false); // 사용자가 취소
                }
            } else {
                fail(e, "서버에 올리는 데 실패했어요.");
                setBusy(false);
            }
            setCommitsToPush([]); // 실패 시에도 올릴 내용 비우기
        }
    };

    // '새 작업 버전 만들기' 처리
    const handleCreateBranch = async () => {
        setPullOpen(false);
        const newBranchName = prompt(`현재 '${selBranch}' 버전에서 시작하는 새 작업 버전의 이름을 입력하세요:`)?.trim();
        if (!newBranchName) return setToast("버전 이름이 올바르지 않습니다.");
        if (newBranchName.includes(" ")) return setToast("버전 이름에는 공백을 포함할 수 없습니다."); // 간단한 유효성 검사 추가
        setBusy(true);
        try {
            await api.branches.create(repoId, { name: newBranchName, from: selBranch });
            setToast(`'${newBranchName}' 작업 버전을 만들었습니다!`);
            setBranches(prev => (prev.includes(newBranchName) ? prev : [...prev, newBranchName]).sort());
            dispatch({ type: "GRAPH_TICK" }); // 상태 변경 알림
        } catch (e) {
            fail(e, "새 작업 버전을 만드는 데 실패했어요.");
        } finally {
            setBusy(false);
        }
    };

    // '작업 버전 삭제' 처리
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
                // 삭제된 버전을 보고 있었다면 'main'으로 이동
                setSelBranch("main");
                await api.branches.switch(repoId, "main");
            }
            dispatch({ type: "GRAPH_TICK" }); // 상태 변경 알림
        } catch (e) {
            fail(e, "작업 버전을 삭제하는 데 실패했어요.");
        } finally {
            setBusy(false);
        }
    };

    // --- Button Locks ---
    // 각 단계별 버튼 활성화/비활성화 로직
    const lock1 = step !== 1 || busy; // 가져오기 버튼
    const lock2 = step !== 2 || busy; // 파일 담기 버튼
    const lock3 = step !== 3 || busy; // 버전 저장 버튼
    const lock4 = step !== 4 || busy; // 올리기 버튼

    // --- Render ---
    return (
        <>
            <div className="panel">
                {/* 컨트롤 버튼 영역 */}
                <div className="controls">
                    {/* 처음 올리기 필요 시, '가져오기' 대신 '시작' 버튼 표시 */}
                    {needsInitialPush && step === 1 ? (
                        <button
                            className="btn btn-success"
                            onClick={() => {
                                setStep(2);
                                setToast("'파일 담기' 단계로 이동합니다.");
                            }}
                        >
                            시작하기 (파일 담기)
                        </button>
                    ) : (
                        // '가져오기' 버튼 (버전 선택 포함)
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
                            {/* 버전 선택 메뉴 */}
                            {pullOpen && !lock1 && (
                                <div className="combo-menu">
                                    {branches.map((b) => (
                                        <div key={b} className="combo-item-wrap">
                                            <button
                                                className={`combo-item ${b === selBranch ? "active" : ""}`}
                                                onClick={() => {
                                                    setSelBranch(b); // 선택한 버전으로 상태 변경
                                                    setPullOpen(false);
                                                }}
                                                title={`'${b}' 버전 선택`}
                                            >
                                                {b}
                                            </button>
                                            {/* 'main' 외 버전 삭제 버튼 */}
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

                    {/* '파일 담기' 버튼 */}
                    <button
                        className={`btn ${lock2 ? "btn-locked" : ""}`}
                        onClick={() => guard(2, () => setOpenAdd(true))}
                        disabled={lock2}
                        title="변경된 파일 중 다음 버전에 포함할 파일을 선택합니다."
                    >
                        파일 담기
                    </button>

                    {/* '버전 저장' 버튼 */}
                    <button
                        className={`btn btn-success ${lock3 ? "btn-locked" : ""}`}
                        onClick={() => guard(3, () => setCommitModalOpen(true))}
                        disabled={lock3}
                        title="담긴 파일들을 하나의 작업 단위로 저장합니다."
                    >
                        버전 저장
                    </button>

                    {/* '서버에 올리기' 버튼 (버전 선택 포함) */}
                    <div className={`btn-split-wrap primary ${lock4 ? "locked" : ""}`}>
                        <button
                            className="btn btn-primary btn-split-action"
                            onClick={() => guard(4, () => handlePush(selBranch))}
                            disabled={lock4}
                            title={`'${selBranch}' 버전의 저장된 내용을 서버에 올립니다.`}
                        >
                            {selBranch} 으로 올리기
                        </button>
                        <button
                            className="btn btn-primary btn-split-trigger"
                            onClick={() => guard(4, () => setPushOpen(!pushOpen))}
                            disabled={lock4}
                            title="올릴 작업 버전 선택"
                        >
                            ▼
                        </button>
                        {/* 버전 선택 메뉴 */}
                        {pushOpen && !lock4 && (
                            <div className="combo-menu">
                                {branches.map((b) => (
                                    <button
                                        key={b}
                                        className={`combo-item ${b === selBranch ? "active" : ""}`}
                                        onClick={() => {
                                            setSelBranch(b); // 선택한 버전으로 상태 변경
                                            setPushOpen(false);
                                        }}
                                        title={`'${b}' 버전으로 올리기 선택`}
                                    >
                                        {b}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* '담긴 파일 목록' 요약 표시 (StagingSummary 컴포넌트 사용) */}
                <StagingSummary
                    files={state.stagingArea} // '담긴 파일' 상태 (useGit에서 관리)
                    onRemove={(name) => dispatch({ type: "REMOVE_FROM_STAGING", payload: name })} // 파일 제거 액션 (useGit에서 관리)
                />
            </div>

            {/* 모달 컴포넌트들 */}
            <AddModal
                open={openAdd}
                onCancel={() => setOpenAdd(false)}
                onConfirm={handleAddConfirm}
            />

            <RemoteConnectModal // 서버 주소 연결 모달
                open={remoteModalOpen}
                repoId={repoId}
                onClose={() => setRemoteModalOpen(false)}
                onConnected={() => {
                    setRemoteModalOpen(false);
                    // 연결 성공 후 중단되었던 '올리기' 재시도
                    if (retryPushBranch) {
                        handlePush(retryPushBranch);
                        setRetryPushBranch(null); // 재시도 상태 초기화
                    }
                }}
            />

            <PushConfirmModal // '서버에 올리기' 확인 모달
                open={pushConfirmOpen}
                onClose={() => setPushConfirmOpen(false)}
                onConfirm={() => executePush(selBranch)} // 확인 시 실제 올리기 실행
                branch={selBranch} // 올릴 버전 이름 전달
                commits={commitsToPush} // 올릴 기록 목록 전달
            />

            <CommitConfirmModal // '버전 저장' 확인 모달
                open={commitModalOpen}
                onClose={() => setCommitModalOpen(false)}
                onConfirm={handleCommit} // 확인 시 실제 저장 실행
                message={msg} // 메시지 상태 전달
                onMessageChange={setMsg} // 메시지 변경 핸들러 전달
            />

            {/* 토스트 메시지 */}
            {toast && (
                <div
                    // 토스트 스타일 (간략화)
                    style={{ position: "fixed", bottom: "20px", left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.8)", color: "white", padding: "12px 24px", borderRadius: "8px", zIndex: 1000, display: "flex", alignItems: "center" }}
                >
                    {toast}
                    <button
                        onClick={() => setToast("")}
                        style={{ marginLeft: "15px", background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: "16px", fontWeight: "bold" }}
                        title="닫기"
                    >
                        ×
                    </button>
                </div>
            )}
        </>
    );
}