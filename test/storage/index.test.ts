import { describe, expect, test } from "bun:test";
import path from "path";
import {
  closeStorage,
  getAllConnections,
  getSetting,
  getStoragePath,
  saveConnection,
  setSetting,
} from "../../src/storage";
import type { ConnectionConfig } from "../../src/db/types";
import { useTestDataDir } from "../fixtures/app";

function createConnection(id: string, name: string): ConnectionConfig {
  return {
    id,
    name,
    host: "localhost",
    port: 5432,
    database: "dataslip",
    username: "postgres",
    password: "",
    ssl: "disable",
    createdAt: 1,
    updatedAt: 2,
  };
}

describe("storage", () => {
  test("persists connections and settings inside the configured data dir", async () => {
    await using home = await useTestDataDir("storage-");
    const connection = createConnection("conn-1", "Local DB");

    saveConnection(connection);
    setSetting("themeId", "nord");
    closeStorage();

    expect(getStoragePath()).toBe(path.join(home.path, "dataslip.db"));
    expect(getAllConnections()).toEqual([connection]);
    expect(getSetting("themeId")).toBe("nord");
  });

  test("reopens SQLite against a new DATASLIP_HOME when the data dir changes", async () => {
    await using firstHome = await useTestDataDir("storage-a-");
    saveConnection(createConnection("conn-a", "First"));
    closeStorage();

    await using secondHome = await useTestDataDir("storage-b-");

    expect(firstHome.path).not.toBe(secondHome.path);
    expect(getStoragePath()).toBe(path.join(secondHome.path, "dataslip.db"));
    expect(getAllConnections()).toEqual([]);
  });
});
