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
