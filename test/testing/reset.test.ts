import { describe, expect, test } from "bun:test";
import { resetAppState } from "../../src/testing/reset";
import { debouncedSaveSession, hasPendingSessionSave } from "../../src/storage/session";
import { useConnectionsStore } from "../../src/store/connections";
import { useUIStore } from "../../src/store/ui";
import { useWorkspaceStore } from "../../src/store/workspaces";
import { useTestDataDir } from "../fixtures/app";

describe("resetAppState", () => {
  test("clears stores and pending runtime state between tests", async () => {
    await using _home = await useTestDataDir("reset-");

    useConnectionsStore.setState({
      connections: [
        {
          id: "conn-1",
          name: "Local DB",
          host: "localhost",
          port: 5432,
          database: "dataslip",
          username: "postgres",
          password: "",
          ssl: "disable",
          createdAt: 1,
          updatedAt: 2,
        },
      ],
      activeConnectionId: "conn-1",
      connectError: "boom",
    });
    useWorkspaceStore.setState({
      workspaces: [
        {
          id: "table-1",
          kind: "table",
          title: "users",
          dirty: false,
          lastPanel: "grid",
          createdAt: 1,
          lastActiveAt: 1,
        },
      ],
      activeWorkspaceId: "table-1",
    });
    useUIStore.setState({
      screen: "main",
      activeDialog: "help",
      themeId: "nord",
    });
    debouncedSaveSession({
      version: 1,
      connectionId: "conn-1",
      activeWorkspaceId: null,
      workspaces: [],
      tableStateByWorkspaceId: {},
      queryStateByWorkspaceId: {},
      tree: {
        selectedNodeId: null,
        expandedNodeIds: [],
      },
    });

    expect(hasPendingSessionSave()).toBe(true);

    await resetAppState();

    expect(useConnectionsStore.getState().connections).toEqual([]);
    expect(useConnectionsStore.getState().activeConnectionId).toBeNull();
    expect(useWorkspaceStore.getState().workspaces).toEqual([]);
    expect(useWorkspaceStore.getState().activeWorkspaceId).toBeNull();
    expect(useUIStore.getState().screen).toBe("connections");
    expect(useUIStore.getState().activeDialog).toBe("none");
    expect(useUIStore.getState().themeId).toBe("opencode");
    expect(hasPendingSessionSave()).toBe(false);
  });
});
