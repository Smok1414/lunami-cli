// File: src/utils/logger.ts

export class Logger {
  public static log(message: string, ...args: any[]): void {
    console.log(`[INFO] ${message}`, ...args);
  }

  public static error(message: string, ...args: any[]): void {
    console.error(`[ERROR] ${message}`, ...args);
  }

  public static warn(message: string, ...args: any[]): void {
    console.warn(`[WARN] ${message}`, ...args);
  }

  public static debug(message: string, ...args: any[]): void {
    if (process.env.DEBUG === 'true') {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }
}
