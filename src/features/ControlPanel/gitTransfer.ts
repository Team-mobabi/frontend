import type { Branch, BranchListResponse, GraphCommit, RepoGraph } from "../../types/api";

// 그래프 API가 커밋별 변경 파일을 내려주는 경우가 있다
type CommitWithFiles = GraphCommit & { files?: unknown[] };

// findMissingCommits 결과: 분기(diverged) 정보를 배열에 덧붙여 반환한다
export interface MissingCommits extends Array<GraphCommit> {
    _diverged?: boolean;
    _behind?: number;
}

type BranchListInput = BranchListResponse | (Branch | string)[] | null | undefined;

// 브랜치 목록 응답을 이름 배열로 (비어 있으면 ["main"])
export function normalizeBranchList(input: BranchListInput): string[] {
    if (!input) return ["main"];
    if (!Array.isArray(input) && Array.isArray(input.branches)) {
        return normalizeBranchList(input.branches);
    }
    if (Array.isArray(input)) {
        const names = input.map((b) => (typeof b === "string" ? b : b?.name || "")).filter(Boolean);
        return names.length ? names : ["main"];
    }
    return Object.keys(input || {}).length ? Object.keys(input || {}) : ["main"];
}

function fileListOf(c: CommitWithFiles | null | undefined): string[] {
    const a = c?.files || [];
    if (Array.isArray(a) && a.length) return a.map(String);
    return [];
}

// 로컬/리모트 그래프를 비교해 올리거나(push) 가져올(pull) 커밋을 찾는다
export function findMissingCommits(graph: RepoGraph | null | undefined, branch: string, direction: "push" | "pull"): MissingCommits {
    const local = graph?.local ?? {};
    const remote = graph?.remote ?? {};
    const lb = local?.branches?.[branch] || [];
    const rb = remote?.branches?.[branch] || [];
    const lhashes = lb.map((c) => c?.hash || "");
    const rhashes = rb.map((c) => c?.hash || "");

    if (direction === "push") {
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

        // 양쪽 모두 상대에게 없는 커밋이 있을 때만 분기(diverged) 상태. 원격만 앞서 있으면 단순히 뒤처진 것
        const behind = remoteBaseIndex;
        if (behind > 0 && localBaseIndex > 0) {
            const commits: MissingCommits = lb.slice(0, localBaseIndex);
            commits._diverged = true;
            commits._behind = behind;
            return commits;
        }

        // 정상: Local만 앞서 있음
        return lb.slice(0, localBaseIndex);
    }

    // 로컬의 커밋들 중 리모트에도 있는 것 찾기 (공통 조상)
    let baseIndex = -1;
    for (let i = 0; i < lhashes.length; i++) {
        const idx = rhashes.indexOf(lhashes[i]);
        if (idx !== -1) {
            baseIndex = idx;
            break;
        }
    }
    // baseIndex 이전의 커밋들이 pull할 커밋들
    return baseIndex !== -1 ? rb.slice(0, baseIndex) : rb;
}

export function summarizeFiles(commits: GraphCommit[]): string[] {
    return Array.from(new Set(commits.flatMap((c) => fileListOf(c)).map(String)));
}

// 로컬·원격이 갈라진 상태에서 가져오기 전에 확인
export function confirmDivergedPull(ahead: number, behind: number): boolean {
    return window.confirm(
        `⚠️ 주의: 로컬과 원격 가지가 분기되었습니다.\n\n` +
            `로컬: ${ahead}개 저장 앞섬 (아직 올리기 안 됨)\n` +
            `원격: ${behind}개 저장 앞섬\n\n` +
            `가져오기를 실행하면 로컬의 변경사항이 합쳐집니다.\n` +
            `(되돌리기를 했다면 되돌리기가 취소됩니다!)\n\n` +
            `그래도 가져오시겠습니까?`,
    );
}

// 서버가 앞서 있을 때 강제 올리기 전에 확인
export function confirmForcePush(behind: number): boolean {
    return window.confirm(
        `⚠️ 경고: 서버 저장소가 내 저장소보다 ${behind}개의 저장 앞서 있습니다.\n\n` +
            `이 상태에서 올리기를 하면 서버의 저장이 삭제될 수 있습니다.\n` +
            `일반적으로 먼저 "가져오기"를 해야 합니다.\n\n` +
            `그래도 강제로 올리시겠습니까? (강제 올리기)`,
    );
}
