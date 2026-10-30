import { createLogger } from "../../lib/logger";
import type { GraphCommit, GraphSide, RepoGraph } from "../../types/api";
import type { LineSegment, Point } from "./graphPath";

// 커밋 그래프 레이아웃 계산 (순수 함수 모음)

const log = createLogger("graphLayout");

const Y = 85;
const X = 180;

type RawGraphCommit = GraphCommit;
type RawGraphSide = GraphSide;

export interface NormalizedGraph {
    branches: Record<string, RawGraphCommit[]>;
    currentBranch: string | null;
    branchHeads: Record<string, string>;
    commits: RawGraphCommit[];
    forkPoints: Record<string, string>;
}

export interface GraphState {
    local: NormalizedGraph | null;
    remote: NormalizedGraph | null;
}

export interface NodeData extends Point {
    branch: string;
    branches: string[];
    message: string;
    author?: string;
    committedAt?: string;
    files: unknown[];
    parents: string[];
    isMerge: boolean;
    isHead: string | null;
    shortHash: string;
}

export type Positions = Record<string, NodeData>;

export interface BranchLabel {
    point: NodeData;
    color: string;
}

export interface MergeAction {
    type: "merge";
    fastForward: boolean;
    source: string;
    target: string;
    commitHash: string | null;
    at: number;
}

export const EMPTY_GRAPH: GraphState = { local: null, remote: null };

// 전체 해시/짧은 해시가 섞여 오므로 어느 한쪽이 다른 쪽의 접두사이면 같은 커밋으로 본다
export const hashesMatch = (a: string, b: string) => a === b || a.startsWith(b) || b.startsWith(a);

export const matchesHash = (c: RawGraphCommit, hash: string) => hashesMatch(c.hash, hash) || c.shortHash === hash;

// branchHeads에서 시작하여 도달 가능한 모든 커밋 수집
function collectReachableCommits(branchHeads: Record<string, string> | undefined, allCommits: RawGraphCommit[]): Set<string> {
    const reachable = new Set<string>();
    const queue = Object.values(branchHeads || {}).filter(Boolean);
    const visited = new Set<string>();

    while (queue.length > 0) {
        const currentHash = queue.shift();
        if (!currentHash || visited.has(currentHash)) continue;
        visited.add(currentHash);

        const commit = allCommits.find(c => matchesHash(c, currentHash));

        if (commit) {
            reachable.add(commit.hash);
            if (commit.parents && Array.isArray(commit.parents)) {
                queue.push(...commit.parents);
            }
        }
    }

    return reachable;
}

// 그래프 응답을 local/remote 각각 도달 가능한 커밋만 남겨 정규화
export function buildGraphState(g: RepoGraph | null, useRemoteIsHead: boolean): GraphState {
    const allCommits = g?.commits || [];

    const localBranchHeads = g?.local?.branchHeads || g?.branchHeads || {};
    const localReachable = collectReachableCommits(localBranchHeads, allCommits);
    const localCommits = allCommits.filter(c => localReachable.has(c.hash));

    const remoteBranchHeads = g?.remote?.branchHeads || {};
    const remoteReachable = collectReachableCommits(remoteBranchHeads, allCommits);
    const remoteFiltered = allCommits.filter(c => remoteReachable.has(c.hash));
    // Remote 그래프에서는 remoteIsHead를 isHead로 사용
    const remoteCommits = useRemoteIsHead
        ? remoteFiltered.map(c => ({ ...c, isHead: c.remoteIsHead }))
        : remoteFiltered;

    const localData: RawGraphSide = {
        ...g?.local,
        currentBranch: g?.currentBranch,
        commits: localCommits,
        branchHeads: localBranchHeads,
        forkPoints: g?.forkPoints,
    };
    const remoteData: RawGraphSide = {
        ...g?.remote,
        currentBranch: g?.currentBranch,
        commits: remoteCommits,
        branchHeads: remoteBranchHeads,
        forkPoints: g?.forkPoints,
    };

    return { local: normGraph(localData), remote: normGraph(remoteData) };
}

export function normGraph(raw: RawGraphSide | null | undefined): NormalizedGraph {
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

export function calcPositions(repoState: NormalizedGraph | null): Positions {
    const commitPositions: Positions = {};
    const commits = repoState?.commits || [];
    const branchHeads = repoState?.branchHeads || {};
    const forkPoints = repoState?.forkPoints || {};

    // commits 배열이 있으면 새 레이아웃 사용
    if (commits.length > 0) {

        const MAIN_X = 120;        // main 브랜치 중심 축
        const BRANCH_OFFSET = 180; // 분기 브랜치 간격

        // 브랜치별 x 좌표 할당
        const branchX: Record<string, number> = { main: MAIN_X };
        let nextX = MAIN_X + BRANCH_OFFSET;
        Object.keys(branchHeads).forEach(branchName => {
            if (branchName !== 'main' && !branchX[branchName]) {
                branchX[branchName] = nextX;
                nextX += BRANCH_OFFSET;
            }
        });

        // commits를 역순으로 처리 (오래된 커밋이 위에)
        const reversedCommits = [...commits].reverse();

        const branchCommitMap = new Map<string, string>(); // 각 커밋이 원래 어느 브랜치인지 저장

        // 각 브랜치의 HEAD부터 역추적하여 원래 브랜치 표시
        Object.entries(branchHeads).forEach(([branchName, headHash]) => {
            if (branchName === 'main') return;

            const forkPoint = forkPoints[branchName];

            let currentHash: string | undefined = headHash;
            const visited = new Set<string>();
            let isFirstCommit = true; // HEAD 커밋 추적

            // HEAD부터 forkPoint까지의 커밋들을 해당 브랜치로 표시
            while (currentHash && !visited.has(currentHash)) {
                visited.add(currentHash);
                const target: string = currentHash;
                const commit = commits.find(c => matchesHash(c, target));

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
                primaryBranch = branchCommitMap.get(fullHash) ?? primaryBranch;
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

            const nodeData: NodeData = {
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
    const y = 50;
    let x = 120;
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
export function calcLineSegments(positions: Positions, lastAction: MergeAction | null, branchColorMap: Record<string, string> = {}): Record<string, LineSegment> {
    const segments: Record<string, LineSegment> = {};

    const uniqueNodes = new Map<NodeData, string>();
    Object.entries(positions).forEach(([hash, node]) => {
        if (!uniqueNodes.has(node)) {
            uniqueNodes.set(node, hash);
        }
    });

    // 처리된 부모-자식 쌍 추적 (중복 방지)
    const processedPairs = new Set<string>();

    uniqueNodes.forEach((childHash, childNode) => {
        const isMergeChild = (childNode.parents || []).length > 1;

        (childNode.parents || []).forEach((parentHash) => {
            let parentNode: NodeData | undefined = positions[parentHash];

            // 직접 매칭 실패 시, startsWith로 찾기
            if (!parentNode) {
                const parentEntry = Object.entries(positions).find(([hash]) => hashesMatch(hash, parentHash));
                if (parentEntry) {
                    parentNode = parentEntry[1];
                }
            }

            if (!parentNode) {
                log.debug(`Parent not found: ${parentHash} for child ${childHash}`);
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
                !!
                (
                    (lastAction.commitHash && childHash === lastAction.commitHash) ||
                    (!lastAction.commitHash && childNode.branch === (lastAction.target || childNode.branch))
                );

            // branchColorMap을 사용하여 선 색상 결정
            let lineColor: string;
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

export function calcBranchLabels(positions: Positions, branchHeads: Record<string, string> | undefined) {
    const labels: Record<string, BranchLabel> = {};
    const colors = ["#4B5AE4", "#22c55e", "#f59e0b", "#ef4444", "#6366f1", "#8b5cf6"];

    // main을 파란색으로 고정
    const branchColorMap: Record<string, string> = { main: "#4B5AE4" };
    let colorIndex = 1;

    // branchHeads에서 모든 브랜치 이름 가져오기 (커밋 없는 브랜치도 포함)
    const allBranchNames = Object.keys(branchHeads || {});

    // positions에서도 브랜치 이름 가져오기
    const positionBranches = [...new Set(Object.values(positions).map((p) => p.branch))];

    // 합쳐서 중복 제거하고 정렬하여 일관된 순서 보장
    const branchNames = [...new Set([...allBranchNames, ...positionBranches])].sort();

    // main의 HEAD 커밋 해시 저장
    const mainHeadHash = branchHeads?.main;

    // main을 먼저 처리
    if (branchNames.includes('main')) {
        const mainNodes = Object.values(positions).filter((p) => p.branch === 'main' || (p.branches && p.branches.includes('main')));
        // 다른 브랜치와 마찬가지로 main의 HEAD 커밋 옆에 라벨을 둔다 (없으면 가장 위 커밋)
        const headEntry = mainHeadHash
            ? Object.entries(positions).find(([hash, node]) => hashesMatch(hash, mainHeadHash) || node.shortHash === mainHeadHash)
            : undefined;
        if (headEntry) {
            labels.main = { point: headEntry[1], color: branchColorMap.main };
        } else if (mainNodes.length > 0) {
            mainNodes.sort((a, b) => a.y - b.y);
            labels.main = { point: mainNodes[0], color: branchColorMap.main };
        }
    }

    // 나머지 브랜치 처리 (정렬된 순서로 처리)
    branchNames.filter(b => b !== 'main').forEach((branchName) => {
        const color = colors[colorIndex % colors.length];
        branchColorMap[branchName] = color;
        colorIndex++;

        const branchHeadHash = branchHeads?.[branchName];

        // 이 브랜치가 main과 같은 커밋을 가리키는지 확인
        if (mainHeadHash && branchHeadHash && hashesMatch(mainHeadHash, branchHeadHash)) {
            // main과 같은 커밋을 가리키면 라벨을 표시하지 않음
            return;
        }

        const candidateNodes: NodeData[] = [];

        // 1. 먼저 branchHeads를 사용해서 HEAD 커밋 찾기 (가장 확실한 방법)
        if (branchHeadHash) {
            const headNodeEntry = Object.entries(positions).find(([hash, node]) =>
                hashesMatch(hash, branchHeadHash) || node.shortHash === branchHeadHash
            );
            if (headNodeEntry) {
                candidateNodes.push(headNodeEntry[1]);
            }
        }

        // 2. 해당 브랜치에만 속한 노드 찾기 (이 브랜치의 고유 커밋)
        const exclusiveNodes = Object.values(positions).filter((p) => {
            // 이 브랜치 전용 커밋: branch가 이 브랜치이거나
            if (p.branch === branchName) return true;
            // branches 배열이 이 브랜치만 포함하는 경우
            if (p.branches && p.branches.length === 1 && p.branches[0] === branchName) return true;
            return false;
        });
        candidateNodes.push(...exclusiveNodes);

        // 3. 고유 커밋이 없으면 이 브랜치에 속한 모든 노드 중에서 선택 (하위 호환성)
        if (candidateNodes.length === 0) {
            const branchNodes = Object.values(positions).filter((p) =>
                p.branch === branchName || (p.branches && p.branches.includes(branchName))
            );
            candidateNodes.push(...branchNodes);
        }

        // 4. isHead가 이 브랜치인 노드 찾기
        if (candidateNodes.length === 0) {
            const headNodes = Object.values(positions).filter((p) => p.isHead === branchName);
            candidateNodes.push(...headNodes);
        }

        // 5. 최종적으로 positions에서 브랜치 이름으로 시작하는 노드 찾기 (fallback)
        if (candidateNodes.length === 0) {
            const fallbackNodes = Object.values(positions).filter((p) => {
                // branch 속성이 브랜치 이름을 포함하거나
                if (p.branch && p.branch.includes(branchName)) return true;
                // branches 배열에 브랜치가 포함되어 있으면
                if (p.branches && p.branches.includes(branchName)) return true;
                return false;
            });
            candidateNodes.push(...fallbackNodes);
        }

        // 중복 제거 (같은 노드가 여러 번 포함될 수 있음)
        const uniqueNodes = Array.from(new Map(candidateNodes.map(node => [node.x + ',' + node.y, node])).values());

        if (uniqueNodes.length > 0) {
            // y 좌표가 가장 작은 것 (가장 위에 있는 것) 선택
            uniqueNodes.sort((a, b) => a.y - b.y);
            labels[branchName] = { point: uniqueNodes[0], color };
        }
    });

    return { labels, branchColorMap };
}
