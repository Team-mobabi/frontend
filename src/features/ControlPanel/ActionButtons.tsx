import { useEffect, useState } from "react";
import { useGit } from "../../features/GitCore/GitContext";
import { api, ApiError, errorMessage } from "../../lib/api";
import { createLogger } from "../../lib/logger";
import { statusFilePaths } from "../../lib/statusFiles";
import type { GraphCommit } from "../../types/api";
import type { TransferSnapshot, WorkflowStep } from "../../types/git";
import { useToast } from "../../components/Toast/ToastProvider";
import AddModal from "./AddModal";
import StagingSummary from "./StagingSummary";
import BranchSplitButton from "./BranchSplitButton";
import StepTooltip from "./StepTooltip";
import ProcessToolbar from "./ProcessToolbar";
import { confirmDivergedPull, confirmForcePush, findMissingCommits, normalizeBranchList, summarizeFiles } from "./gitTransfer";
import { confirmUploadSelection, uploadInBatches } from "./uploadFiles";
import ProcessGuidePanel from "./ProcessGuidePanel";
import { useBranchActions } from "./useBranchActions";
import { useWorkflowGuide } from "../Workflow/useWorkflowGuide";
import { STEP_BUTTON_IDS, STEP_LABELS, stepNumOf } from "../Workflow/workflowSteps";
import RemoteConnectModal from "../../components/Modal/RemoteConnectModal";
import PushConfirmModal from "../../components/Modal/PushConfirmModal";
import CommitConfirmModal from "../../components/Modal/CommitConfirmModal";
import AIWorkflowSuggestionModal from "../../components/Modal/AIWorkflowSuggestionModal";
import AIChatAssistantModal from "../../components/Modal/AIChatAssistantModal";

const log = createLogger("ActionButtons");

const SAVED_MESSAGE = "변경사항이 저장되었습니다! 다음 작업을 선택해주세요.";

const aiTitle = (suggested: boolean, title: string) => (suggested ? `🤖 AI 추천: ${title}` : title);

export default function ActionButtons() {
    const { state, dispatch } = useGit();
    const toast = useToast();
    const wf = useWorkflowGuide();
    const { step, setStep } = wf;
    const repoId = state.selectedRepoId;

    const [msg, setMsg] = useState(""); // '버전 저장' 메시지
    const [openAdd, setOpenAdd] = useState(false); // '파일 담기' 모달
    const [busy, setBusy] = useState(false); // 작업 중에는 단계 버튼 비활성화
    const [needsInitialPush, setNeedsInitialPush] = useState(false); // 처음 올리기 필요한지 여부
    const [pullOpen, setPullOpen] = useState(false); // '가져오기' 메뉴
    const [pushOpen, setPushOpen] = useState(false); // '올리기' 메뉴
    const [remoteModalOpen, setRemoteModalOpen] = useState(false); // 서버 연결 모달
    const [retryPushBranch, setRetryPushBranch] = useState<string | null>(null); // 올리기 재시도할 버전

    const [pushConfirmOpen, setPushConfirmOpen] = useState(false); // '올리기 확인' 모달
    const [commitsToPush, setCommitsToPush] = useState<GraphCommit[]>([]); // 서버에 올릴 기록 목록
    const [isDivergedPush, setIsDivergedPush] = useState(false); // Force push 필요 여부
    const [commitModalOpen, setCommitModalOpen] = useState(false); // '버전 저장 확인' 모달
    const [hasPushableCommits, setHasPushableCommits] = useState(false); // Push 가능한 커밋 존재 여부
    const [showAIWorkflowModal, setShowAIWorkflowModal] = useState(false); // AI 워크플로우 모달
    const [showAIChatModal, setShowAIChatModal] = useState(false); // AI 챗봇 모달
    const [isAddingFiles, setIsAddingFiles] = useState(false);
    const { branches, setBranches, selBranch, setSelBranch, createBranch, deleteBranch } = useBranchActions({
        repoId,
        setBusy,
        onBeforeAction: () => setPullOpen(false),
    });

    // 스테이징 영역이 비면 워크플로우 리셋 (단, 파일을 담는 중이 아닐 때만)
    useEffect(() => {
        // 파일을 담았다가 모두 삭제한 경우 워크플로우 리셋
        const hadStagedFiles = wf.steps.includes("add") || wf.steps.includes("commit");
        if (state.stagingArea && state.stagingArea.length === 0 && hadStagedFiles && !isAddingFiles) {
            wf.reset("스테이징 영역이 비어 워크플로우를 리셋했습니다.");
        }
    }, [state.stagingArea?.length, wf.steps.length, isAddingFiles]);

    useEffect(() => {
        if (repoId) {
            setMsg("");
            setPullOpen(false);
            setPushOpen(false);
        }
    }, [repoId]);

    // 저장소 상태 / 그래프 / 브랜치 목록으로 현재 단계를 판단한다
    useEffect(() => {
        if (!repoId) return;
        let cancelled = false;

        Promise.all([api.repos.status(repoId), api.repos.graph(repoId), api.branches.list(repoId)])
            .then(([st, graph, list]) => {
                if (cancelled) return;

                const fetchedBranches = normalizeBranchList(list);
                setBranches(fetchedBranches);
                let currentBranch = selBranch;
                if (!fetchedBranches.includes(selBranch)) {
                    currentBranch = fetchedBranches[0] || "main";
                    setSelBranch(currentBranch);
                }
                setNeedsInitialPush(Boolean(st.isEmpty)); // 프로젝트가 비어있으면 처음 올리기 필요

                const stagedFileNames = statusFilePaths(st) ?? []; // '올릴 예정'인 파일 목록
                const localCommitsToPush = findMissingCommits(graph, currentBranch, "push"); // 서버에 없는 '저장된 기록'

                // 현재 브랜치가 remote에 없는지 확인 (새로 만든 브랜치인지)
                const isNewLocalBranch = !(graph?.remote?.branches || {})[currentBranch];

                // Push 가능 여부 판단 (diverged 상태여도 Force Push 가능)
                setHasPushableCommits(localCommitsToPush.length > 0 || Boolean(localCommitsToPush._diverged));

                if (stagedFileNames.length > 0) {
                    setStep(3); // '올릴 예정' 파일 있으면 -> 설명 쓰고 저장 단계
                    // 현재 stagingArea와 비교하여 변경된 경우에만 dispatch
                    const currentStaged = state.stagingArea || [];
                    const isDifferent =
                        stagedFileNames.length !== currentStaged.length || !stagedFileNames.every((name) => currentStaged.includes(name));
                    if (isDifferent) dispatch({ type: "ADD_SELECTED", payload: stagedFileNames });
                } else if (localCommitsToPush.length > 0 && !isNewLocalBranch) {
                    setStep(4);
                } else if (st.isEmpty) {
                    setStep(4);
                } else {
                    setStep(1);
                }
            })
            .catch((err) => {
                if (cancelled) return;
                log.error("상태 확인: 프로젝트 정보를 가져오는데 실패했습니다:", err);
                setNeedsInitialPush(true);
                setStep(1);
                api.branches
                    .list(repoId) // 작업 버전 목록이라도 가져오기 시도
                    .then((list) => {
                        if (!cancelled) setBranches(normalizeBranchList(list));
                    })
                    .catch(() => {
                        if (!cancelled) setBranches(["main"]);
                    });
            });

        return () => {
            cancelled = true;
        };
    }, [repoId, selBranch, state.graphVersion]); // gitStatusCounter 대신 graphVersion 사용

    // --- Handlers ---
    const fail = (e: unknown, fb?: string) => toast.show(errorMessage(e, fb || "오류가 발생했어요."), "error");

    const openPrCreate = () => {
        dispatch({ type: "SET_VIEW", payload: "prs" });
        dispatch({ type: "OPEN_PR_CREATE_MODAL" }); // PR 생성 모달 자동 열기
    };

    // '서버에서 가져오기' 처리
    const handlePull = async (branchName: string) => {
        if (!repoId) return;
        setBusy(true);
        setPullOpen(false);
        try {
            await api.branches.switch(repoId, branchName); // 해당 작업 버전으로 이동
            const graph = await api.repos.graph(repoId);
            const transfer = findMissingCommits(graph, branchName, "pull"); // 가져올 기록 찾기

            // Diverged 상태 확인 (Local이 뒤처져 있고, Remote가 앞서 있는지)
            const pushTransfer = findMissingCommits(graph, branchName, "push");
            if (pushTransfer._diverged && transfer.length > 0 && !confirmDivergedPull(pushTransfer.length, transfer.length)) {
                return;
            }

            const pullResult = await api.repos.pull(repoId, { branch: branchName }); // 실제 가져오기 실행
            if (pullResult?.hasConflict) {
                toast.show("내용 겹침(충돌)이 발생했습니다! AI가 해결책을 제안합니다.", "error");
                dispatch({ type: "OPEN_CONFLICT_MODAL" });
                return;
            }
            if (transfer.length > 0) {
                // 가져온 내용 애니메이션 표시
                const payload: TransferSnapshot = { type: "pull", branch: branchName, commits: transfer, files: summarizeFiles(transfer) };
                dispatch({ type: "SET_TRANSFER", payload });
                dispatch({ type: "SET_ANIMATION_START", payload: "pull" });
            }
            setTimeout(() => {
                // 워크플로우 추천이 있으면 다음 단계로 이동
                const plan = wf.advance("pull");
                if (plan.kind === "none") {
                    setStep(2); // 다음 단계: 파일 담기
                } else if (plan.kind === "done") {
                    wf.complete();
                } else if (plan.nextNum) {
                    setStep(plan.nextNum);
                    wf.announceNext(plan.afterNext);
                }
                dispatch({ type: "GRAPH_DIRTY" });
            }, 600);
        } catch (e) {
            log.error("가져오기 실패:", e);
            const message = errorMessage(e, "");
            if (message.includes("커밋되지 않은 변경사항") || message.includes("Uncommitted Changes")) {
                toast.show("아직 저장하지 않은 변경사항이 있습니다. 먼저 '파일 담기' 후 '버전 저장'을 해주세요.", "error");
                setStep(2); // '파일 담기' 단계로 이동
                setOpenAdd(true); // '파일 담기' 모달 자동 열기
            } else if (e instanceof ApiError && e.status === 409 && message.includes("empty or branch does not exist")) {
                toast.show("서버 저장소가 비어있거나 선택한 작업 버전이 없습니다. '파일 담기'부터 시작해주세요!", "info");
                setNeedsInitialPush(true); // 처음 올리기 필요
                setStep(2);
            } else {
                fail(e, "서버에서 내용을 가져오는데 실패했어요.");
            }
            dispatch({ type: "SET_ANIMATION_END" });
        } finally {
            setBusy(false);
        }
    };

    // '파일 담기' 확인 처리
    const handleAddConfirm = async (picked: File[]) => {
        setOpenAdd(false);
        if (!repoId) return;

        const selection = confirmUploadSelection(picked); // 크기 검사 (취소 시 null)
        if (!selection) return;

        setIsAddingFiles(true);
        setBusy(true);
        try {
            const uploadedFileNames = await uploadInBatches(repoId, selection, (m) => toast.show(m, "info"));

            // '담기'(git add) 실행
            if (uploadedFileNames.length > 0) await api.repos.add(repoId, uploadedFileNames);

            // 서버의 실제 상태를 가져와서 스테이징 영역 동기화 (삭제된 파일 제외)
            const status = await api.repos.status(repoId);
            const stagedFileNames = statusFilePaths(status) ?? uploadedFileNames;
            if (stagedFileNames.length === 0) return;

            dispatch({ type: "SET_STAGING_AREA", payload: stagedFileNames });
            dispatch({ type: "SET_ANIMATION_START", payload: "add" });
            dispatch({ type: "GRAPH_DIRTY" }); // StagedDiffView가 업데이트되도록
            toast.show(`${uploadedFileNames.length}개 파일이 성공적으로 담겼습니다.`, "success");

            const plan = wf.advance("add");
            if (plan.kind === "none") {
                setTimeout(() => setStep(3), 100); // 다음 단계: 설명 쓰고 저장
            } else if (plan.kind === "done") {
                wf.complete();
            } else if (plan.nextNum && (plan.next === "commit" || plan.next === "push")) {
                const { next, nextNum } = plan;
                // 약간의 지연을 두고 step 변경 (하이라이팅이 업데이트되도록)
                setTimeout(() => {
                    setStep(nextNum);
                    // Commit 단계면 자동으로 모달 열기
                    if (next === "commit") setTimeout(() => setCommitModalOpen(true), 300);
                }, 100);
                wf.announceNext(plan.afterNext);
            }
        } catch (e) {
            log.error("파일 업로드 실패:", e);
            if (e instanceof ApiError && e.status === 413) {
                fail(e, "파일 크기가 너무 큽니다. 더 작은 파일들을 선택하거나 서버 설정을 확인해주세요.");
            } else {
                fail(e, "파일을 담는 데 실패했어요.");
            }
        } finally {
            setBusy(false);
            // 파일 담기 완료 후 약간의 지연을 두고 플래그 해제
            setTimeout(() => setIsAddingFiles(false), 1000);
        }
    };

    // '버전 저장'(Commit) 처리
    const handleCommit = async () => {
        setCommitModalOpen(false);
        if (!repoId) return;
        const text = msg.trim() || "변경사항 저장"; // 저장 메시지 (없으면 기본값 사용)
        setBusy(true);
        dispatch({ type: "SET_ANIMATION_START", payload: "commit" });

        try {
            await api.repos.commit(repoId, text);
            setMsg("");
            dispatch({ type: "COMMIT_SUCCESS", message: text });
            dispatch({ type: "GRAPH_TICK" });
            setHasPushableCommits(true);

            await new Promise((resolve) => setTimeout(resolve, 600)); // 애니메이션 시간 대기

            const plan = wf.advance("commit");
            if (plan.kind === "none") {
                // 워크플로우가 없으면 스텝만 돌아가기
                setTimeout(() => {
                    setStep(1);
                    wf.notice.show(SAVED_MESSAGE, "info");
                }, 800);
            } else if (plan.kind === "done") {
                // commit이 마지막 단계: "만 저장" 워크플로우면 저장 안내와 함께 리셋
                if (wf.isOnlySave) setTimeout(() => wf.reset(SAVED_MESSAGE), 800);
                else wf.complete();
            } else if (plan.next === "push") {
                setStep(4);
                setTimeout(() => handlePush(selBranch), 300); // Push 단계면 자동으로 진행
                wf.announceNext(plan.afterNext);
            } else if (plan.next === "pr") {
                // PR로 이동하고 워크플로우 유지
                setTimeout(openPrCreate, 300);
                wf.notice.show("이제 변경 요청을 만들어주세요. 위의 '+ 새 변경 요청' 버튼을 클릭하세요.", "info");
            }
            if (needsInitialPush) setNeedsInitialPush(false);
        } catch (e) {
            fail(e, "변경 내용을 저장하는 데 실패했어요.");
            dispatch({ type: "SET_ANIMATION_END" });
        } finally {
            setBusy(false);
        }
    };

    // '서버에 올리기' 버튼 클릭 시 (확인 모달 열기 전)
    const handlePush = async (branchName: string) => {
        setPushOpen(false);
        if (!repoId) return;
        try {
            await api.branches.switch(repoId, branchName);
            const graph = await api.repos.graph(repoId);
            const transfer = findMissingCommits(graph, branchName, "push");

            const isDiverged = Boolean(transfer._diverged);
            if (isDiverged && !confirmForcePush(transfer._behind || 0)) return;

            // _diverged 같은 부가 속성 없이 커밋만 남긴다
            setCommitsToPush(transfer.filter((c) => c && typeof c === "object" && c.hash));
            setIsDivergedPush(isDiverged);
            setPushConfirmOpen(true);
        } catch (e) {
            const message = errorMessage(e, "");
            // 서버 주소 연결 안 된 경우
            if (message.includes("리모트") || message.includes("No such device or address") || message.includes("Could not resolve host")) {
                toast.show("온라인 서버 주소를 먼저 연결해야 합니다.", "info");
                setRetryPushBranch(branchName); // 연결 후 이 버전으로 올리기 시도
                setRemoteModalOpen(true);
            } else {
                fail(e, `${branchName} 버전 정보를 가져오는 중 오류가 발생했습니다.`);
            }
        }
    };

    // push 후 공통 정리
    const finishPush = () => {
        dispatch({ type: "GRAPH_DIRTY" });
        setCommitsToPush([]);
        setHasPushableCommits(false);
        setBusy(false);
    };

    // '올리기 확인' 모달에서 확인 눌렀을 때 실제 '서버에 올리기' 실행
    const executePush = async (branchName: string) => {
        setPushConfirmOpen(false);
        if (!repoId) return;
        setBusy(true);
        dispatch({ type: "SET_ANIMATION_START", payload: "push" });
        const payload: TransferSnapshot = { type: "push", branch: branchName, commits: commitsToPush, files: summarizeFiles(commitsToPush) };
        dispatch({ type: "SET_TRANSFER", payload });

        try {
            await api.repos.push(repoId, { branch: branchName, force: isDivergedPush });

            setTimeout(() => {
                const plan = wf.advance("push");
                if (plan.kind === "next" && plan.next === "pr") {
                    // PR로 이동하고 워크플로우 유지 (step은 그대로)
                    finishPush();
                    setTimeout(openPrCreate, 500);
                    return;
                }
                if (plan.kind === "done") wf.complete();
                else if (plan.kind === "none") setStep(1); // 완료 후 첫 단계로 돌아감
                finishPush();
            }, 600);
        } catch (e) {
            dispatch({ type: "SET_ANIMATION_END" });
            const message = errorMessage(e, "");
            // 서버에 해당 버전이 없는 경우 (처음 올리는 경우)
            if (message.includes("does not exist on remote") || message.includes("no upstream")) {
                if (window.confirm(`'${branchName}' 버전이 서버에 없습니다.\n서버에 새 버전으로 '${branchName}'을(를) 만들어 올릴까요? (처음 올리기)`)) {
                    try {
                        await api.repos.push(repoId, { branch: branchName, setUpstream: true });
                        setTimeout(() => {
                            setStep(1);
                            toast.show(`'${branchName}' 버전을 서버에 새로 만들어 올렸습니다.`, "success");
                            dispatch({ type: "GRAPH_DIRTY" });
                            setHasPushableCommits(false);
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

    // AI 워크플로우 추천 적용
    const handleWorkflowSuggested = (workflowSteps: WorkflowStep[]) => {
        log.debug("워크플로우 추천 수신:", workflowSteps);
        wf.start(workflowSteps);
        if (workflowSteps.length === 0) return;

        const [first, second] = workflowSteps;
        const firstNum = stepNumOf(first);
        if (firstNum) {
            setStep(firstNum);
            if (first === "add") setOpenAdd(true); // 파일 담기 단계면 자동으로 모달 열기

            let guideMessage = `🤖 현재 단계: ${STEP_LABELS[first]}\n\n`;
            if (second) guideMessage += `다음 단계: ${STEP_LABELS[second]}\n\n`;
            guideMessage += "위의 버튼을 클릭하여 진행하세요. 현재 단계가 강조 표시됩니다.";
            wf.notice.show(guideMessage, "info");
        } else if (first === "pr") {
            dispatch({ type: "SET_VIEW", payload: "prs" });
        }
    };

    // Commit 단계에서 올릴 커밋이 생기면 자동으로 Push 진행
    useEffect(() => {
        const guide = wf.guide;
        if (!guide || guide.steps.length === 0) return;
        const current = guide.steps.find(wf.isActive);
        if (!current || current.step !== "commit" || !hasPushableCommits || step !== 3) return;

        const commitIndex = guide.steps.findIndex((s) => s.step === "commit");
        if (guide.steps[commitIndex + 1]?.step !== "push") return;
        const timer = setTimeout(() => handlePush(selBranch), 800);
        return () => clearTimeout(timer);
    }, [wf.guide, step, hasPushableCommits, selBranch, state.currentView]);

    // --- Render ---
    const isPullSuggested = wf.isSuggested("pull");
    const isAddSuggested = wf.isSuggested("add");
    const isCommitSuggested = wf.isSuggested("commit");
    const isPushSuggested = wf.isSuggested("push");
    const { notice } = wf;

    return (
        <>
            <div className="panel">
                {(notice.showGuide || (wf.guide && wf.guide.steps.length > 0)) && (
                    <ProcessGuidePanel
                        step={step}
                        noticeText={notice.text}
                        noticeType={notice.type}
                        guide={wf.guide}
                        isActive={wf.isActive}
                        onClose={() => notice.setShowGuide(false)}
                        onCancelWorkflow={() => wf.reset("워크플로우가 취소되었습니다.")}
                    />
                )}

                {/* 컨트롤 버튼 영역 */}
                <div className="controls">
                    <button
                        className="btn"
                        style={{ background: "var(--warn)", color: "#1f2937", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}
                        onClick={() => setShowAIChatModal(true)}
                        title="AI 작업 도우미"
                    >
                        🤖 AI 제안
                    </button>

                    {/* 처음 올리기 필요 시, '가져오기' 대신 '시작' 버튼 표시 */}
                    {needsInitialPush && step === 1 ? (
                        <button
                            className="btn btn-success"
                            onClick={() => {
                                setStep(2);
                                toast.show("'파일 담기' 단계로 이동합니다.", "info");
                            }}
                        >
                            시작하기 (파일 담기)
                        </button>
                    ) : (
                        <BranchSplitButton
                            id={STEP_BUTTON_IDS.pull}
                            label={`${selBranch} 에서 가져오기`}
                            title={`'${selBranch}' 버전의 최신 내용을 서버에서 가져옵니다.`}
                            triggerTitle="가져올 작업 버전 선택"
                            suggested={isPullSuggested}
                            disabled={busy}
                            onAction={() => handlePull(selBranch)}
                            open={pullOpen}
                            onToggle={() => setPullOpen(!pullOpen)}
                            branches={branches}
                            selected={selBranch}
                            onSelect={(b) => {
                                setSelBranch(b);
                                setPullOpen(false);
                            }}
                            itemTitle={(b) => `'${b}' 버전 선택`}
                            onDelete={deleteBranch}
                            onCreate={createBranch}
                        />
                    )}

                    <button
                        id={STEP_BUTTON_IDS.add}
                        className={`btn${isAddSuggested ? " ai-suggested" : ""}`}
                        data-ai-suggested={isAddSuggested}
                        disabled={busy}
                        onClick={() => setOpenAdd(true)}
                        title={aiTitle(isAddSuggested, `변경된 파일 중 다음 버전에 포함할 파일을 선택합니다.${isAddSuggested ? " 파일을 선택하면 자동으로 다음 단계로 진행됩니다." : ""}`)}
                    >
                        {isAddSuggested && "🤖 "}파일 담기
                    </button>

                    <button
                        id={STEP_BUTTON_IDS.commit}
                        className={`btn btn-success${isCommitSuggested ? " ai-suggested" : ""}`}
                        data-ai-suggested={isCommitSuggested}
                        disabled={busy}
                        onClick={() => setCommitModalOpen(true)}
                        title={aiTitle(isCommitSuggested, "담긴 파일들을 하나의 작업 단위로 저장합니다.")}
                    >
                        {isCommitSuggested && "🤖 "}버전 저장
                    </button>

                    <BranchSplitButton
                        id={STEP_BUTTON_IDS.push}
                        variant="primary"
                        label={`${selBranch} 으로 올리기`}
                        title={`'${selBranch}' 버전의 저장된 내용을 서버에 올립니다.`}
                        triggerTitle="올릴 작업 버전 선택"
                        suggested={isPushSuggested}
                        disabled={busy}
                        onAction={() => handlePush(selBranch)}
                        open={pushOpen}
                        onToggle={() => setPushOpen(!pushOpen)}
                        branches={branches}
                        selected={selBranch}
                        onSelect={(b) => {
                            setSelBranch(b);
                            setPushOpen(false);
                        }}
                        itemTitle={(b) => `'${b}' 버전으로 올리기 선택`}
                    />
                </div>

                <StagingSummary files={state.stagingArea || []} repoId={repoId} />

                <ProcessToolbar showGuide={notice.showGuide} onToggleGuide={() => notice.setShowGuide((prev) => !prev)} />
            </div>

            {/* 모달 컴포넌트들 */}
            <AddModal open={openAdd} onCancel={() => setOpenAdd(false)} onConfirm={handleAddConfirm} />

            <RemoteConnectModal
                open={remoteModalOpen}
                repoId={repoId}
                onClose={() => setRemoteModalOpen(false)}
                onConnected={() => {
                    setRemoteModalOpen(false);
                    // 연결 성공 후 중단되었던 '올리기' 재시도
                    if (retryPushBranch) {
                        handlePush(retryPushBranch);
                        setRetryPushBranch(null);
                    }
                }}
            />

            <PushConfirmModal
                open={pushConfirmOpen}
                onClose={() => setPushConfirmOpen(false)}
                onConfirm={() => executePush(selBranch)}
                branch={selBranch}
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

            <AIWorkflowSuggestionModal
                open={showAIWorkflowModal}
                onClose={() => setShowAIWorkflowModal(false)}
                onWorkflowSuggested={handleWorkflowSuggested}
                repoId={repoId}
                stagingArea={state.stagingArea || []}
            />

            <AIChatAssistantModal open={showAIChatModal} onClose={() => setShowAIChatModal(false)} repoId={repoId} />

            {/* AI 추천으로 강조된 버튼의 툴팁 */}
            <StepTooltip step={wf.highlighted} />
        </>
    );
}
