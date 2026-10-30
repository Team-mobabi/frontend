export type HeroStep = 0 | 1 | 2 | 3 | 4; // 0: 대기, 1: Pull, 2: Add, 3: Commit, 4: Push

export const HERO_STEP_COLORS: Record<Exclude<HeroStep, 0>, string> = {
    1: "#4B5AE4",
    2: "#3b82f6",
    3: "#22c55e",
    4: "#f59e0b",
};
