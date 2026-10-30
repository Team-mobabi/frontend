import type { User } from "../types/api";

// 서버 버전에 따라 이름 필드가 제각각이라 후보 필드를 넓게 받는다
type UserLike = Partial<User> & {
    fullName?: string;
    nickName?: string;
    nickname?: string;
    user?: unknown;
};

export function getUserDisplayName(user: UserLike | string | null | undefined): string {
    if (!user) return "user";

    if (typeof user === "string") {
        return user;
    }

    const { displayName, fullName, username, name, nickName, nickname, user: userField, email } = user;

    const candidate = displayName || fullName || username || name || nickName || nickname || userField;
    if (candidate && typeof candidate === "string") {
        return candidate;
    }

    if (typeof email === "string" && email.includes("@")) {
        return email.split("@")[0];
    }

    return "user";
}
