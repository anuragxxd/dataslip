import fs from "fs";
import path from "path";
import os from "os";

const LOG_DIR = path.join(os.homedir(), ".dataslip");
const LOG_FILE = path.join(LOG_DIR, "dataslip.log");

let enabled = false;
let stream: fs.WriteStream | null = null;

export function enableLogging() {
  if (enabled) return;
  enabled = true;

  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }

  stream = fs.createWriteStream(LOG_FILE, { flags: "a" });
  log("info", "DataSlip started", { pid: process.pid, runtime: process.version });
}

export function getLogPath(): string {
  return LOG_FILE;
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
}
