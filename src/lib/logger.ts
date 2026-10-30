type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

// 개발 모드는 debug부터, 운영은 warn 이상만 출력
const minLevel: Level = import.meta.env.DEV ? "debug" : "warn";

function emit(level: Level, scope: string, message: string, args: unknown[]) {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
    const prefix = `[${scope}]`;
    const fn = level === "debug" ? console.debug : console[level];
    fn(prefix, message, ...args);
}

export interface Logger {
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
}

export function createLogger(scope: string): Logger {
    return {
        debug: (message, ...args) => emit("debug", scope, message, args),
        info: (message, ...args) => emit("info", scope, message, args),
        warn: (message, ...args) => emit("warn", scope, message, args),
        error: (message, ...args) => emit("error", scope, message, args),
    };
}

export const logger = createLogger("app");
