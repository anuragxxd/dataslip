import { describe, expect, test } from "bun:test";
import type { PersistedSession, PersistedTableState } from "../../src/storage/session";
import {
  createSessionRestoreDependenciesForTest,
  hydrateTableWorkspaceForTest,
  restoreSession,
} from "../../src/session/restore-session";
import { resetAppState } from "../../src/testing/reset";
import { useConnectionsStore } from "../../src/store/connections";
import { useQueryStore } from "../../src/store/query";
import { useSchemaStore } from "../../src/store/schema";
import { useTableDataStore } from "../../src/store/table-data";
import { useUIStore } from "../../src/store/ui";
import { useWorkspaceStore } from "../../src/store/workspaces";
import { createQueryResult } from "../store/helpers";

function createSession(): PersistedSession {
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
      {
        id: "table-2",
        kind: "table",
        title: "orders",
        lastPanel: "grid",
        source: { schema: "public", table: "orders", relationType: "table" },
        createdAt: 5,
        lastActiveAt: 6,
      },
    ],
    tableStateByWorkspaceId: {
      "table-1": {
        schema: "public",
        table: "users",
        relationType: "table",
        page: 2,
        pageSize: 100,
        orderBy: "name",
        orderDir: "DESC",
        selectedRow: 3,
        selectedCol: 1,
        scrollOffsetX: 4,
      },
      "table-2": {
        schema: "public",
        table: "orders",
        relationType: "table",
        page: 1,
        pageSize: 50,
        orderBy: null,
        orderDir: "ASC",
        selectedRow: 0,
        selectedCol: 0,
        scrollOffsetX: 0,
      },
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
  };
}

describe("restore session runtime wiring", () => {
  test("default dependencies wire singleton stores together and exported helpers stay usable", async () => {
    await resetAppState();

    const originalConnections = useConnectionsStore.getState();
    const originalSchema = useSchemaStore.getState();
    const originalTable = useTableDataStore.getState();
    const originalUI = useUIStore.getState();
    const reloads: string[] = [];
    let loadConnectionsCalls = 0;

    try {
      useConnectionsStore.setState({
        ...originalConnections,
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
            updatedAt: 1,
          },
        ],
        loadConnections: () => {
          loadConnectionsCalls += 1;
        },
        connectTo: async (id) => {
          useConnectionsStore.setState({ activeConnectionId: id });
          return true;
        },
      });

      useSchemaStore.setState({
        ...originalSchema,
        loadSchemas: async () => {
          useSchemaStore.setState({
            schemas: [{ name: "public", isSystem: false }],
            tables: {
              public: [
                { schema: "public", name: "users", type: "table", comment: null, estimatedRows: 42 },
                { schema: "public", name: "orders", type: "table", comment: null, estimatedRows: 10 },
              ],
            },
          });
        },
        buildTree: () => [
          {
            id: "schema:public",
            label: "public",
            type: "schema",
            depth: 0,
            expanded: true,
            children: [],
          },
        ],
      });

      useTableDataStore.setState({
        ...originalTable,
        loadTable: async (workspaceId, schema, table, type = "table") => {
          if (workspaceId === "table-2") {
            throw new Error("missing table");
          }

          const current = useTableDataStore.getState().byWorkspaceId[workspaceId];
          if (!current) {
            throw new Error(`missing workspace ${workspaceId}`);
          }

          useTableDataStore.setState({
            byWorkspaceId: {
              ...useTableDataStore.getState().byWorkspaceId,
              [workspaceId]: {
                ...current,
                currentSchema: schema,
                currentTable: table,
                currentTableType: type,
                result: createQueryResult(),
                totalRows: 5,
                error: null,
                isInvalid: false,
              },
            },
          });
        },
        reloadCurrent: async (workspaceId) => {
          reloads.push(workspaceId);
        },
      });

      const session = createSession();
      const deps = createSessionRestoreDependenciesForTest({
        loadSession: () => session,
        logInfo: () => {},
        logWarn: () => {},
      });

      deps.patchTableState("missing", { page: 9 });
      deps.markInvalidTable("missing", "ignored");
      deps.restoreTreeState(undefined);

      const result = await restoreSession(deps);
      await result.backgroundHydration;

      expect(result.status).toBe("restored");
      expect(loadConnectionsCalls).toBe(1);
      expect(useConnectionsStore.getState().activeConnectionId).toBe("conn-1");
      expect(useUIStore.getState()).toMatchObject({
        screen: "main",
        activePanel: "grid",
      });
      expect(useWorkspaceStore.getState().activeWorkspaceId).toBe("table-1");
      expect(useQueryStore.getState().getWorkspaceState("query-1")).toMatchObject({
        queryText: "select * from users;",
      });
      expect(useSchemaStore.getState()).toMatchObject({
        selectedNodeId: "table:public:users",
      });
      expect(Array.from(useSchemaStore.getState().expandedNodes)).toEqual([
        "schema:public",
        "table-group:public",
      ]);
      expect(useSchemaStore.getState().treeNodes).toEqual([
        {
          id: "schema:public",
          label: "public",
          type: "schema",
          depth: 0,
          expanded: true,
          children: [],
        },
      ]);
      expect(useTableDataStore.getState().getWorkspaceState("table-1")).toMatchObject({
        currentSchema: "public",
        currentTable: "users",
        currentTableType: "table",
        page: 2,
        pageSize: 100,
        orderBy: "name",
        orderDir: "DESC",
        selectedRow: 3,
        selectedCol: 1,
        scrollOffsetX: 4,
        isInvalid: false,
        error: null,
      });
      expect(useTableDataStore.getState().getWorkspaceState("table-2")).toMatchObject({
        isInvalid: true,
        error: "Table may no longer exist",
      });
      expect(reloads).toEqual(["table-1"]);

      const helperState: PersistedTableState = {
        schema: "public",
        table: "users",
        relationType: "table",
        page: 1,
        pageSize: 50,
        orderBy: null,
        orderDir: "ASC",
        selectedRow: 1,
        selectedCol: 0,
        scrollOffsetX: 2,
      };
      await hydrateTableWorkspaceForTest(deps, "table-1", helperState);
      expect(useTableDataStore.getState().getWorkspaceState("table-1")).toMatchObject({
        page: 1,
        pageSize: 50,
        orderBy: null,
        orderDir: "ASC",
        selectedRow: 1,
        selectedCol: 0,
        scrollOffsetX: 2,
      });
      expect(reloads).toEqual(["table-1"]);
    } finally {
      useConnectionsStore.setState(originalConnections);
      useSchemaStore.setState(originalSchema);
      useTableDataStore.setState(originalTable);
      useUIStore.setState(originalUI);
      await resetAppState();
    }
  });
});
