import { describe, expect, test } from "bun:test";
import {
  clearSession,
  debouncedSaveSession,
  flushPendingSave,
  hasPendingSessionSave,
  loadSession,
  resetSessionSaveState,
  saveSession,
} from "../../src/storage/session";
import type { PersistedSession } from "../../src/storage/session";
import { setSetting } from "../../src/storage";
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

  test("ignores unknown session versions", async () => {
    await using _home = await useTestDataDir("session-version-");

    setSetting(
      "workspaceSession.v1",
      JSON.stringify({
        version: 2,
        connectionId: "conn-1",
        activeWorkspaceId: null,
        workspaces: [],
        tableStateByWorkspaceId: {},
        queryStateByWorkspaceId: {},
      })
    );

    expect(loadSession()).toBeNull();
  });

  test("flushes a pending debounced save immediately", async () => {
    await using _home = await useTestDataDir("session-flush-");
    const session = createSession();

    debouncedSaveSession(session);
    expect(hasPendingSessionSave()).toBe(true);

    flushPendingSave(session);

    expect(hasPendingSessionSave()).toBe(false);
    expect(loadSession()).toEqual(session);
  });

  test("debounces saves and persists only the latest session when the timer fires", async () => {
    await using _home = await useTestDataDir("session-timer-");
    const first = createSession();
    const latest = {
      ...createSession(),
      connectionId: "conn-2",
      activeWorkspaceId: "query-1",
    };

    debouncedSaveSession(first);
    debouncedSaveSession(latest);

    expect(hasPendingSessionSave()).toBe(true);
    expect(loadSession()).toBeNull();

    await Bun.sleep(2100);

    expect(hasPendingSessionSave()).toBe(false);
    expect(loadSession()).toEqual(latest);
  });
});
