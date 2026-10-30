import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useGit } from "../GitCore/GitContext";
import { api, errorMessage, isConflictError, isMergeInProgressError } from "../../lib/api";
import { createLogger } from "../../lib/logger";
import type { Repo } from "../../types/api";
import AnimationEngine from "./AnimationEngine";
import StagingArea from "./StagingArea";
import GraphPanel from "./GraphPanel";
import {
    EMPTY_GRAPH,
    buildGraphState,
    calcBranchLabels,
    calcLineSegments,
    calcPositions,
    matchesHash,
    type GraphState,
    type MergeAction,
} from "./graphLayout";
import MergeBranchModal from "../../components/Modal/MergeBranchModal";
import ConflictModal from "../../components/Modal/ConflictModal";
import ResetConfirmModal from "../../components/Modal/ResetConfirmModal";
import ToggleSwitch from "../../components/common/ToggleSwitch";
import { useToast } from "../../components/Toast/ToastProvider";
import BeginnerHelp from "../../pages/BeginnerHelp";
import CloneRepoModal from "../../components/Modal/CloneRepoModal";
import { repoIdOf } from "../GitCore/gitUtils";

const log = createLogger("RepositoryView");

interface TipState {
    show: boolean;
    x: number;
    y: number;
    lines: string[];
}

export default function RepositoryView() {
    const { state, dispatch } = useGit();
    const toast = useToast();
    const repoId = state?.selectedRepoId;

    // [추가] 현재 저장소 이름 찾기
    const currentRepo = (state.repositories || []).find(r => {
        const rid = repoIdOf(r);
        return String(rid) === String(repoId);
    });
    const repoName = currentRepo?.name;

    const [graph, setGraph] = useState<GraphState>(EMPTY_GRAPH);
    const [tip, setTip] = useState<TipState>({ show: false, x: 0, y: 0, lines: [] });
    const [mergeModalState, setMergeModalState] = useState<{ open: boolean; sourceBranch: string | null }>({ open: false, sourceBranch: null });
    const [resetModalState, setResetModalState] = useState<{ open: boolean; commitHash: string | null; commitMessage: string | null }>({ open: false, commitHash: null, commitMessage: null });
    const [simplified, setSimplified] = useState(false);
    const [showStaging, setShowStaging] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const [isCloneModalOpen, setCloneModalOpen] = useState(false);
    const [lastAction, setLastAction] = useState<MergeAction | null>(null);

    useEffect(() => {
        if (!repoId) { setGraph(EMPTY_GRAPH); return; }
        api.repos
            .graph(repoId, { simplified: simplified ? "true" : undefined })
            .then((g) => setGraph(buildGraphState(g, true)))
            .catch((err: unknown) => {
                log.error("Graph API Error:", err);
                setGraph(EMPTY_GRAPH);
            });
    }, [repoId, state.graphVersion, simplified]);

    useEffect(() => {
        if (state.animationMode === "commit") setShowStaging(true);
        else if (state.animationMode === "idle") setShowStaging(false);
    }, [state.animationMode]);

    const localPos = useMemo(() => calcPositions(graph.local), [graph.local]);
    const remotePos = useMemo(() => calcPositions(graph.remote), [graph.remote]);

    const localBranchData = useMemo(() => calcBranchLabels(localPos, graph.local?.branchHeads), [localPos, graph.local]);
    const remoteBranchData = useMemo(() => calcBranchLabels(remotePos, graph.remote?.branchHeads), [remotePos, graph.remote]);

    const localBranchLabels = localBranchData.labels;
    const remoteBranchLabels = remoteBranchData.labels;
    const branchColorMap = localBranchData.branchColorMap;

    const localLineSegments = useMemo(() => calcLineSegments(localPos, lastAction, branchColorMap), [localPos, lastAction, branchColorMap]);
    const remoteLineSegments = useMemo(() => calcLineSegments(remotePos, lastAction, branchColorMap), [remotePos, lastAction, branchColorMap]);

    const handleOpenMergeModal = (sourceBranch: string) => setMergeModalState({ open: true, sourceBranch });

    const handleMergeConfirm = async (targetBranch: string) => {
        const { sourceBranch } = mergeModalState;
        setMergeModalState({ open: false, sourceBranch: null });
        if (!sourceBranch || !targetBranch || !repoId) return;
        try {
            const mergeResult = await api.repos.merge(repoId, { sourceBranch, targetBranch });

            // 하이라이트 설정 (3초 후 자동 해제)
            setLastAction({
                type: "merge",
                fastForward: !!mergeResult?.fastForward,
                source: sourceBranch,
                target: targetBranch,
                commitHash: mergeResult?.mergeCommitHash || null,
                at: Date.now(),
            });
            setTimeout(() => setLastAction(null), 3000);

            if (mergeResult?.hasConflict) {
                dispatch({ type: "OPEN_CONFLICT_MODAL" });
            } else {
                dispatch({ type: "GRAPH_DIRTY" });
            }
        } catch (e) {
            if (isMergeInProgressError(e)) {
                dispatch({ type: "OPEN_CONFLICT_MODAL" });
                return;
            }
            // 기존 로컬 판별식은 "merge failed"도 충돌로 취급했다
            if (isConflictError(e) || /merge failed/i.test(errorMessage(e, ""))) {
                dispatch({ type: "OPEN_CONFLICT_MODAL" });
            } else {
                toast.show(`병합 실패: ${errorMessage(e, "Unknown error")}`, "error");
            }
        }
    };

    const handleReset = (hash: string) => {
        const commits = graph.local?.commits || [];
        const commit = commits.find(c => matchesHash(c, hash));

        const commitMessage = commit?.message || localPos[hash]?.message || "커밋 메시지 없음";
        setResetModalState({ open: true, commitHash: hash, commitMessage });
    };

    const handleResetConfirm = async (mode: string) => {
        const { commitHash } = resetModalState;
        setResetModalState({ open: false, commitHash: null, commitMessage: null });

        if (!commitHash || !repoId) return;

        try {
            await api.repos.reset(repoId, { commitHash, mode });

            // 0.5초 대기 (백엔드 상태 완전히 반영되도록)
            await new Promise(resolve => setTimeout(resolve, 500));

            // 그래프 즉시 새로고침
            const g = await api.repos.graph(repoId);
            setGraph(buildGraphState(g, false));

            toast.show(`Reset 완료: ${mode} mode`, "success");
        } catch (e) {
            log.error("Reset 실패:", e);
            toast.show(`Reset 실패: ${errorMessage(e, "Unknown error")}`, "error");
        }
    };

    const graphHeight = useMemo(() => {
        const allPositions = [...Object.values(localPos), ...Object.values(remotePos)];
        return allPositions.length === 0 ? 260 : Math.max(...allPositions.map((p) => p.y)) + 80;
    }, [localPos, remotePos]);

    const showTip = (evt: MouseEvent, lines: string[]) =>
        setTip({ show: true, x: evt.clientX + 15, y: evt.clientY + 15, lines });
    const hideTip = () => setTip((s) => ({ ...s, show: false }));

    const stagingAnimClass = state.animationMode === "commit" ? "anim-commit" : "";

    return (
        <div className="visualization-area">
            <AnimationEngine />
            <div className="view-options">
                <button
                    className="btn btn-ghost"
                    style={{padding:"6px 10px", marginRight: "12px"}}
                    onClick={() => setCloneModalOpen(true)}
                >
                    저장소 복제
                </button>

                <ToggleSwitch checked={simplified} onChange={setSimplified} label="단순화 보기" />
            </div>

            <div className="stage">
                <GraphPanel
                    side="local"
                    height={graphHeight}
                    positions={localPos}
                    labels={localBranchLabels}
                    lineSegments={localLineSegments}
                    lastAction={lastAction}
                    nodeColor={(_hash, node) => branchColorMap[node.branch] || localBranchLabels[node.branch]?.color}
                    onShowTip={showTip}
                    onHideTip={hideTip}
                    onLabelClick={handleOpenMergeModal}
                    onNodeClick={handleReset}
                >
                    {showStaging && <StagingArea files={state.stagingArea} animationClass={stagingAnimClass} />}
                </GraphPanel>

                <GraphPanel
                    side="remote"
                    height={graphHeight}
                    positions={remotePos}
                    labels={remoteBranchLabels}
                    lineSegments={remoteLineSegments}
                    lastAction={lastAction}
                    nodeColor={(hash, node) => {
                        // 로컬에 같은 커밋이 있으면 로컬 브랜치 색을 따른다
                        const originBranchName = localPos[hash]?.branch;
                        return originBranchName
                            ? localBranchLabels[originBranchName]?.color
                            : remoteBranchLabels[node.branch]?.color;
                    }}
                    onShowTip={showTip}
                    onHideTip={hideTip}
                />
            </div>

            <MergeBranchModal
                open={mergeModalState.open}
                onClose={() => setMergeModalState({ open: false, sourceBranch: null })}
                sourceBranch={mergeModalState.sourceBranch}
                targetOptions={Object.keys(localBranchLabels).filter((b) => b !== mergeModalState.sourceBranch)}
                onConfirm={handleMergeConfirm}
            />

            <ResetConfirmModal
                open={resetModalState.open}
                onClose={() => setResetModalState({ open: false, commitHash: null, commitMessage: null })}
                onConfirm={handleResetConfirm}
                commitHash={resetModalState.commitHash || ""}
                commitMessage={resetModalState.commitMessage || ""}
            />

            <ConflictModal />

            <CloneRepoModal
                open={isCloneModalOpen}
                onClose={() => setCloneModalOpen(false)}
                onRepoCloned={(clonedRepo: Repo) => {
                    // 새 저장소를 사이드바에 추가하고 선택합니다.
                    dispatch({ type: "ADD_REPO", payload: clonedRepo });
                    dispatch({ type: "SELECT_REPO", payload: repoIdOf(clonedRepo) });
                }}
                sourceRepoId={repoId}
                sourceRepoName={repoName}
                onManageCollaborators={(targetRepoId) => {
                    dispatch({ type: "OPEN_COLLABORATOR_MODAL", payload: { repoId: targetRepoId ?? null } });
                }}
            />

            <div className="view-options">
                <ToggleSwitch checked={simplified} onChange={setSimplified} label="단순화 보기" />
                <button className="btn btn-ghost" style={{padding:"6px 10px"}} onClick={()=>setHelpOpen(true)}>?</button>
            </div>
            {helpOpen && <BeginnerHelp onClose={()=>setHelpOpen(false)} />}

            {tip.show && (
                <div
                    style={{
                        position: "fixed",
                        left: tip.x,
                        top: tip.y,
                        maxWidth: 420,
                        fontSize: 12,
                        lineHeight: 1.4,
                        background: "rgba(17,24,39,0.95)",
                        color: "white",
                        padding: "8px 10px",
                        borderRadius: 8,
                        zIndex: 1250,
                    }}
                >
                    {tip.lines.map((l, i) => (
                        <div key={i}>{l}</div>
                    ))}
                </div>
            )}
        </div>
    );
}