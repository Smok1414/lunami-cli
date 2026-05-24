// File: src/utils/logger.ts
export class Logger {
    static log(message, ...args) {
        console.log(`[INFO] ${message}`, ...args);
    }
    static error(message, ...args) {
        console.error(`[ERROR] ${message}`, ...args);
    }
    static warn(message, ...args) {
        console.warn(`[WARN] ${message}`, ...args);
    }
    static debug(message, ...args) {
        if (process.env.DEBUG === 'true') {
            console.log(`[DEBUG] ${message}`, ...args);
        }
    }
}
