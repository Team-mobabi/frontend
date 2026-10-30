import type { Repo } from "../../types/api";

type RepoLike = Partial<Repo> & {
    repo_id?: string | number;
    _id?: string | number;
    uid?: string | number;
    slug?: string;
};

// 서버 버전에 따라 id 필드명이 달라 여러 후보에서 저장소 ID를 꺼낸다
export const repoIdOf = (r: RepoLike | null | undefined): string => {
    const v = r?.id ?? r?.repoId ?? r?.repo_id ?? r?._id ?? r?.uid ?? r?.slug ?? "";
    return v == null ? "" : String(v);
};
