import fs from "fs";
import os from "os";
import path from "path";

export const DATASLIP_HOME_ENV = "DATASLIP_HOME";

const DEFAULT_DATA_DIR_NAME = ".dataslip";

export function getDataDir(): string {
  return process.env[DATASLIP_HOME_ENV] || path.join(os.homedir(), DEFAULT_DATA_DIR_NAME);
}

export function ensureDataDir(): string {
  const dataDir = getDataDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
}

export function getDatabasePath(): string {
  return path.join(getDataDir(), "dataslip.db");
}

export function getLogFilePath(): string {
  return path.join(getDataDir(), "dataslip.log");
}
