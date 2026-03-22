import { describe, expect, test } from "bun:test";
import {
  clearSession,
  debouncedSaveSession,
  hasPendingSessionSave,
  loadSession,
  resetSessionSaveState,
  saveSession,
} from "../../src/storage/session";
import type { PersistedSession } from "../../src/storage/session";
import { useTestDataDir } from "../fixtures/app";

function createSession(): PersistedSession {
  return {
    version: 1,
    connectionId: "conn-1",
    activeWorkspaceId: "table-1",
    workspaces: [],
    tableStateByWorkspaceId: {},
    queryStateByWorkspaceId: {},
    tree: {
      selectedNodeId: null,
      expandedNodeIds: [],
    },
  };
}

describe("session storage", () => {
  test("saves and clears persisted sessions", async () => {
    await using _home = await useTestDataDir("session-");
    const session = createSession();

    saveSession(session);
    expect(loadSession()).toEqual(session);

    clearSession();
    expect(loadSession()).toBeNull();
  });

  test("can reset a pending debounced session save without writing to disk", async () => {
    await using _home = await useTestDataDir("session-debounce-");

    debouncedSaveSession(createSession());
    expect(hasPendingSessionSave()).toBe(true);

    resetSessionSaveState();
    expect(hasPendingSessionSave()).toBe(false);
    expect(loadSession()).toBeNull();
  });
});
