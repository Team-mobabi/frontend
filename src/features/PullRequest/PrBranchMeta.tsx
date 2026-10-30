import type { PullRequest } from "../../types/api";
import { getUserDisplayName } from "../../utils/userDisplay";

interface PrBranchMetaProps {
    pr: Pick<PullRequest, "author" | "sourceBranch" | "targetBranch">;
}

// "{작성자}가 [source] → [target] 가지로 합치기를 요청합니다."
export default function PrBranchMeta({ pr }: PrBranchMetaProps) {
    return (
        <div className="pr-meta">
            {getUserDisplayName(pr.author)}가
            <span className="branch-chip">{pr.sourceBranch}</span>
            →
            <span className="branch-chip">{pr.targetBranch}</span>
            가지로 합치기를 요청합니다.
        </div>
    );
}
