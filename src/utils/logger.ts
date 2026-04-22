/* Tiny console logger with levels and timestamps. */

type Level = "debug" | "info" | "warn" | "error" | "success";

const COLORS: Record<Level, string> = {
  debug: "\x1b[90m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
  success: "\x1b[32m",
};
const RESET = "\x1b[0m";

function ts(): string {
  return new Date().toISOString().replace("T", " ").replace("Z", "");
}

function log(level: Level, ...args: unknown[]): void {
  const prefix = `${COLORS[level]}[${ts()}] [${level.toUpperCase()}]${RESET}`;
  // eslint-disable-next-line no-console
  console.log(prefix, ...args);
}

export const logger = {
  debug: (...a: unknown[]) => log("debug", ...a),
  info: (...a: unknown[]) => log("info", ...a),
  warn: (...a: unknown[]) => log("warn", ...a),
  error: (...a: unknown[]) => log("error", ...a),
  success: (...a: unknown[]) => log("success", ...a),
};
