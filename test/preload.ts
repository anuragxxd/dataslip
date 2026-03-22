import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterAll } from "bun:test";

const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), "dataslip-test-"));
const defaultHome = path.join(testRoot, "default");

await fs.mkdir(defaultHome, { recursive: true });

process.env["DATASLIP_TEST_ROOT"] = testRoot;
process.env["DATASLIP_DEFAULT_TEST_HOME"] = defaultHome;
process.env["DATASLIP_HOME"] = defaultHome;
process.env.TZ = process.env.TZ || "UTC";

afterAll(async () => {
  await fs.rm(testRoot, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  }).catch(() => undefined);
});
