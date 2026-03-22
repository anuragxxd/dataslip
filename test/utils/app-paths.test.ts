import { describe, expect, test } from "bun:test";
import path from "path";
import { ensureDataDir, getDataDir, getDatabasePath, getLogFilePath } from "../../src/utils/app-paths";
import { useTestDataDir } from "../fixtures/app";

describe("app paths", () => {
  test("uses DATASLIP_HOME for storage and log paths", async () => {
    await using home = await useTestDataDir("paths-");

    expect(getDataDir()).toBe(home.path);
    expect(ensureDataDir()).toBe(home.path);
    expect(getDatabasePath()).toBe(path.join(home.path, "dataslip.db"));
    expect(getLogFilePath()).toBe(path.join(home.path, "dataslip.log"));
  });
});
