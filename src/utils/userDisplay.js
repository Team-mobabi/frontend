export function getUserDisplayName(user) {
    if (!user) return "user";

    const {
        displayName,
        fullName,
        username,
        name,
        nickName,
        nickname,
        user: userField,
        email,
    } = user;

    const candidate = displayName || fullName || username || name || nickName || nickname || userField;
    if (candidate && typeof candidate === "string") {
        return candidate;
    }

    if (typeof email === "string" && email.includes("@")) {
        return email.split("@")[0];
    }

    if (typeof user === "string") {
        return user;
    }

    return "user";
}
