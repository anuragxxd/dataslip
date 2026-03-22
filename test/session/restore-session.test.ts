import { describe, expect, test } from "bun:test";
import { restoreSession, type SessionRestoreDependencies } from "../../src/session/restore-session";
import type { PersistedSession, PersistedTableState } from "../../src/storage/session";

function createTableState(overrides: Partial<PersistedTableState> = {}): PersistedTableState {
  return {
    schema: "public",
    table: "users",
    relationType: "table",
    page: 1,
    pageSize: 50,
    orderBy: null,
    orderDir: "ASC",
    selectedRow: 0,
    selectedCol: 0,
    scrollOffsetX: 0,
    ...overrides,
  };
}

function createSession(overrides: Partial<PersistedSession> = {}): PersistedSession {
  return {
    version: 1,
    connectionId: "conn-1",
    activeWorkspaceId: "table-1",
    workspaces: [
      {
        id: "table-1",
        kind: "table",
        title: "users",
        lastPanel: "grid",
        createdAt: 1,
        lastActiveAt: 1,
      },
    ],
    tableStateByWorkspaceId: {
      "table-1": createTableState(),
    },
    queryStateByWorkspaceId: {},
    tree: {
      selectedNodeId: null,
      expandedNodeIds: [],
    },
    ...overrides,
  };
}

function createDeps(input: {
  session?: PersistedSession | null;
  connections?: Array<{ id: string; name: string; host: string }>;
  connectResult?: boolean;
  failingTables?: string[];
}) {
  const calls: Array<[string, ...unknown[]]> = [];
  const patched: Record<string, Array<Record<string, unknown>>> = {};
  const invalidTables: Array<[string, string]> = [];
  const infos: Array<[string, Record<string, unknown> | undefined]> = [];
  const warnings: Array<[string, Record<string, unknown> | undefined]> = [];
  const failingTables = new Set(input.failingTables || []);

  const deps: SessionRestoreDependencies = {
    loadSession: () => input.session ?? null,
    loadConnections: () => {
      calls.push(["loadConnections"]);
    },
    listConnections: () =>
      (input.connections || [{ id: "conn-1", name: "Local DB", host: "localhost" }]).map(
        (connection) => ({
          ...connection,
          port: 5432,
          database: "dataslip",
          username: "postgres",
          password: "",
          ssl: "disable" as const,
          createdAt: 1,
          updatedAt: 1,
        })
      ),
    connectTo: async (connectionId) => {
      calls.push(["connectTo", connectionId]);
      return input.connectResult ?? true;
    },
    setScreen: (screen) => {
      calls.push(["setScreen", screen]);
    },
    restoreWorkspaces: (session) => {
      calls.push(["restoreWorkspaces", session.workspaces.map((workspace) => workspace.id)]);
    },
    initQueryWorkspace: (workspaceId, queryText) => {
      calls.push(["initQueryWorkspace", workspaceId, queryText]);
    },
    initTableWorkspace: (workspaceId) => {
      calls.push(["initTableWorkspace", workspaceId]);
    },
    loadSchemas: async () => {
      calls.push(["loadSchemas"]);
    },
    restoreTreeState: (tree) => {
      calls.push(["restoreTreeState", tree?.selectedNodeId || null, tree?.expandedNodeIds || []]);
    },
    loadTable: async (workspaceId, state) => {
      calls.push(["loadTable", workspaceId, state.page, state.orderBy, state.pageSize]);
      if (failingTables.has(workspaceId)) {
        throw new Error("missing table");
      }
    },
    patchTableState: (workspaceId, patch) => {
      patched[workspaceId] ||= [];
      patched[workspaceId].push(patch);
      calls.push(["patchTableState", workspaceId, patch]);
    },
    reloadTable: async (workspaceId) => {
      calls.push(["reloadTable", workspaceId]);
    },
    markInvalidTable: (workspaceId, message) => {
      invalidTables.push([workspaceId, message]);
      calls.push(["markInvalidTable", workspaceId, message]);
    },
    setActivePanel: (panel) => {
      calls.push(["setActivePanel", panel]);
    },
    logInfo: (message, data) => {
      infos.push([message, data]);
    },
    logWarn: (message, data) => {
      warnings.push([message, data]);
    },
  };

  return { deps, calls, patched, invalidTables, infos, warnings };
}

describe("restoreSession", () => {
  test("skips when there is no session to restore", async () => {
    const { deps, calls, infos } = createDeps({ session: null });

    const result = await restoreSession(deps);

    expect(result).toEqual({ status: "skipped", reason: "no-session" });
    expect(calls).toEqual([]);
    expect(infos[0]?.[0]).toBe("No session to restore");
  });

  test("skips when the saved connection no longer exists", async () => {
    const { deps, calls, warnings } = createDeps({
      session: createSession(),
      connections: [],
    });

    const result = await restoreSession(deps);

    expect(result).toEqual({ status: "skipped", reason: "missing-connection" });
    expect(calls).toEqual([["loadConnections"]]);
    expect(warnings[0]?.[0]).toBe("Saved connection not found, skipping restore");
  });

  test("skips when auto reconnect fails", async () => {
    const { deps, calls, warnings } = createDeps({
      session: createSession(),
      connectResult: false,
    });

    const result = await restoreSession(deps);

    expect(result).toEqual({ status: "skipped", reason: "connect-failed" });
    expect(calls).toEqual([
      ["loadConnections"],
      ["connectTo", "conn-1"],
    ]);
    expect(warnings.at(-1)?.[0]).toBe("Auto-reconnect failed, showing connections screen");
  });

  test("restores workspaces, query text, tree state, and hydrates tables", async () => {
    const session = createSession({
      workspaces: [
        {
          id: "table-1",
          kind: "table",
          title: "users",
          lastPanel: "grid",
          createdAt: 1,
          lastActiveAt: 1,
        },
        {
          id: "query-1",
          kind: "query",
          title: "Query 1",
          lastPanel: "query",
          createdAt: 2,
          lastActiveAt: 2,
        },
        {
          id: "table-2",
          kind: "table",
          title: "orders",
          lastPanel: "grid",
          createdAt: 3,
          lastActiveAt: 3,
        },
      ],
      tableStateByWorkspaceId: {
        "table-1": createTableState({
          page: 2,
          pageSize: 100,
          orderBy: "name",
          orderDir: "DESC",
          selectedRow: 3,
          selectedCol: 1,
          scrollOffsetX: 4,
        }),
        "table-2": createTableState({
          table: "orders",
        }),
      },
      queryStateByWorkspaceId: {
        "query-1": {
          queryText: "select * from users;",
        },
      },
      tree: {
        selectedNodeId: "table:public:users",
        expandedNodeIds: ["schema:public", "table-group:public"],
      },
    });

    const { deps, calls, patched, infos } = createDeps({
      session,
      failingTables: ["table-2"],
    });

    const result = await restoreSession(deps);
    await result.backgroundHydration;

    expect(result.status).toBe("restored");
    expect(calls).toContainEqual(["setScreen", "main"]);
    expect(calls).toContainEqual(["restoreWorkspaces", ["table-1", "query-1", "table-2"]]);
    expect(calls).toContainEqual(["initTableWorkspace", "table-1"]);
    expect(calls).toContainEqual(["initQueryWorkspace", "query-1", "select * from users;"]);
    expect(calls).toContainEqual(["initTableWorkspace", "table-2"]);
    expect(calls).toContainEqual([
      "restoreTreeState",
      "table:public:users",
      ["schema:public", "table-group:public"],
    ]);
    expect(calls).toContainEqual(["reloadTable", "table-1"]);
    expect(calls).toContainEqual(["setActivePanel", "grid"]);
    expect(calls).toContainEqual(["markInvalidTable", "table-2", "Table may no longer exist"]);
    expect(patched["table-1"]).toEqual([
      {
        page: 2,
        pageSize: 100,
        orderBy: "name",
        orderDir: "DESC",
      },
      {
        selectedRow: 3,
        selectedCol: 1,
        scrollOffsetX: 4,
        isInvalid: false,
        error: null,
      },
    ]);
    expect(infos.at(-1)?.[0]).toBe("Session restore complete");
  });

  test("marks the active table invalid instead of aborting the whole restore", async () => {
    const session = createSession();
    const { deps, calls, invalidTables } = createDeps({
      session,
      failingTables: ["table-1"],
    });

    const result = await restoreSession(deps);
    await result.backgroundHydration;

    expect(result.status).toBe("restored");
    expect(invalidTables).toEqual([["table-1", "Table may no longer exist"]]);
    expect(calls).toContainEqual(["setActivePanel", "grid"]);
  });
});
