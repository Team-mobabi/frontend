import React, { useEffect, useMemo, useState } from "react";
import { useGit } from "../GitCore/GitContext.jsx";
import { api } from "../API";
import CommitNode from "./CommitNode";
import BranchLine from "./BranchLine";
import AnimationEngine from "./AnimationEngine";
import StagingArea from "./StagingArea";
import MergeBranchModal from "../../components/Modal/MergeBranchModal.jsx";
import ConflictModal from "../../components/Modal/ConflictModal.jsx";
import ResetConfirmModal from "../../components/Modal/ResetConfirmModal.jsx";
import BeginnerHelp from "../../pages/BeginnerHelp.jsx";


const Y = 85;
const X = 180;

/** 충돌/진행중 오류 감지 */
function isConflictError(err) {
    const status = err?.status;
    const msg = (err?.data?.message || err?.message || "").toLowerCase();
    if (status === 409) return true;
    return (
        /conflict/.test(msg) ||
        /unmerged/.test(msg) ||
        /merging is not possible/.test(msg) ||
        /exiting because of an unresolved conflict/.test(msg) ||
        /merge failed/.test(msg)
    );
}
function isMergeInProgress(err) {
    const msg = (err?.data?.message || err?.message || "").toLowerCase();
    return /merge_head exists/.test(msg) || /you have not concluded your merge/.test(msg);
}

function normGraph(raw) {
    if (!raw) return {
        branches: {},
        currentBranch: null,
        branchHeads: {},
        commits: [],
        forkPoints: {}
    };

    // 새 API 응답 구조 (commits, branchHeads, forkPoints 포함)
    if (raw.branches && typeof raw.branches === "object") {
        return {
            branches: raw.branches,
            currentBranch: raw.currentBranch || null,
            branchHeads: raw.branchHeads || {},
            commits: raw.commits || [],
            forkPoints: raw.forkPoints || {}
        };
    }

    // 레거시 구조 대응
    const arr = raw.commits || [];
    const name = raw.currentBranch || "main";
    return {
        branches: { [name]: Array.isArray(arr) ? arr : [] },
        currentBranch: name,
        branchHeads: {},
        commits: arr,
        forkPoints: {}
    };
}

function calcPositions(repoState) {
    const commitPositions = {};
    const commits = repoState?.commits || [];
    const branchHeads = repoState?.branchHeads || {};
    const forkPoints = repoState?.forkPoints || {};

    // commits 배열이 있으면 새 레이아웃 사용
    if (commits.length > 0) {

        const MAIN_X = 120;        // main 브랜치 중심 축
        const BRANCH_OFFSET = 180; // 분기 브랜치 간격

        // 브랜치별 x 좌표 할당
        const branchX = { main: MAIN_X };
        let nextX = MAIN_X + BRANCH_OFFSET;
        Object.keys(branchHeads).forEach(branchName => {
            if (branchName !== 'main' && !branchX[branchName]) {
                branchX[branchName] = nextX;
                nextX += BRANCH_OFFSET;
            }
        });

        console.log('[calcPositions] branchX mapping:', branchX);
        console.log('[calcPositions] branchHeads:', branchHeads);
        console.log('[calcPositions] forkPoints:', forkPoints);

        // commits를 역순으로 처리 (오래된 커밋이 위에)
        const reversedCommits = [...commits].reverse();

        // Merge 커밋의 부모 추적 (원래 브랜치 유지를 위해)
        const mergeCommits = reversedCommits.filter(c => c.isMerge);
        const branchCommitMap = new Map(); // 각 커밋이 원래 어느 브랜치인지 저장

        // 각 브랜치의 HEAD부터 역추적하여 원래 브랜치 표시
        Object.entries(branchHeads).forEach(([branchName, headHash]) => {
            if (branchName === 'main') return;

            const forkPoint = forkPoints[branchName];

            let currentHash = headHash;
            const visited = new Set();
            let isFirstCommit = true; // HEAD 커밋 추적

            // HEAD부터 forkPoint까지의 커밋들을 해당 브랜치로 표시
            while (currentHash && !visited.has(currentHash)) {
                visited.add(currentHash);
                const commit = commits.find(c =>
                    c.hash === currentHash || c.hash.startsWith(currentHash) ||
                    c.shortHash === currentHash || currentHash.startsWith(c.hash)
                );

                if (!commit) break;

                // forkPoint가 있으면 forkPoint에 도달하면 중단
                if (forkPoint && (commit.hash === forkPoint || commit.hash.startsWith(forkPoint))) {
                    break;
                }

                const commitBranches = commit.branches || [];

                // HEAD 커밋은 무조건 해당 브랜치로 마킹
                if (isFirstCommit) {
                    branchCommitMap.set(commit.hash, branchName);
                    isFirstCommit = false;
                    currentHash = commit.parents?.[0];
                    continue;
                }

                // forkPoint가 없는 경우: 이 커밋이 현재 브랜치에만 속하는지 확인
                // forkPoint가 없고, 커밋이 main 브랜치에도 속한 경우 중단
                if (!forkPoint && commitBranches.includes('main')) {
                    break;
                }

                // 이 커밋을 현재 브랜치로 마킹 (나중에 덮어쓰지 않도록 조건부)
                if (!branchCommitMap.has(commit.hash)) {
                    branchCommitMap.set(commit.hash, branchName);
                }

                currentHash = commit.parents?.[0];
            }
        });

        let y = 50;
        reversedCommits.forEach((commit, idx) => {
            const fullHash = commit.hash || `tmp-${idx}`;
            const shortHash = commit.shortHash || fullHash.substring(0, 7);
            const branches = commit.branches || [];

            // 브랜치 결정 로직
            let primaryBranch = 'main';

            // 1. isHead가 있으면 그 브랜치의 HEAD 커밋
            if (commit.isHead) {
                primaryBranch = commit.isHead;
            }
            // 2. branchCommitMap에 있으면 원래 브랜치 사용 (merge 전 브랜치 유지)
            else if (branchCommitMap.has(fullHash)) {
                primaryBranch = branchCommitMap.get(fullHash);
            }
            // 3. main 브랜치에 속한 커밋 → main에 배치
            else if (branches.includes('main')) {
                primaryBranch = 'main';
            }
            // 4. main에 속하지 않은 커밋 → 첫 번째 브랜치에 배치
            else if (branches.length > 0) {
                primaryBranch = branches[0];
            }

            const x = branchX[primaryBranch] || MAIN_X;

            const nodeData = {
                x,
                y,
                branch: primaryBranch,
                branches: branches, // 속한 모든 브랜치
                message: commit.message || "",
                author: commit.author || "",
                committedAt: commit.committedAt || "",
                files: commit.files || [],
                parents: commit.parents || [],
                isMerge: commit.isMerge || false,
                isHead: commit.isHead || null,
                shortHash: shortHash,
            };

            // 전체 해시와 짧은 해시 모두를 키로 저장 (유연한 매칭을 위해)
            commitPositions[fullHash] = nodeData;
            if (shortHash !== fullHash) {
                commitPositions[shortHash] = nodeData;
            }

            y += Y;
        });

        return commitPositions;
    }

    // 레거시: branches 구조만 있는 경우
    const branchMap = repoState?.branches || {};
    let y = 50, x = 120;
    Object.entries(branchMap).forEach(([branchName, commits]) => {
        let cy = y;
        (commits || []).forEach((c, i) => {
            const h = c.hash || `tmp-${branchName}-${i}`;
            if (!commitPositions[h]) {
                commitPositions[h] = {
                    x, y: cy, branch: branchName,
                    branches: [branchName],
                    message: c.message || "",
                    files: c.files || [],
                    parents: c.parents || [],
                    isMerge: false,
                    isHead: null,
                    shortHash: h.substring(0, 7),
                };
                cy += Y;
            }
        });
        x += X;
    });
    return commitPositions;
}

/** 최근 액션 고려한 선(에지) 메타 생성 */
function calcLineSegments(positions, lastAction, branchColorMap = {}) {
    const segments = {};

    const uniqueNodes = new Map();
    Object.entries(positions).forEach(([hash, node]) => {
        if (!uniqueNodes.has(node)) {
            uniqueNodes.set(node, hash);
        }
    });

    // 처리된 부모-자식 쌍 추적 (중복 방지)
    const processedPairs = new Set();

    uniqueNodes.forEach((childHash, childNode) => {
        const isMergeChild = (childNode.parents || []).length > 1;

        (childNode.parents || []).forEach((parentHash) => {
            let parentNode = positions[parentHash];

            // 직접 매칭 실패 시, startsWith로 찾기
            if (!parentNode) {
                const parentEntry = Object.entries(positions).find(([hash, _]) =>
                    hash.startsWith(parentHash) || parentHash.startsWith(hash)
                );
                if (parentEntry) {
                    parentNode = parentEntry[1];
                }
            }

            if (!parentNode) {
                console.warn(`[calcLineSegments] Parent not found: ${parentHash} for child ${childHash}`);
                return;
            }

            // 중복 방지: 같은 부모-자식 쌍은 한 번만 처리
            const pairKey = `${parentNode.x},${parentNode.y}->${childNode.x},${childNode.y}`;
            if (processedPairs.has(pairKey)) {
                return;
            }
            processedPairs.add(pairKey);

            const key = `line-${parentHash}-${childHash}`;
            const type = isMergeChild ? "merge" : "normal";

            const recent =
                lastAction?.type === "merge" &&
                (
                    (lastAction.commitHash && childHash === lastAction.commitHash) ||
                    (!lastAction.commitHash && childNode.branch === (lastAction.target || childNode.branch))
                );

            // branchColorMap을 사용하여 선 색상 결정
            let lineColor;
            if (parentNode.branch !== childNode.branch) {
                lineColor = branchColorMap[childNode.branch] || branchColorMap[parentNode.branch] || "#e5e8f0";
            } else {
                lineColor = branchColorMap[childNode.branch] || "#e5e8f0";
            }

            segments[key] = {
                points: [parentNode, childNode],
                color: lineColor,
                type,
                recent,
            };
        });
    });

    return segments;
}

function calcBranchLabels(positions, branchHeads) {
    const labels = {};
    const colors = ["#4B5AE4", "#22c55e", "#f59e0b", "#ef4444", "#6366f1", "#8b5cf6"];

    // main을 파란색으로 고정
    const branchColorMap = { main: "#4B5AE4" };
    let colorIndex = 1;

    // branchHeads에서 모든 브랜치 이름 가져오기 (커밋 없는 브랜치도 포함)
    const allBranchNames = Object.keys(branchHeads || {});

    // positions에서도 브랜치 이름 가져오기
    const positionBranches = [...new Set(Object.values(positions).map((p) => p.branch))];

    // 합쳐서 중복 제거
    const branchNames = [...new Set([...allBranchNames, ...positionBranches])];

    // main의 HEAD 커밋 해시 저장
    const mainHeadHash = branchHeads?.main;

    // main을 먼저 처리
    if (branchNames.includes('main')) {
        const mainNodes = Object.values(positions).filter((p) => p.branch === 'main' || (p.branches && p.branches.includes('main')));
        if (mainNodes.length > 0) {
            mainNodes.sort((a, b) => a.y - b.y);
            labels.main = { point: mainNodes[0], color: branchColorMap.main };
        }
    }

    // 나머지 브랜치 처리
    branchNames.filter(b => b !== 'main').forEach((branchName) => {
        const color = colors[colorIndex % colors.length];
        branchColorMap[branchName] = color;
        colorIndex++;

        // 이 브랜치가 main과 같은 커밋을 가리키는지 확인
        const branchHeadHash = branchHeads?.[branchName];
        if (mainHeadHash && branchHeadHash &&
            (mainHeadHash === branchHeadHash || mainHeadHash.startsWith(branchHeadHash) || branchHeadHash.startsWith(mainHeadHash))) {
            // main과 같은 커밋을 가리키면 라벨을 표시하지 않음
            return;
        }

        // 해당 브랜치에만 속한 노드 찾기 (이 브랜치의 고유 커밋)
        // branches 배열에 이 브랜치만 포함되거나, branch가 이 브랜치인 노드
        let exclusiveNodes = Object.values(positions).filter((p) => {
            // 이 브랜치 전용 커밋: branch가 이 브랜치이거나
            if (p.branch === branchName) return true;
            // branches 배열이 이 브랜치만 포함하는 경우
            if (p.branches && p.branches.length === 1 && p.branches[0] === branchName) return true;
            return false;
        });

        // 고유 커밋이 없으면 이 브랜치에 속한 모든 노드 중에서 선택 (하위 호환성)
        if (exclusiveNodes.length === 0) {
            exclusiveNodes = Object.values(positions).filter((p) =>
                p.branch === branchName || (p.branches && p.branches.includes(branchName))
            );
        }

        // 노드를 찾지 못하면 branchHeads를 사용해서 해당 커밋 찾기
        if (exclusiveNodes.length === 0 && branchHeads && branchHeads[branchName]) {
            const headHash = branchHeads[branchName];
            const headNode = Object.entries(positions).find(([hash, _]) => hash.startsWith(headHash));
            if (headNode) {
                exclusiveNodes = [headNode[1]];
            }
        }

        if (exclusiveNodes.length > 0) {
            // y 좌표가 가장 작은 것 (가장 위에 있는 것) 선택
            exclusiveNodes.sort((a, b) => a.y - b.y);
            labels[branchName] = { point: exclusiveNodes[0], color };
        }
    });

    return { labels, branchColorMap };
}

export default function RepositoryView() {
    const { state, dispatch } = useGit();
    const repoId = state?.selectedRepoId;
    const [graph, setGraph] = useState({ local: null, remote: null });
    const [tip, setTip] = useState({ show: false, x: 0, y: 0, lines: [] });
    const [mergeModalState, setMergeModalState] = useState({ open: false, sourceBranch: null });
    const [resetModalState, setResetModalState] = useState({ open: false, commitHash: null, commitMessage: null });
    const [simplified, setSimplified] = useState(false);
    const [showStaging, setShowStaging] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);

    // 🆕 최근 액션(병합) 하이라이트 상태
    const [lastAction, setLastAction] = useState(null);

    useEffect(() => {
        if (!repoId) { setGraph({ local: null, remote: null }); return; }
        api.repos
            .graph(repoId, { simplified: simplified ? "true" : undefined })
            .then((g) => {
                // Helper function: branchHeads에서 시작하여 도달 가능한 모든 커밋 수집
                const collectReachableCommits = (branchHeads, allCommits) => {
                    const reachable = new Set();
                    const queue = Object.values(branchHeads || {}).filter(Boolean);
                    const visited = new Set();

                    while (queue.length > 0) {
                        const currentHash = queue.shift();
                        if (!currentHash || visited.has(currentHash)) continue;
                        visited.add(currentHash);

                        // Find commit by hash (exact match or prefix match)
                        const commit = allCommits.find(c =>
                            c.hash === currentHash ||
                            c.hash.startsWith(currentHash) ||
                            c.shortHash === currentHash ||
                            currentHash.startsWith(c.hash)
                        );

                        if (commit) {
                            reachable.add(commit.hash);
                            // Add all parents to queue
                            if (commit.parents && Array.isArray(commit.parents)) {
                                queue.push(...commit.parents);
                            }
                        }
                    }

                    return reachable;
                };

                // Local branches에서 도달 가능한 커밋만 필터링
                const localBranchHeads = g?.local?.branchHeads || g?.branchHeads || {};
                const localReachable = collectReachableCommits(localBranchHeads, g?.commits || []);

                const localCommits = (g?.commits || []).filter(c => localReachable.has(c.hash));

                // Remote branches에서 도달 가능한 커밋만 필터링
                const remoteBranchHeads = g?.remote?.branchHeads || {};
                const remoteReachable = collectReachableCommits(remoteBranchHeads, g?.commits || []);

                // Remote 그래프에서는 remoteIsHead를 isHead로 사용
                const remoteCommits = (g?.commits || [])
                    .filter(c => remoteReachable.has(c.hash))
                    .map(c => ({ ...c, isHead: c.remoteIsHead }));

                const localData = {
                    ...g?.local,
                    currentBranch: g?.currentBranch,
                    commits: localCommits,
                    branchHeads: localBranchHeads,
                    forkPoints: g?.forkPoints,
                };
                const remoteData = {
                    ...g?.remote,
                    currentBranch: g?.currentBranch,
                    commits: remoteCommits,
                    branchHeads: remoteBranchHeads,
                    forkPoints: g?.forkPoints,
                };

                // Debug: Remote 데이터 확인
                console.log('[RepositoryView] Remote branchHeads:', remoteBranchHeads);
                console.log('[RepositoryView] Remote forkPoints:', g?.forkPoints);
                console.log('[RepositoryView] Remote commits sample (with branches):',
                    remoteCommits.slice(0, 5).map(c => ({
                        hash: c.shortHash,
                        message: c.message,
                        branches: c.branches,
                        isHead: c.isHead
                    }))
                );

                const normalized = { local: normGraph(localData), remote: normGraph(remoteData) };

                setGraph(normalized);
            })
            .catch((err) => {
                console.error('[RepositoryView] Graph API Error:', err);
                setGraph({ local: null, remote: null });
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

    const localBranchLabels = localBranchData.labels || localBranchData;
    const remoteBranchLabels = remoteBranchData.labels || remoteBranchData;
    const branchColorMap = localBranchData.branchColorMap || {};

    const localLineSegments = useMemo(() => calcLineSegments(localPos, lastAction, branchColorMap), [localPos, lastAction, branchColorMap]);
    const remoteLineSegments = useMemo(() => calcLineSegments(remotePos, lastAction, branchColorMap), [remotePos, lastAction, branchColorMap]);

    const handleOpenMergeModal = (sourceBranch) => setMergeModalState({ open: true, sourceBranch });

    const handleMergeConfirm = async (targetBranch) => {
        const { sourceBranch } = mergeModalState;
        setMergeModalState({ open: false, sourceBranch: null });
        if (!sourceBranch || !targetBranch) return;
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
            if (isMergeInProgress(e)) {
                dispatch({ type: "OPEN_CONFLICT_MODAL" });
                return;
            }
            if (isConflictError(e)) {
                dispatch({ type: "OPEN_CONFLICT_MODAL" });
            } else {
                alert(`병합 실패: ${e?.message || "Unknown error"}`);
            }
        }
    };

    const handleReset = (hash) => {
        const commits = graph.local?.commits || [];
        const commit = commits.find(c =>
            c.hash === hash ||
            c.hash.startsWith(hash) ||
            c.shortHash === hash ||
            hash.startsWith(c.hash)
        );

        const commitMessage = commit?.message || localPos[hash]?.message || "커밋 메시지 없음";
        setResetModalState({ open: true, commitHash: hash, commitMessage });
    };

    const handleResetConfirm = async (mode) => {
        const { commitHash } = resetModalState;
        setResetModalState({ open: false, commitHash: null, commitMessage: null });

        if (!commitHash) return;

        try {
            console.log('[Reset] 시작:', { commitHash, mode });
            const resetResult = await api.repos.reset(repoId, { commitHash, mode });
            console.log('[Reset] 결과:', resetResult);

            // 0.5초 대기 (백엔드 상태 완전히 반영되도록)
            await new Promise(resolve => setTimeout(resolve, 500));

            // 그래프 즉시 새로고침
            const g = await api.repos.graph(repoId);
            console.log('[Reset] 새 그래프:', g);

            // Helper function: branchHeads에서 시작하여 도달 가능한 모든 커밋 수집
            const collectReachableCommits = (branchHeads, allCommits) => {
                const reachable = new Set();
                const queue = Object.values(branchHeads || {}).filter(Boolean);
                const visited = new Set();

                while (queue.length > 0) {
                    const currentHash = queue.shift();
                    if (!currentHash || visited.has(currentHash)) continue;
                    visited.add(currentHash);

                    const commit = allCommits.find(c =>
                        c.hash === currentHash ||
                        c.hash.startsWith(currentHash) ||
                        c.shortHash === currentHash ||
                        currentHash.startsWith(c.hash)
                    );

                    if (commit) {
                        reachable.add(commit.hash);
                        if (commit.parents && Array.isArray(commit.parents)) {
                            queue.push(...commit.parents);
                        }
                    }
                }

                return reachable;
            };

            // Local branches에서 도달 가능한 커밋만 필터링
            const localBranchHeads = g?.local?.branchHeads || g?.branchHeads || {};
            const localReachable = collectReachableCommits(localBranchHeads, g?.commits || []);
            const localCommits = (g?.commits || []).filter(c => localReachable.has(c.hash));

            // Remote branches에서 도달 가능한 커밋만 필터링
            const remoteBranchHeads = g?.remote?.branchHeads || {};
            const remoteReachable = collectReachableCommits(remoteBranchHeads, g?.commits || []);
            const remoteCommits = (g?.commits || []).filter(c => remoteReachable.has(c.hash));

            const localData = {
                ...g?.local,
                currentBranch: g?.currentBranch,
                commits: localCommits,
                branchHeads: localBranchHeads,
                forkPoints: g?.forkPoints,
            };
            const remoteData = {
                ...g?.remote,
                currentBranch: g?.currentBranch,
                commits: remoteCommits,
                branchHeads: remoteBranchHeads,
                forkPoints: g?.forkPoints,
            };

            const normalized = { local: normGraph(localData), remote: normGraph(remoteData) };
            setGraph(normalized);

            alert(`Reset 완료: ${mode} mode`);
        } catch (e) {
            console.error('[Reset] 실패:', e);
            alert(`Reset 실패: ${e?.message || "Unknown error"}`);
        }
    };

    const graphHeight = useMemo(() => {
        const allPositions = [...Object.values(localPos), ...Object.values(remotePos)];
        return allPositions.length === 0 ? 260 : Math.max(...allPositions.map((p) => p.y)) + 80;
    }, [localPos, remotePos]);

    const showTip = (evt, lines) => setTip({ show: true, x: evt.clientX + 15, y: evt.clientY + 15, lines: lines.filter(Boolean) });
    const hideTip = () => setTip((s) => ({ ...s, show: false }));

    const stagingAnimClass = state.animationMode === "commit" ? "anim-commit" : "";

    return (
        <div className="visualization-area">
            <AnimationEngine />
            <div className="view-options">
                <label className="toggle-switch">
                    <input type="checkbox" checked={simplified} onChange={() => setSimplified((s) => !s)} />
                    <span className="slider"></span>
                </label>
                <span>단순화 보기</span>
            </div>

            <div className="stage">
                {/* Local */}
                <div className="panel">
                    <h3>Local</h3>
                    <div className="commit-graph" style={{ height: `${graphHeight}px`, position: "relative" }}>

                        {showStaging && <StagingArea files={state.stagingArea} animationClass={stagingAnimClass} />}

                        <BranchLine lineSegments={localLineSegments} />
                        {Object.entries(localBranchLabels).map(([name, info]) => (
                            <div
                                key={`label-l-${name}`}
                                className="branch-label"
                                style={{ left: info.point.x, top: info.point.y, borderColor: info.color, color: info.color }}
                                onClick={() => handleOpenMergeModal(name)}
                            >
                                {name}
                            </div>
                        ))}

                        {Object.entries(localPos).map(([hash, node]) => {
                            const isMergeCommit = node.isMerge || (node.parents && node.parents.length > 1);
                            const recentNode = lastAction?.type === "merge" && lastAction?.commitHash && hash === lastAction.commitHash;

                            // 분기점 확인
                            const forkPoints = graph.local?.forkPoints || {};
                            const isForkPoint = Object.values(forkPoints).some(fp => fp && hash.startsWith(fp));
                            const forkBranches = Object.entries(forkPoints)
                                .filter(([_, fp]) => fp && hash.startsWith(fp))
                                .map(([branchName, _]) => branchName);

                            const tipLines = [
                                "커밋(저장 기록)입니다.",
                                `메시지: ${node.message || "(없음)"}`,
                                `식별자: ${node.shortHash || hash.slice(0,7)}`,
                            ];

                            if (node.author) tipLines.push(`작성자: ${node.author}`);
                            if (isMergeCommit) tipLines.push("🔀 병합 커밋");
                            if (node.isHead) tipLines.push(`📍 ${node.isHead} 브랜치의 최신 커밋`);

                            return (
                                <React.Fragment key={`l-${hash}`}>
                                    <CommitNode
                                        position={node}
                                        isMerge={isMergeCommit}
                                        recent={!!recentNode}
                                        color={branchColorMap[node.branch] || (localBranchLabels[node.branch] || {}).color}
                                        onClick={() => handleReset(hash)}
                                        onMouseEnter={(e) => showTip(e, tipLines)}
                                        onMouseLeave={hideTip}
                                        title="클릭하여 이 커밋으로 되돌리기 (Soft/Hard 선택 가능)"
                                    />
                                    <div
                                        style={{
                                            position: "absolute",
                                            left: node.x,
                                            top: node.y,
                                            transform: "translateX(-50%)",
                                            paddingTop: "22px",
                                            width: 180,
                                            textAlign: "center",
                                            pointerEvents: "none",
                                            zIndex: 0,
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: 12,
                                                fontWeight: 600,
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                padding: "2px 4px",
                                                background: "rgba(255,255,255,0.7)",
                                                backdropFilter: "blur(4px)",
                                                borderRadius: "4px",
                                            }}
                                        >
                                            {node.message}
                                        </div>
                                        <div style={{ display: "inline-flex", gap: 6, alignItems: "center", marginTop: 4, fontSize: 11, color: "var(--muted)" }}>
                                            <span>{node.shortHash || hash.slice(0, 7)}</span>
                                            {isMergeCommit && <span className="chip-merge">Merge</span>}
                                            {node.isHead && <span className="chip-head" style={{background: "#f59e0b", color: "white", padding: "2px 6px", borderRadius: "4px", fontSize: "10px"}}>HEAD</span>}
                                            {lastAction?.type === "merge" && lastAction?.fastForward && node.branch === lastAction.target && (
                                                <span className="chip-ff">FF</span>
                                            )}
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>

                {/* Remote */}
                <div className="panel">
                    <h3>Remote</h3>
                    <div className="commit-graph" style={{ height: `${graphHeight}px`, position: "relative" }}>
                        {/*<GraphLegend />*/}
                        <BranchLine lineSegments={remoteLineSegments} remote />
                        {Object.entries(remoteBranchLabels).map(([name, info]) => (
                            <div
                                key={`label-r-${name}`}
                                className="branch-label"
                                style={{ left: info.point.x, top: info.point.y, borderColor: info.color, color: info.color, cursor: "default" }}
                            >
                                {name}
                            </div>
                        ))}
                        {Object.entries(remotePos).map(([hash, node]) => {
                            const isMergeCommit = node.parents && node.parents.length > 1;
                            const originalLocalCommit = localPos[hash];
                            const originBranchName = originalLocalCommit ? originalLocalCommit.branch : null;
                            const originColor = originBranchName
                                ? (localBranchLabels[originBranchName] || {}).color
                                : (remoteBranchLabels[node.branch] || {}).color;
                            const recentNode = lastAction?.type === "merge" && lastAction?.commitHash && hash === lastAction.commitHash;

                            return (
                                <React.Fragment key={`r-${hash}`}>
                                    <CommitNode
                                        position={node}
                                        isMerge={isMergeCommit}
                                        recent={!!recentNode}
                                        color={originColor}
                                        onMouseEnter={(e) => showTip(e, [`Commit: ${hash}`, `Message: ${node.message}`, `Branch: ${node.branch}`])}
                                        onMouseLeave={hideTip}
                                    />
                                    <div
                                        style={{
                                            position: "absolute",
                                            left: node.x,
                                            top: node.y,
                                            transform: "translateX(-50%)",
                                            paddingTop: "22px",
                                            width: 180,
                                            textAlign: "center",
                                            pointerEvents: "none",
                                            zIndex: 1,
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: 12,
                                                fontWeight: 600,
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                padding: "2px 4px",
                                                background: "rgba(255,255,255,0.7)",
                                                backdropFilter: "blur(4px)",
                                                borderRadius: "4px",
                                            }}
                                        >
                                            {node.message}
                                        </div>
                                        <div style={{ display: "inline-flex", gap: 6, alignItems: "center", marginTop: 4, fontSize: 11, color: "var(--muted)" }}>
                                            <span>{hash.slice(0, 7)}</span>
                                            {isMergeCommit && <span className="chip-merge">Merge</span>}
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
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

            <div className="view-options">
                <label className="toggle-switch">
                    <input type="checkbox" checked={simplified} onChange={() => setSimplified(s=>!s)} />
                    <span className="slider"></span>
                </label>
                <span>단순화 보기</span>
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
