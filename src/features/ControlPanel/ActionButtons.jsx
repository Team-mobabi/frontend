import React, { useEffect, useState } from "react";
import { useGit } from "../../features/GitCore/GitContext";
import { api } from "../../features/API";
import DiffView from "../Diff/DiffView";
import AddModal from "./AddModal";
import StagingSummary from "./StagingSummary";
import RemoteConnectModal from "../../components/Modal/RemoteConnectModal.jsx";
import PushConfirmModal from "../../components/Modal/PushConfirmModal";
import CommitConfirmModal from "../../components/Modal/CommitConfirmModal";
import AIWorkflowSuggestionModal from "../../components/Modal/AIWorkflowSuggestionModal";
import AIChatAssistantModal from "../../components/Modal/AIChatAssistantModal";
import ButtonTooltip from "../../components/Tooltip/ButtonTooltip";

// 단계 라벨 수정
const STEP_LABEL = { 1: "서버에서 최신 내용 가져오기", 2: "변경된 파일 담기", 3: "변경 내용 설명 쓰고 저장", 4: "서버에 올리기" };
const STEP_GUIDE = {
    1: "먼저 원격 저장소와 상태를 맞춰 주세요. 가져오기를 실행하면 서버에서 최신 내용을 받아옵니다.",
    2: "다음 버전에 포함할 파일을 고르고 담아 주세요. 선택된 파일은 스테이징 영역에 모입니다.",
    3: "담긴 파일들의 변경 이유를 메시지로 남기고 저장합니다. 저장 후에는 서버에 올리기가 준비됩니다.",
    4: "준비된 커밋을 선택한 브랜치로 업로드합니다. 필요하다면 변경 사항을 다시 확인해 주세요.",
};

// 워크플로우 단계 아이콘 및 설명
const STEP_ICONS = {
    "pull": "⬇️",
    "add": "📦",
    "commit": "💾",
    "push": "⬆️",
    "pr": "🔀",
};

const STEP_EXPLANATIONS = {
    "pull": "원격 저장소에서 최신 변경사항을 가져와 로컬과 동기화합니다.",
    "add": "변경된 파일 중 다음 버전에 포함할 파일을 선택하여 스테이징 영역에 추가합니다.",
    "commit": "스테이징된 파일들을 하나의 작업 단위로 묶어 커밋 메시지와 함께 저장합니다.",
    "push": "로컬에 저장된 커밋을 원격 저장소에 업로드하여 다른 사람과 공유합니다.",
    "pr": "변경사항을 코드 리뷰를 받기 위해 Pull Request로 생성합니다.",
};

const STEP_SHORT_DESCRIPTIONS = {
    "pull": "서버에서 최신 내용을 가져옵니다",
    "add": "변경된 파일을 선택하여 담습니다",
    "commit": "변경 내용을 설명하고 저장합니다",
    "push": "저장된 내용을 서버에 올립니다",
    "pr": "코드 리뷰를 위해 Pull Request를 만듭니다",
};

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
        // 리모트의 커밋들 중 로컬에도 있는 것 찾기 (공통 조상)
        let localBaseIndex = -1;
        let remoteBaseIndex = -1;

        for (let i = 0; i < rhashes.length; i++) {
            const idx = lhashes.indexOf(rhashes[i]);
            if (idx !== -1) {
                localBaseIndex = idx;
                remoteBaseIndex = i;
                break; // 첫 번째로 찾은 공통 커밋 사용
            }
        }

        // 공통 조상이 없으면 모든 로컬 커밋 push
        if (localBaseIndex === -1) return lb;

        // Remote가 Local보다 앞서 있는지 확인 (diverged)
        const ahead = localBaseIndex; // Local의 앞선 커밋 개수
        const behind = remoteBaseIndex; // Remote의 앞선 커밋 개수

        if (behind > 0) {
            const commits = lb.slice(0, localBaseIndex);
            commits._diverged = true;
            commits._behind = behind;
            return commits;
        }

        // 정상: Local만 앞서 있음
        return lb.slice(0, localBaseIndex);
    } else { // 서버에서 가져올 커밋 찾기
        // 로컬의 커밋들 중 리모트에도 있는 것 찾기 (공통 조상)
        let baseIndex = -1;
        for (let i = 0; i < lhashes.length; i++) {
            const idx = rhashes.indexOf(lhashes[i]);
            if (idx !== -1) {
                baseIndex = idx;
                break; // 첫 번째로 찾은 공통 커밋 사용
            }
        }
        // baseIndex 이전의 커밋들이 pull할 커밋들
        return baseIndex !== -1 ? rb.slice(0, baseIndex) : rb;
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
    const [isDivergedPush, setIsDivergedPush] = useState(false); // Force push 필요 여부
    const [commitModalOpen, setCommitModalOpen] = useState(false); // '버전 저장 확인' 모달
    const [hasPushableCommits, setHasPushableCommits] = useState(false); // Push 가능한 커밋 존재 여부
    const [showGuide, setShowGuide] = useState(true);
    const [processNotice, setProcessNotice] = useState("");
    const [noticeType, setNoticeType] = useState("info");
    const [showChangesPanel, setShowChangesPanel] = useState(false);
    const [showAIWorkflowModal, setShowAIWorkflowModal] = useState(false); // AI 워크플로우 모달
    const [showAIChatModal, setShowAIChatModal] = useState(false); // AI 챗봇 모달
    const [suggestedWorkflowSteps, setSuggestedWorkflowSteps] = useState([]); // 추천된 워크플로우 단계
    const [workflowGuide, setWorkflowGuide] = useState(null); // 워크플로우 가이드 정보
    const [isOnlySaveWorkflow, setIsOnlySaveWorkflow] = useState(false); // "만 저장" 워크플로우인지 여부
    
    // GitContext와 워크플로우 상태 동기화
    useEffect(() => {
        dispatch({ type: "SET_SUGGESTED_WORKFLOW_STEPS", payload: suggestedWorkflowSteps });
    }, [suggestedWorkflowSteps, dispatch]);
    
    useEffect(() => {
        dispatch({ type: "SET_WORKFLOW_GUIDE", payload: workflowGuide });
    }, [workflowGuide, dispatch]);
    
    // GitContext에서 워크플로우 완료 감지 (PR 생성 등 외부에서 완료된 경우)
    useEffect(() => {
        if (state.suggestedWorkflowSteps.length === 0 && suggestedWorkflowSteps.length > 0) {
            setSuggestedWorkflowSteps([]);
            setWorkflowGuide(null);
            showGuideNotice("워크플로우가 완료되었습니다! 🎉", "info");
        }
    }, [state.suggestedWorkflowSteps.length, suggestedWorkflowSteps.length]);
    
    // 스테이징 영역이 비면 워크플로우 리셋 (단, 파일을 담는 중이 아닐 때만)
    const [isAddingFiles, setIsAddingFiles] = useState(false);
    useEffect(() => {
        if (state.stagingArea && state.stagingArea.length === 0 && suggestedWorkflowSteps.length > 0 && !isAddingFiles) {
            // 파일을 담았다가 모두 삭제한 경우 워크플로우 리셋
            const hadStagedFiles = suggestedWorkflowSteps.includes("add") || suggestedWorkflowSteps.includes("commit");
            if (hadStagedFiles) {
                setSuggestedWorkflowSteps([]);
                setWorkflowGuide(null);
                setIsOnlySaveWorkflow(false);
                setStep(1);
                showGuideNotice("스테이징 영역이 비어 워크플로우를 리셋했습니다.", "info");
            }
        }
    }, [state.stagingArea?.length, suggestedWorkflowSteps.length, isAddingFiles]);

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
        
        let cancelled = false;
        
        Promise.all([
            api.repos.status(repoId), // 현재 상태 확인
            api.repos.graph(repoId), // 기록 그래프 정보 가져오기
            api.branches.list(repoId) // 작업 버전 목록 가져오기
        ])
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

                const stagedFiles = Array.isArray(st?.files) ? st.files : []; // '올릴 예정'인 파일 목록
                const localCommitsToPush = findMissingCommits(graph, currentBranch, "push") || []; // 서버에 없는 '저장된 기록'

                // 현재 브랜치가 remote에 없는지 확인 (새로 만든 브랜치인지)
                const remoteBranches = graph?.remote?.branches || {};
                const isNewLocalBranch = !remoteBranches[currentBranch];

                // Push 가능 여부 판단 (diverged 상태여도 Force Push 가능)
                const commitsReadyToPush = Array.isArray(localCommitsToPush) ? localCommitsToPush.length > 0 : false;
                const divergedFromRemote = Boolean(localCommitsToPush._diverged);
                const canPush = commitsReadyToPush || divergedFromRemote;
                setHasPushableCommits(canPush);

                if (stagedFiles.length > 0) {
                    setStep(3); // '올릴 예정' 파일 있으면 -> 설명 쓰고 저장 단계
                    const stagedFileNames = stagedFiles.map(f => f.path || f.file || f.name || String(f));
                    // 현재 stagingArea와 비교하여 변경된 경우에만 dispatch
                    const currentStaged = state.stagingArea || [];
                    const isDifferent = stagedFileNames.length !== currentStaged.length ||
                        !stagedFileNames.every(name => currentStaged.includes(name));
                    if (isDifferent) {
                        dispatch({ type: "ADD_SELECTED", payload: stagedFileNames }); // UI에 반영
                    }
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
                console.error("상태 확인: 프로젝트 정보를 가져오는데 실패했습니다:", err);
                setNeedsInitialPush(true);
                setStep(1);
                api.branches.list(repoId) // 작업 버전 목록이라도 가져오기 시도
                    .then(list => {
                        if (cancelled) return;
                        const fetchedBranches = normalizeBranchList(list);
                        setBranches(fetchedBranches);
                    })
                    .catch(() => {
                        if (cancelled) return;
                        setBranches(["main"]);
                    });
            });
            
        return () => {
            cancelled = true;
        };
    }, [repoId, selBranch, state.graphVersion]); // gitStatusCounter 대신 graphVersion 사용

    // --- Handlers ---
    const fail = (e, fb) => setToast(e?.message || fb || "오류가 발생했어요.");

    useEffect(() => {
        setProcessNotice("");
        setNoticeType("info");
        setShowGuide(true);
    }, [step]);

    const showGuideNotice = (message, type = "warning") => {
        setProcessNotice(message);
        setNoticeType(type);
        setShowGuide(true);
    };

    const guard = (targetStep, fn) => {
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

            // Diverged 상태 확인 (Local이 뒤처져 있고, Remote가 앞서 있는지)
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
                    // 워크플로우 추천이 있으면 다음 단계로 이동
                    if (suggestedWorkflowSteps.length > 0) {
                        const currentIndex = suggestedWorkflowSteps.indexOf("pull");
                        if (currentIndex >= 0 && currentIndex < suggestedWorkflowSteps.length - 1) {
                            const nextStep = suggestedWorkflowSteps[currentIndex + 1];
                            const stepMap = { "add": 2, "commit": 3, "push": 4 };
                            if (stepMap[nextStep]) {
                                setStep(stepMap[nextStep]);
                                const nextNextIndex = currentIndex + 2;
                                if (nextNextIndex < suggestedWorkflowSteps.length) {
                                    const nextNextStep = suggestedWorkflowSteps[nextNextIndex];
                                    showGuideNotice(`다음 단계: ${STEP_LABEL[stepMap[nextNextStep]]}`, "info");
                                } else {
                                    showGuideNotice("이 단계를 완료하면 워크플로우가 완료됩니다.", "info");
                                }
                            }
                        } else {
                            // 워크플로우 완료
                            setSuggestedWorkflowSteps([]);
                            setWorkflowGuide(null);
                            setStep(1);
                            showGuideNotice("워크플로우가 완료되었습니다! 🎉", "info");
                        }
                    } else {
                        setStep(2); // 다음 단계: 파일 담기
                    }
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

        setIsAddingFiles(true);
        setBusy(true);
        try {
            // 파일을 서버에 업로드 (필요하다면)
            const uploadResult = await api.repos.upload(repoId, selection);
            const uploadedFileNames = Array.isArray(uploadResult?.saved) ? uploadResult.saved : [];

            // '담기'(git add) 실행
            if (uploadedFileNames.length > 0) {
                await api.repos.add(repoId, uploadedFileNames);
            }
            
            // 서버의 실제 상태를 가져와서 스테이징 영역 동기화 (삭제된 파일 제외)
            const status = await api.repos.status(repoId);
            const stagedFileNames = Array.isArray(status?.files) 
                ? status.files.map(f => f.path || f.file || f.name || String(f))
                : uploadedFileNames; // status.files가 없으면 업로드된 파일 목록 사용

            if (stagedFileNames.length > 0) {
                dispatch({ type: "SET_STAGING_AREA", payload: stagedFileNames }); // 서버 상태로 동기화
                dispatch({ type: "SET_ANIMATION_START", payload: "add" }); // 애니메이션 시작
                dispatch({ type: "GRAPH_DIRTY" }); // 상태 변경 알림 - StagedDiffView가 업데이트되도록
                
                // 워크플로우 추천이 있으면 다음 단계로 이동
                if (suggestedWorkflowSteps.length > 0) {
                    const currentIndex = suggestedWorkflowSteps.indexOf("add");
                    if (currentIndex >= 0 && currentIndex < suggestedWorkflowSteps.length - 1) {
                        const nextStep = suggestedWorkflowSteps[currentIndex + 1];
                        const stepMap = { "commit": 3, "push": 4 };
                        if (stepMap[nextStep]) {
                            // 약간의 지연을 두고 step 변경 (하이라이팅이 업데이트되도록)
                            setTimeout(() => {
                                setStep(stepMap[nextStep]);
                                console.log("[handleAddConfirm] Step changed to:", stepMap[nextStep], "for next step:", nextStep);
                                
                                // Commit 단계면 자동으로 모달 열기
                                if (nextStep === "commit") {
                                    setTimeout(() => {
                                        setCommitModalOpen(true);
                                    }, 300);
                                }
                            }, 100);
                            
                            const nextNextIndex = currentIndex + 2;
                            if (nextNextIndex < suggestedWorkflowSteps.length) {
                                const nextNextStep = suggestedWorkflowSteps[nextNextIndex];
                                showGuideNotice(`다음 단계: ${STEP_LABEL[stepMap[nextNextStep]]}`, "info");
                            } else {
                                showGuideNotice("이 단계를 완료하면 워크플로우가 완료됩니다.", "info");
                            }
                        }
                    } else {
                        // 워크플로우 완료
                        setSuggestedWorkflowSteps([]);
                        setWorkflowGuide(null);
                        setStep(1);
                        showGuideNotice("워크플로우가 완료되었습니다! 🎉", "info");
                    }
                } else {
                    // 워크플로우가 없어도 다음 단계로 이동
                    setTimeout(() => {
                        setStep(3); // 다음 단계: 설명 쓰고 저장
                    }, 100);
                }
            }
        } catch (e) {
            fail(e, "파일을 담는 데 실패했어요.");
        } finally {
            setBusy(false);
            // 파일 담기 완료 후 약간의 지연을 두고 플래그 해제
            setTimeout(() => {
                setIsAddingFiles(false);
            }, 1000);
        }
    };

    // '버전 저장'(Commit) 처리
    const handleCommit = async () => {
        setCommitModalOpen(false);
        const text = msg.trim() || "변경사항 저장"; // 저장 메시지 (없으면 기본값 사용)
        setBusy(true);
        dispatch({ type: "SET_ANIMATION_START", payload: "commit" }); // 애니메이션 시작 (가정)

        try {
            await api.repos.commit(repoId, text); // 실제 저장 실행
            setMsg(""); // 메시지 입력칸 비우기
            dispatch({ type: "COMMIT_SUCCESS", message: text }); // 성공 상태 업데이트 (가정)
            dispatch({ type: "GRAPH_TICK" }); // 상태 변경 알림 (그래프 UI 등 다른 요소 갱신용)

            setHasPushableCommits(true);

            await new Promise(resolve => setTimeout(resolve, 600)); // 애니메이션 시간 대기
            
            // 워크플로우 추천이 있으면 다음 단계로 이동
            if (suggestedWorkflowSteps.length > 0) {
                const currentIndex = suggestedWorkflowSteps.indexOf("commit");
                if (currentIndex >= 0 && currentIndex < suggestedWorkflowSteps.length - 1) {
                    const nextStep = suggestedWorkflowSteps[currentIndex + 1];
                    const stepMap = { "push": 4 };
                    if (stepMap[nextStep]) {
                        setStep(stepMap[nextStep]);
                        // Push 단계면 자동으로 진행
                        setTimeout(() => {
                            handlePush(selBranch);
                        }, 300);
                        const nextNextIndex = currentIndex + 2;
                        if (nextNextIndex < suggestedWorkflowSteps.length) {
                            const nextNextStep = suggestedWorkflowSteps[nextNextIndex];
                            if (nextNextStep === "pr") {
                                showGuideNotice("다음 단계: Pull Request 만들기", "info");
                            }
                        } else {
                            showGuideNotice("이 단계를 완료하면 워크플로우가 완료됩니다.", "info");
                        }
                    } else if (nextStep === "pr") {
                        // PR로 이동하고 워크플로우 유지
                        setTimeout(() => {
                            dispatch({ type: "SET_VIEW", payload: "prs" });
                            dispatch({ type: "OPEN_PR_CREATE_MODAL" }); // PR 생성 모달 자동 열기
                        }, 300);
                        showGuideNotice("이제 Pull Request를 만들어주세요. 위의 '+ 새 Pull Request' 버튼을 클릭하세요.", "info");
                    }
                } else {
                    // 워크플로우 완료 (commit이 마지막 단계인 경우)
                    // "만 저장" 워크플로우면 워크플로우 리셋하고 스텝만 돌아가기
                    if (isOnlySaveWorkflow) {
                        setTimeout(() => {
                            setSuggestedWorkflowSteps([]);
                            setWorkflowGuide(null);
                            setIsOnlySaveWorkflow(false);
                            setStep(1);
                            showGuideNotice("변경사항이 저장되었습니다! 다음 작업을 선택해주세요.", "info");
                        }, 800);
                    } else {
                        // 일반 워크플로우 완료
                        setSuggestedWorkflowSteps([]);
                        setWorkflowGuide(null);
                        setIsOnlySaveWorkflow(false);
                        setStep(1);
                        showGuideNotice("워크플로우가 완료되었습니다! 🎉", "info");
                    }
                }
            } else {
                // 워크플로우가 없으면 스텝만 돌아가기
                setTimeout(() => {
                    setStep(1);
                    showGuideNotice("변경사항이 저장되었습니다! 다음 작업을 선택해주세요.", "info");
                }, 800);
            }
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
            await api.branches.switch(repoId, branchName);
            const graph = await api.repos.graph(repoId);
            const transfer = findMissingCommits(graph, branchName, "push");

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

            // transfer가 배열인지 확인하고, _diverged 같은 속성 제거
            const cleanCommits = Array.isArray(transfer) 
                ? transfer.filter(c => c && typeof c === 'object' && c.hash)
                : [];
            
            setCommitsToPush(cleanCommits); // 올릴 내용 상태에 저장
            setIsDivergedPush(isDiverged); // Diverged 상태 별도 저장
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
            const pushPayload = {
                branch: branchName,
                force: isDivergedPush
            };

            await api.repos.push(repoId, pushPayload);

            setTimeout(() => {
                // 워크플로우 추천이 있으면 다음 단계로 이동
                if (suggestedWorkflowSteps.length > 0) {
                    const currentIndex = suggestedWorkflowSteps.indexOf("push");
                    console.log("[Push] Current index:", currentIndex, "suggestedWorkflowSteps:", suggestedWorkflowSteps);
                    if (currentIndex >= 0 && currentIndex < suggestedWorkflowSteps.length - 1) {
                        const nextStep = suggestedWorkflowSteps[currentIndex + 1];
                        console.log("[Push] Next step:", nextStep);
                        if (nextStep === "pr") {
                            // PR로 이동하고 워크플로우 유지
                            console.log("[Push] Moving to PR view");
                            dispatch({ type: "GRAPH_DIRTY" }); // 그래프 새로고침
                            setCommitsToPush([]); // 올릴 내용 비우기
                            setHasPushableCommits(false);
                            setBusy(false);
                            // 약간의 지연 후 PR 뷰로 이동
                            setTimeout(() => {
                                dispatch({ type: "SET_VIEW", payload: "prs" });
                                dispatch({ type: "OPEN_PR_CREATE_MODAL" }); // PR 생성 모달 자동 열기
                            }, 500);
                            return; // 여기서 종료하여 step을 변경하지 않음
                        }
                    } else {
                        // 워크플로우 완료
                        console.log("[Push] Workflow completed");
                        setSuggestedWorkflowSteps([]);
                        setWorkflowGuide(null);
                        setStep(1);
                        showGuideNotice("워크플로우가 완료되었습니다! 🎉", "info");
                    }
                } else {
                    setStep(1); // 완료 후 첫 단계로 돌아감
                }
                dispatch({ type: "GRAPH_DIRTY" }); // 그래프 새로고침
                setCommitsToPush([]); // 올릴 내용 비우기

                setHasPushableCommits(false);
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

    // '새 작업 버전 만들기' 처리
    const handleCreateBranch = async () => {
        setPullOpen(false);
        const newBranchName = prompt(`현재 '${selBranch}' 버전에서 시작하는 새 작업 버전의 이름을 입력하세요:`)?.trim() || `branch-${Date.now()}`;
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

    // 워크플로우 추천 처리
    const handleWorkflowSuggested = (workflowSteps) => {
        console.log("[handleWorkflowSuggested] Received workflow steps:", workflowSteps);
        console.log("[handleWorkflowSuggested] Current step before:", step);
        
        // "만 저장" 워크플로우인지 먼저 확인 (push가 없으면 "만 저장")
        const hasPush = workflowSteps.includes("push");
        const isOnlySave = !hasPush && (workflowSteps.includes("commit") || workflowSteps.includes("add"));
        
        // 상태를 동시에 업데이트하여 버튼 깜빡임 방지
        setSuggestedWorkflowSteps(workflowSteps);
        setIsOnlySaveWorkflow(isOnlySave);
        
        // 워크플로우 가이드 정보 저장
        if (workflowSteps.length > 0) {
            const stepMap = { "pull": 1, "add": 2, "commit": 3, "push": 4, "pr": "pr" };
            const workflowGuideData = {
                steps: workflowSteps.map((s, idx) => ({
                    step: s,
                    stepNum: stepMap[s],
                    label: stepMap[s] ? STEP_LABEL[stepMap[s]] : "Pull Request 만들기",
                    icon: STEP_ICONS[s] || "📝",
                    explanation: STEP_EXPLANATIONS[s] || "",
                    index: idx + 1,
                })),
            };
            console.log("[handleWorkflowSuggested] Setting workflow guide:", workflowGuideData);
            setWorkflowGuide(workflowGuideData);
            // 워크플로우 가이드가 있을 때는 가이드를 강제로 표시
            setShowGuide(true);
        }
        
        // 워크플로우 단계에 따라 첫 번째 단계로 이동하고 가이드
        if (workflowSteps.length > 0) {
            const firstStep = workflowSteps[0];
            const stepMap = {
                "pull": 1,
                "add": 2,
                "commit": 3,
                "push": 4,
            };
            
            // 첫 번째 단계로 이동
            if (stepMap[firstStep]) {
                const firstStepNum = stepMap[firstStep];
                setStep(firstStepNum);
                console.log("[handleWorkflowSuggested] Set step to:", firstStepNum, "for workflow:", workflowSteps);
                
                // 파일 담기 단계면 자동으로 모달 열기
                if (firstStep === "add") {
                    setOpenAdd(true);
                }
                
                // 현재 단계와 다음 단계 안내 메시지 설정
                const currentStepLabel = STEP_LABEL[stepMap[firstStep]];
                const nextStepIndex = 1;
                let guideMessage = `🤖 현재 단계: ${currentStepLabel}\n\n`;
                
                if (workflowSteps.length > nextStepIndex) {
                    const nextStep = workflowSteps[nextStepIndex];
                    const nextStepLabel = stepMap[nextStep] ? STEP_LABEL[stepMap[nextStep]] : "다음 단계";
                    guideMessage += `다음 단계: ${nextStepLabel}\n\n`;
                }
                
                guideMessage += "위의 버튼을 클릭하여 진행하세요. 현재 단계가 강조 표시됩니다.";
                
                showGuideNotice(guideMessage, "info");
            } else if (firstStep === "pr") {
                // PR은 특별 처리
                dispatch({ type: "SET_VIEW", payload: "prs" });
            }
        }
    };

    // 워크플로우 취소 처리
    const handleCancelWorkflow = () => {
        setSuggestedWorkflowSteps([]);
        setWorkflowGuide(null);
        setIsOnlySaveWorkflow(false);
        setStep(1);
        showGuideNotice("워크플로우가 취소되었습니다.", "info");
    };

    // 자동으로 다음 단계로 진행하는 로직
    useEffect(() => {
        if (!workflowGuide || workflowGuide.steps.length === 0) return;
        
        const currentStepInfo = workflowGuide.steps.find(s => {
            if (s.step === "pr") {
                return state.currentView === "prs";
            }
            return step === s.stepNum;
        });
        
        if (!currentStepInfo) return;
        
        // Commit 완료 후 자동으로 Push 진행
        if (currentStepInfo.step === "commit" && hasPushableCommits && step === 3) {
            const currentIndex = workflowGuide.steps.findIndex(s => s.step === "commit");
            const nextStep = workflowGuide.steps[currentIndex + 1];
            if (nextStep && nextStep.step === "push") {
                // 약간의 지연 후 자동으로 push 진행
                const timer = setTimeout(() => {
                    if (hasPushableCommits && step === 3) {
                        handlePush(selBranch);
                    }
                }, 800);
                return () => clearTimeout(timer);
            }
        }
    }, [workflowGuide, step, hasPushableCommits, selBranch, state.currentView]);
    
    // --- Button Locks ---
    // 각 단계별 버튼 활성화/비활성화 로직
    // 워크플로우 추천이 있으면 모든 단계를 활성화하되, 현재 단계를 강조
    const getCurrentWorkflowStep = () => {
        if (suggestedWorkflowSteps.length === 0) return null;
        const stepMap = { "pull": 1, "add": 2, "commit": 3, "push": 4 };
        // PR 단계인 경우
        if (state.currentView === "prs" && suggestedWorkflowSteps.includes("pr")) {
            return "pr";
        }
        // 현재 step에 해당하는 워크플로우 단계 찾기
        for (let i = 0; i < suggestedWorkflowSteps.length; i++) {
            const stepNum = stepMap[suggestedWorkflowSteps[i]];
            if (stepNum === step) {
                return stepNum;
            }
        }
        // 현재 step이 워크플로우에 없으면 첫 번째 단계 반환
        return stepMap[suggestedWorkflowSteps[0]] || null;
    };
    
    const currentWorkflowStep = getCurrentWorkflowStep();
    const isInSuggestedWorkflow = suggestedWorkflowSteps.length > 0;
    
    // 각 단계가 추천된 워크플로우에 포함되어 있고, 현재 활성화된 단계인지 확인
    // 워크플로우가 있으면 현재 step에 해당하는 단계를 강조
    // step이 워크플로우에 없으면 첫 번째 단계를 강조
    const stepMap = { "pull": 1, "add": 2, "commit": 3, "push": 4 };
    const getStepToHighlight = () => {
        if (suggestedWorkflowSteps.length === 0) return null;
        // 현재 step에 해당하는 워크플로우 단계 찾기
        for (let i = 0; i < suggestedWorkflowSteps.length; i++) {
            const stepNum = stepMap[suggestedWorkflowSteps[i]];
            if (stepNum === step) {
                console.log("[getStepToHighlight] Found matching step:", suggestedWorkflowSteps[i], "for step:", step);
                return suggestedWorkflowSteps[i];
            }
        }
        // 현재 step이 워크플로우에 없으면 첫 번째 단계 반환
        console.log("[getStepToHighlight] No match, returning first step:", suggestedWorkflowSteps[0]);
        return suggestedWorkflowSteps[0];
    };
    
    const highlightedStep = getStepToHighlight();
    
    const isPullSuggested = suggestedWorkflowSteps.includes("pull") && highlightedStep === "pull";
    const isAddSuggested = suggestedWorkflowSteps.includes("add") && highlightedStep === "add";
    const isCommitSuggested = suggestedWorkflowSteps.includes("commit") && highlightedStep === "commit";
    const isPushSuggested = suggestedWorkflowSteps.includes("push") && highlightedStep === "push";
    

    
    // 하이라이팅 업데이트를 위한 useEffect (step 변경 시)
    useEffect(() => {
        if (isInSuggestedWorkflow) {
            // DOM에서 실제 클래스 확인 및 업데이트 (렌더링 완료 후)
            const updateHighlighting = () => {
                const addBtn = document.getElementById("tutorial-add-btn");
                const commitBtn = document.getElementById("tutorial-commit-btn");
                const pushBtn = document.getElementById("tutorial-push-btn");
                const pullBtn = document.getElementById("tutorial-pull-btn");
                
                // 모든 버튼에서 ai-suggested 클래스 제거
                [addBtn, commitBtn, pushBtn, pullBtn].forEach(btn => {
                    if (btn) {
                        btn.classList.remove("ai-suggested");
                        btn.removeAttribute("data-ai-suggested");
                    }
                });
                
                // 현재 하이라이팅된 단계에만 클래스 추가
                if (isAddSuggested && addBtn) {
                    addBtn.classList.add("ai-suggested");
                    addBtn.setAttribute("data-ai-suggested", "true");
                }
                if (isCommitSuggested && commitBtn) {
                    commitBtn.classList.add("ai-suggested");
                    commitBtn.setAttribute("data-ai-suggested", "true");
                }
                if (isPushSuggested && pushBtn) {
                    pushBtn.classList.add("ai-suggested");
                    pushBtn.setAttribute("data-ai-suggested", "true");
                }
                if (isPullSuggested && pullBtn) {
                    pullBtn.classList.add("ai-suggested");
                    pullBtn.setAttribute("data-ai-suggested", "true");
                }
            };
            
            // 약간의 지연을 두고 업데이트 (렌더링 완료 후)
            const timer = setTimeout(updateHighlighting, 50);
            return () => clearTimeout(timer);
        }
    }, [step, isInSuggestedWorkflow, isAddSuggested, isCommitSuggested, isPushSuggested, isPullSuggested]);
    

    // --- Render ---
    return (
        <>
            <div className="panel">
                {(showGuide || (workflowGuide && workflowGuide.steps.length > 0)) && (
                    <div className={`process-alert ${noticeType}`}>
                        <div className="process-alert-header">
                            <div>
                                <strong className="process-alert-title">현재 단계</strong>
                                <span className="process-alert-step">{STEP_LABEL[step]}</span>
                            </div>
                            {!workflowGuide && (
                                <button
                                    className="process-alert-close"
                                    onClick={() => setShowGuide(false)}
                                    title="안내 닫기"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                        <p className="process-alert-body">{STEP_GUIDE[step]}</p>
                        {processNotice && <div className={`process-alert-message ${noticeType}`}>{processNotice}</div>}
                        
                        {/* 워크플로우 가이드 표시 */}
                        {workflowGuide && workflowGuide.steps.length > 0 && (
                            <div className="workflow-guide-box">
                                <div className="workflow-guide-header">
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                                        <div className="workflow-guide-title">🎮 튜토리얼 모드</div>
                                        <button
                                            className="btn btn-ghost"
                                            onClick={handleCancelWorkflow}
                                            style={{ fontSize: "12px", padding: "4px 8px", color: "var(--text-secondary)" }}
                                            title="워크플로우 취소"
                                        >
                                            ✕ 취소
                                        </button>
                                    </div>
                                    <div className="workflow-progress">
                                        <div className="workflow-progress-bar">
                                            <div 
                                                className="workflow-progress-fill"
                                                style={{
                                                    width: `${(workflowGuide.steps.findIndex(s => {
                                                        if (s.step === "pr") return state.currentView === "prs";
                                                        return step === s.stepNum;
                                                    }) + 1) / workflowGuide.steps.length * 100}%`
                                                }}
                                            />
                                        </div>
                                        <div className="workflow-progress-text">
                                            {workflowGuide.steps.findIndex(s => {
                                                if (s.step === "pr") return state.currentView === "prs";
                                                return step === s.stepNum;
                                            }) + 1} / {workflowGuide.steps.length}
                                        </div>
                                    </div>
                                </div>
                                <div className="workflow-guide-steps">
                                    {workflowGuide.steps.map((stepInfo, idx) => {
                                        // PR 단계인 경우 currentView를 확인
                                        const isActive = stepInfo.step === "pr" 
                                            ? state.currentView === "prs"
                                            : step === stepInfo.stepNum;
                                        
                                        // 완료된 단계 확인
                                        const isCompleted = workflowGuide.steps.findIndex(s => {
                                            if (s.step === "pr") return state.currentView === "prs";
                                            return step === s.stepNum;
                                        }) > idx;
                                        
                                        return (
                                            <div key={idx} className={`workflow-guide-step ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}>
                                                <span className="workflow-guide-step-number">
                                                    {isCompleted ? "✓" : stepInfo.index}
                                                </span>
                                                <span className="workflow-guide-step-icon">{stepInfo.icon}</span>
                                                <span className="workflow-guide-step-label">{stepInfo.label}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="workflow-guide-hint">
                                    {workflowGuide.steps.find(s => {
                                        if (s.step === "pr") return state.currentView === "prs";
                                        return step === s.stepNum;
                                    })?.explanation || "순서대로 진행하시면 됩니다. 현재 단계가 강조 표시됩니다."}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 컨트롤 버튼 영역 */}
                <div className="controls">
                    {/* AI 제안 버튼 (맨 앞에 배치) */}
                    <button
                        className="btn"
                        style={{ 
                            background: "var(--warn)", 
                            color: "#1f2937",
                            fontWeight: "bold",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px"
                        }}
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
                                setToast("'파일 담기' 단계로 이동합니다.");
                            }}
                        >
                            시작하기 (파일 담기)
                        </button>
                    ) : (
                        // '가져오기' 버튼 (버전 선택 포함)
                        <div className={`btn-split-wrap${isPullSuggested ? " ai-suggested" : ""}`} data-ai-suggested={isPullSuggested}>
                            <button
                                id="tutorial-pull-btn"
                                className={`btn btn-split-action${isPullSuggested ? " ai-suggested" : ""}`}
                                data-ai-suggested={isPullSuggested}
                                onClick={() => guard(1, () => handlePull(selBranch))}
                                title={isPullSuggested ? `🤖 AI 추천: '${selBranch}' 버전의 최신 내용을 서버에서 가져옵니다.` : `'${selBranch}' 버전의 최신 내용을 서버에서 가져옵니다.`}
                            >
                                {isPullSuggested && "🤖 "}{selBranch} 에서 가져오기
                            </button>
                            <button
                                className="btn btn-split-trigger"
                                onClick={() => guard(1, () => setPullOpen(!pullOpen))}
                                title="가져올 작업 버전 선택"
                            >
                                ▼
                            </button>
                            {/* 버전 선택 메뉴 */}
                            {pullOpen && (
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
                        id="tutorial-add-btn"
                        className={`btn${isAddSuggested ? " ai-suggested" : ""}`}
                        data-ai-suggested={isAddSuggested}
                        onClick={() => {
                            if (isInSuggestedWorkflow && step === 2) {
                                // 워크플로우 추천 중이고 파일 담기 단계면 모달 열기
                                setOpenAdd(true);
                            } else {
                                guard(2, () => setOpenAdd(true));
                            }
                        }}
                        title={isAddSuggested ? "🤖 AI 추천: 변경된 파일 중 다음 버전에 포함할 파일을 선택합니다. 파일을 선택하면 자동으로 다음 단계로 진행됩니다." : "변경된 파일 중 다음 버전에 포함할 파일을 선택합니다."}
                    >
                        {isAddSuggested && "🤖 "}파일 담기
                    </button>

                    {/* '버전 저장' 버튼 */}
                    <button
                        id="tutorial-commit-btn"
                        className={`btn btn-success${isCommitSuggested ? " ai-suggested" : ""}`}
                        data-ai-suggested={isCommitSuggested}
                        onClick={() => guard(3, () => setCommitModalOpen(true))}
                        title={isCommitSuggested ? "🤖 AI 추천: 담긴 파일들을 하나의 작업 단위로 저장합니다." : "담긴 파일들을 하나의 작업 단위로 저장합니다."}
                    >
                        {isCommitSuggested && "🤖 "}버전 저장
                    </button>

                    {/* '서버에 올리기' 버튼 (버전 선택 포함) */}
                    <div className={`btn-split-wrap primary${isPushSuggested ? " ai-suggested" : ""}`} data-ai-suggested={isPushSuggested}>
                        <button
                            id="tutorial-push-btn"
                            className={`btn btn-primary btn-split-action${isPushSuggested ? " ai-suggested" : ""}`}
                            data-ai-suggested={isPushSuggested}
                            onClick={() => guard(4, () => handlePush(selBranch))}
                            title={isPushSuggested ? `🤖 AI 추천: '${selBranch}' 버전의 저장된 내용을 서버에 올립니다.` : `'${selBranch}' 버전의 저장된 내용을 서버에 올립니다.`}
                        >
                            {isPushSuggested && "🤖 "}{selBranch} 으로 올리기
                        </button>
                        <button
                            className="btn btn-primary btn-split-trigger"
                            onClick={() => guard(4, () => setPushOpen(!pushOpen))}
                            title="올릴 작업 버전 선택"
                        >
                            ▼
                        </button>
                        {/* 버전 선택 메뉴 */}
                        {pushOpen && (
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
                    files={state.stagingArea || []} // '담긴 파일' 상태 (useGit에서 관리)
                    repoId={repoId}
                />

                <div className="process-toolbar">
                    <div className="process-toolbar-buttons">
                        <button
                            className="btn btn-ghost"
                            onClick={() => setShowChangesPanel((prev) => !prev)}
                        >
                            {showChangesPanel ? "변경 사항 닫기" : "변경 사항 미리보기"}
                        </button>
                        <button
                            className="btn btn-ghost"
                            onClick={() => setShowGuide((prev) => !prev)}
                        >
                            {showGuide ? "단계 안내 숨기기" : "단계 안내 보기"}
                        </button>
                    </div>
                    <span className="process-toolbar-hint">커밋이나 PR 전에 변경 내용을 확인해 보세요.</span>
                </div>

                {showChangesPanel && (
                    <div className="changes-preview-panel">
                        <div className="changes-preview-header">
                            <h4>브랜치에 포함될 변경 사항</h4>
                            <button className="btn btn-ghost" onClick={() => setShowChangesPanel(false)}>닫기</button>
                        </div>
                        <DiffView embedded initialTab="changes" />
                    </div>
                )}
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
                isDiverged={isDivergedPush} // Force push 필요 여부
            />

            <CommitConfirmModal // '버전 저장' 확인 모달
                open={commitModalOpen}
                onClose={() => setCommitModalOpen(false)}
                onConfirm={handleCommit} // 확인 시 실제 저장 실행
                message={msg} // 메시지 상태 전달
                onMessageChange={setMsg} // 메시지 변경 핸들러 전달
            />

            <AIWorkflowSuggestionModal // AI 워크플로우 추천 모달
                open={showAIWorkflowModal}
                onClose={() => setShowAIWorkflowModal(false)}
                onWorkflowSuggested={handleWorkflowSuggested}
                currentStep={step}
                hasPushableCommits={hasPushableCommits}
                repoId={repoId}
                stagingArea={state.stagingArea || []}
                hasUncommittedChanges={state.stagingArea && state.stagingArea.length > 0}
            />
            
            <AIChatAssistantModal // AI 챗봇 모달
                open={showAIChatModal}
                onClose={() => setShowAIChatModal(false)}
            />

            {/* 버튼 툴팁 */}
            {isPullSuggested && (
                <ButtonTooltip
                    targetElementId="tutorial-pull-btn"
                    message={STEP_SHORT_DESCRIPTIONS["pull"]}
                    position="bottom"
                    show={true}
                />
            )}
            {isAddSuggested && (
                <ButtonTooltip
                    targetElementId="tutorial-add-btn"
                    message={STEP_SHORT_DESCRIPTIONS["add"]}
                    position="bottom"
                    show={true}
                />
            )}
            {isCommitSuggested && (
                <ButtonTooltip
                    targetElementId="tutorial-commit-btn"
                    message={STEP_SHORT_DESCRIPTIONS["commit"]}
                    position="bottom"
                    show={true}
                />
            )}
            {isPushSuggested && (
                <ButtonTooltip
                    targetElementId="tutorial-push-btn"
                    message={STEP_SHORT_DESCRIPTIONS["push"]}
                    position="bottom"
                    show={true}
                />
            )}

        </>
    );
}