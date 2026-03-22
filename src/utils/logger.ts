import fs from "fs";
import { ensureDataDir, getLogFilePath } from "./app-paths";

let enabled = false;
let stream: fs.WriteStream | null = null;
let activeLogPath: string | null = null;

export function enableLogging() {
  const logPath = getLogFilePath();
  if (enabled && stream && activeLogPath === logPath) return;

  closeLogger();
  enabled = true;

  ensureDataDir();
  stream = fs.createWriteStream(logPath, { flags: "a" });
  activeLogPath = logPath;
  log("info", "DataSlip started", { pid: process.pid, runtime: process.version });
}

export function getLogPath(): string {
  return getLogFilePath();
}

function write(line: string) {
  if (!stream) return;
  stream.write(line + "\n");
}

export function log(
  level: "debug" | "info" | "warn" | "error",
  message: string,
  data?: Record<string, unknown>
) {
  if (!enabled) return;
  const ts = new Date().toISOString();
  const lvl = level.toUpperCase().padEnd(5);
  const suffix = data ? " " + JSON.stringify(data) : "";
  write(`[${ts}] [${lvl}] ${message}${suffix}`);
}

export function logDebug(msg: string, data?: Record<string, unknown>) {
  log("debug", msg, data);
}
export function logInfo(msg: string, data?: Record<string, unknown>) {
  log("info", msg, data);
}
export function logWarn(msg: string, data?: Record<string, unknown>) {
  log("warn", msg, data);
}
export function logError(msg: string, data?: Record<string, unknown>) {
  log("error", msg, data);
}

export function closeLogger() {
  if (stream) {
    stream.end();
    stream = null;
  }
  activeLogPath = null;
  enabled = false;
}
