import { describe, expect, test } from "bun:test";
import { createWorkspaceStore } from "../../src/store/workspaces";

describe("workspace store", () => {
  test("dedupes table workspaces by schema, table, and relation type", () => {
    const store = createWorkspaceStore();

    const first = store.getState().openTableWorkspace("public", "users", "table");
    const second = store.getState().openTableWorkspace("public", "users", "table");
    const third = store.getState().openTableWorkspace("public", "users_view", "view");

    expect(first.created).toBe(true);
    expect(second).toEqual({ id: first.id, created: false });
    expect(third.created).toBe(true);
    expect(store.getState().workspaces).toHaveLength(2);
    expect(store.getState().activeWorkspaceId).toBe(third.id);
  });

  test("numbers query workspaces and wraps next and previous navigation", () => {
    const store = createWorkspaceStore();

    const first = store.getState().openQueryWorkspace();
    const second = store.getState().openQueryWorkspace();

    expect(store.getState().workspaces.map((workspace) => workspace.title)).toEqual([
      "Query 1",
      "Query 2",
    ]);

    store.getState().activateWorkspace(first);
    store.getState().prevWorkspace();
    expect(store.getState().activeWorkspaceId).toBe(second);

    store.getState().nextWorkspace();
    expect(store.getState().activeWorkspaceId).toBe(first);
  });

  test("closes the active workspace by selecting the nearest remaining neighbor", () => {
    const store = createWorkspaceStore();

    const first = store.getState().openQueryWorkspace("First");
    const second = store.getState().openQueryWorkspace("Second");
    const third = store.getState().openQueryWorkspace("Third");

    store.getState().activateWorkspace(second);
    store.getState().closeWorkspace(second);

    expect(store.getState().workspaces.map((workspace) => workspace.title)).toEqual([
      "First",
      "Third",
    ]);
    expect(store.getState().activeWorkspaceId).toBe(third);

    store.getState().closeWorkspace(third);
    expect(store.getState().activeWorkspaceId).toBe(first);
  });

  test("restores workspaces from session metadata and clears dirty flags", () => {
    const store = createWorkspaceStore();

    store.getState().restoreFromSession({
      version: 1,
      connectionId: "conn-1",
      activeWorkspaceId: "query-1",
      workspaces: [
        {
          id: "table-1",
          kind: "table",
          title: "users",
          subtitle: "public",
          lastPanel: "grid",
          source: { schema: "public", table: "users", relationType: "table" },
          createdAt: 1,
          lastActiveAt: 2,
        },
        {
          id: "query-1",
          kind: "query",
          title: "Query 1",
          lastPanel: "query",
          createdAt: 3,
          lastActiveAt: 4,
        },
      ],
      tableStateByWorkspaceId: {},
      queryStateByWorkspaceId: {},
      tree: { selectedNodeId: null, expandedNodeIds: [] },
    });

    expect(store.getState().activeWorkspaceId).toBe("query-1");
    expect(store.getState().workspaces.map((workspace) => workspace.dirty)).toEqual([false, false]);
    expect(store.getState().workspaces[0].source).toEqual({
      schema: "public",
      table: "users",
      relationType: "table",
    });
  });
});
