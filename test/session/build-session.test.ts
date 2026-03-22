import { describe, expect, test } from "bun:test";
import { buildPersistedSession } from "../../src/session/build-session";
import type { QueryWorkspaceState } from "../../src/store/query";
import type { TableWorkspaceState } from "../../src/store/table-data";
import type { WorkspaceMeta } from "../../src/store/workspaces";

function createTableWorkspace(id: string): WorkspaceMeta {
  return {
    id,
    kind: "table",
    title: "users",
    dirty: false,
    lastPanel: "grid",
    source: {
      schema: "public",
      table: "users",
      relationType: "table",
    },
    createdAt: 1,
    lastActiveAt: 2,
  };
}

function createQueryWorkspace(id: string): WorkspaceMeta {
  return {
    id,
    kind: "query",
    title: "Query 1",
    dirty: true,
    lastPanel: "query",
    createdAt: 3,
    lastActiveAt: 4,
  };
}

function createTableState(overrides: Partial<TableWorkspaceState> = {}): TableWorkspaceState {
  return {
    currentSchema: "public",
    currentTable: "users",
    currentTableType: "table",
    primaryKeyColumns: ["id"],
    result: null,
    totalRows: 0,
    page: 2,
    pageSize: 50,
    orderBy: "name",
    orderDir: "DESC",
    quickSearch: "",
    filters: [],
    selectedRow: 3,
    selectedCol: 1,
    scrollOffsetX: 0,
    isLoading: false,
    error: null,
    isInvalid: false,
    edit: {
      editMode: false,
      editValue: "",
      editOriginalValue: undefined,
      editIsNull: false,
    },
    ...overrides,
  };
}

function createQueryState(queryText: string): QueryWorkspaceState {
  return {
    queryText,
    initialQueryText: "",
    result: null,
    isExecuting: false,
    error: null,
    history: [],
  };
}

describe("buildPersistedSession", () => {
  test("returns null when there is no active connection", () => {
    const session = buildPersistedSession({
      activeConnectionId: null,
      activeWorkspaceId: null,
      workspaces: [],
      tableStateByWorkspaceId: {},
      queryStateByWorkspaceId: {},
      tree: {
        selectedNodeId: null,
        expandedNodeIds: [],
      },
    });

    expect(session).toBeNull();
  });

  test("persists hydrated table state and query text while skipping unloaded tables", () => {
    const tableWorkspace = createTableWorkspace("table-1");
    const unloadedTableWorkspace = createTableWorkspace("table-2");
    const queryWorkspace = createQueryWorkspace("query-1");

    const session = buildPersistedSession({
      activeConnectionId: "conn-1",
      activeWorkspaceId: tableWorkspace.id,
      workspaces: [tableWorkspace, unloadedTableWorkspace, queryWorkspace],
      tableStateByWorkspaceId: {
        [tableWorkspace.id]: createTableState(),
        [unloadedTableWorkspace.id]: createTableState({
          currentSchema: null,
          currentTable: null,
          currentTableType: null,
        }),
      },
      queryStateByWorkspaceId: {
        [queryWorkspace.id]: createQueryState("select * from users;"),
      },
      tree: {
        selectedNodeId: "table:public:users",
        expandedNodeIds: new Set(["schema:public", "table:public:users"]),
      },
    });

    expect(session).not.toBeNull();
    expect(session?.connectionId).toBe("conn-1");
    expect(session?.tableStateByWorkspaceId).toEqual({
      [tableWorkspace.id]: {
        schema: "public",
        table: "users",
        relationType: "table",
        page: 2,
        pageSize: 50,
        orderBy: "name",
        orderDir: "DESC",
        selectedRow: 3,
        selectedCol: 1,
        scrollOffsetX: 0,
      },
    });
    expect(session?.queryStateByWorkspaceId).toEqual({
      [queryWorkspace.id]: {
        queryText: "select * from users;",
      },
    });
    expect(session?.tree).toEqual({
      selectedNodeId: "table:public:users",
      expandedNodeIds: ["schema:public", "table:public:users"],
    });
  });
});
