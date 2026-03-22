import fs from "fs/promises";
import path from "path";
import { resetAppState } from "../../src/testing/reset";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required test env: ${name}`);
  }
  return value;
}

export async function useTestDataDir(prefix: string = "case-") {
  const testRoot = getEnv("DATASLIP_TEST_ROOT");
  const defaultHome = getEnv("DATASLIP_DEFAULT_TEST_HOME");
  const dataDir = await fs.mkdtemp(path.join(testRoot, prefix));

  process.env["DATASLIP_HOME"] = dataDir;
  await resetAppState();

  return {
    path: dataDir,
    [Symbol.asyncDispose]: async () => {
      await resetAppState();
      process.env["DATASLIP_HOME"] = defaultHome;
      await fs.rm(dataDir, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      }).catch(() => undefined);
    },
  };
}
