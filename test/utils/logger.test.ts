import { describe, expect, test } from "bun:test";
import fs from "fs/promises";
import path from "path";
import { useTestDataDir } from "../fixtures/app";
import {
  closeLogger,
  enableLogging,
  getLogPath,
  logDebug,
  logError,
  logInfo,
  logWarn,
} from "../../src/utils/logger";

async function waitForLog(pathname: string, snippets: string[], timeoutMs: number = 500) {
  const startedAt = Date.now();
  while (true) {
    try {
      const content = await fs.readFile(pathname, "utf8");
      if (snippets.every((snippet) => content.includes(snippet))) {
        return content;
      }
    } catch {}

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`timed out waiting for log content in ${pathname}`);
    }
    await Bun.sleep(10);
  }
}

describe("logger", () => {
  test("does not write before enableLogging and writes startup plus log lines after enable", async () => {
    await using home = await useTestDataDir("logger-");
    const logPath = path.join(home.path, "dataslip.log");

    logInfo("ignored before enable");
    await expect(fs.access(logPath)).rejects.toThrow();

    enableLogging();
    logDebug("debug line", { step: 1 });
    logWarn("warn line", { step: 2 });
    logError("error line");
    closeLogger();

    const content = await waitForLog(logPath, [
      "DataSlip started",
      "debug line",
      "warn line",
      "error line",
    ]);

    expect(getLogPath()).toBe(logPath);
    expect(content).toContain('"step":1');
    expect(content).toContain('"step":2');
  });

  test("enableLogging is idempotent for the same path and rotates cleanly to a new data dir", async () => {
    await using home = await useTestDataDir("logger-rotate-");
    const firstPath = path.join(home.path, "dataslip.log");

    enableLogging();
    enableLogging();
    logInfo("first home entry");
    closeLogger();

    const firstContent = await waitForLog(firstPath, ["DataSlip started", "first home entry"]);
    expect(firstContent.match(/DataSlip started/g)?.length).toBe(1);

    const testRoot = process.env.DATASLIP_TEST_ROOT;
    if (!testRoot) {
      throw new Error("expected DATASLIP_TEST_ROOT");
    }

    const secondHome = await fs.mkdtemp(path.join(testRoot, "logger-rotate-next-"));
    const secondPath = path.join(secondHome, "dataslip.log");
    process.env.DATASLIP_HOME = secondHome;

    enableLogging();
    logInfo("second home entry");
    closeLogger();

    const secondContent = await waitForLog(secondPath, ["DataSlip started", "second home entry"]);
    expect(firstPath).not.toBe(secondPath);
    expect(secondContent).not.toContain("first home entry");
  });
});
