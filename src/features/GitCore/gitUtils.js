export const repoIdOf = (r) => {
    const v = r?.id ?? r?.repoId ?? r?.repo_id ?? r?._id ?? r?.uid ?? r?.slug ?? "";
    return v == null ? "" : String(v);
};

export const normalizeRepo = (r) => ({
    ...r,
    id: repoIdOf(r),
    name: r?.name ?? r?.repoName ?? r?.title ?? r?.slug ?? r?.id ?? "repo",
    defaultBranch: r?.defaultBranch ?? r?.default_branch ?? r?.branch ?? "main",
});

export const generateCommitHash = (index) => {
    return `c${index.toString().padStart(3, "0")}`;
};

export const calculateCommitPositions = (repoState) => {
    const branchMap =
        repoState && typeof repoState === "object" && repoState.branches && typeof repoState.branches === "object"
            ? repoState.branches
            : {};
    const commitPositions = {};
    const commitSpacingY = 70;
    const commitSpacingX = 150;

    let xOffset = 0;

    for (const [branchName, commitsRaw] of Object.entries(branchMap)) {
        const commits = Array.isArray(commitsRaw) ? commitsRaw : [];
        let currentY = 50;

        for (let i = 0; i < commits.length; i++) {
            const c = commits[i];
            const hash = c?.hash ?? generateCommitHash(i);
            if (!commitPositions[hash]) {
                commitPositions[hash] = { x: xOffset, y: currentY, branch: branchName };
                currentY += commitSpacingY;
            }
        }

        xOffset += commitSpacingX;
    }

    return commitPositions;
};
