import type { PullRequest } from "../../types/api";
import { prStateLabel } from "./prState";

interface PrStateChipProps {
    pr: Pick<PullRequest, "state" | "status">;
}

export default function PrStateChip({ pr }: PrStateChipProps) {
    return (
        <span className="pr-state-chip" style={{ textTransform: "uppercase" }}>
            {prStateLabel(pr)}
        </span>
    );
}
