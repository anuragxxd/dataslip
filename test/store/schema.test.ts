import { describe, expect, test } from "bun:test";
import { createSchemaStore } from "../../src/store/schema";
import type { SchemaSearchItem } from "../../src/db/types";

describe("schema store", () => {
  test("loads schemas, eagerly hydrates public tables, and builds the tree", async () => {
    const store = createSchemaStore({
      getActiveSql: () => ({}) as any,
      introspectApi: {
        getSchemas: async () => [
          { name: "public", isSystem: false },
          { name: "analytics", isSystem: false },
        ],
        getTables: async (sql, schema) =>
          schema === "public"
            ? [{ schema, name: "users", type: "table", comment: null, estimatedRows: 42 }]
            : [],
        getColumns: async () => [],
        getIndexes: async () => [],
        getForeignKeys: async () => [],
        getSearchItems: async () => [],
      },
      getWorkspaceStore: () => ({ openTableWorkspace: () => ({ id: "", created: false }) }),
      getTableDataStore: () => ({
        getWorkspaceState: () => ({
          currentSchema: null,
          currentTable: null,
          currentTableType: null,
          primaryKeyColumns: [],
          result: null,
          totalRows: 0,
          page: 1,
          pageSize: 50,
          orderBy: null,
          orderDir: "ASC",
          quickSearch: "",
          filters: [],
          selectedRow: 0,
          selectedCol: 0,
          scrollOffsetX: 0,
          isLoading: false,
          error: null,
          isInvalid: false,
          edit: { editMode: false, editValue: "", editOriginalValue: undefined, editIsNull: false },
        }),
        initWorkspace: () => {},
        loadTable: async () => {},
      }),
      getUIStore: () => ({ setActivePanel: () => {} }),
    });

    await store.getState().loadSchemas();

    expect(store.getState().schemas.map((schema) => schema.name)).toEqual(["public", "analytics"]);
    expect(store.getState().tables.public?.map((table) => table.name)).toEqual(["users"]);
    expect(store.getState().expandedNodes.has("schema:public")).toBe(true);
    expect(store.getState().treeNodes.map((node) => node.id)).toEqual([
      "schema:public",
      "schema:analytics",
    ]);
  });

  test("jumpToNode expands the required ancestors for fk nodes", () => {
    const store = createSchemaStore();

    store.setState({
      tables: {
        public: [{ schema: "public", name: "orders", type: "table", comment: null, estimatedRows: 0 }],
      },
    });

    store.getState().jumpToNode("fk:public:orders:orders_user_id_fkey");

    expect(Array.from(store.getState().expandedNodes)).toEqual([
      "schema:public",
      "table-group:public",
      "table:public:orders",
      "fk-group:public:orders",
    ]);
    expect(store.getState().selectedNodeId).toBe("fk:public:orders:orders_user_id_fkey");
  });

  test("opens table search items by wiring workspace, data, and ui dependencies", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const item: SchemaSearchItem = {
      nodeId: "table:public:users",
      label: "users",
      type: "table",
      schema: "public",
      table: "users",
      searchText: "users",
    };

    const store = createSchemaStore({
      getActiveSql: () => ({}) as any,
      introspectApi: {
        getSchemas: async () => [],
        getTables: async () => [],
        getColumns: async () => [],
        getIndexes: async () => [],
        getForeignKeys: async () => [],
        getSearchItems: async () => [],
      },
      getWorkspaceStore: () => ({
        openTableWorkspace: (schema, table, relationType) => {
          calls.push(["openTableWorkspace", schema, table, relationType]);
          return { id: "workspace-1", created: true };
        },
      }),
      getTableDataStore: () => ({
        getWorkspaceState: () => ({
          currentSchema: null,
          currentTable: null,
          currentTableType: null,
          primaryKeyColumns: [],
          result: null,
          totalRows: 0,
          page: 1,
          pageSize: 50,
          orderBy: null,
          orderDir: "ASC",
          quickSearch: "",
          filters: [],
          selectedRow: 0,
          selectedCol: 0,
          scrollOffsetX: 0,
          isLoading: false,
          error: null,
          isInvalid: false,
          edit: { editMode: false, editValue: "", editOriginalValue: undefined, editIsNull: false },
        }),
        initWorkspace: (workspaceId) => {
          calls.push(["initWorkspace", workspaceId]);
        },
        loadTable: async (workspaceId, schema, table, relationType) => {
          calls.push(["loadTable", workspaceId, schema, table, relationType]);
        },
      }),
      getUIStore: () => ({
        setActivePanel: (panel) => {
          calls.push(["setActivePanel", panel]);
        },
      }),
    });

    store.setState({
      tables: {
        public: [{ schema: "public", name: "users", type: "table", comment: null, estimatedRows: 0 }],
      },
      jumpToTable: async (schema, table) => {
        calls.push(["jumpToTable", schema, table]);
      },
    });

    await store.getState().openItem(item);

    expect(calls).toEqual([
      ["openTableWorkspace", "public", "users", "table"],
      ["setActivePanel", "grid"],
      ["initWorkspace", "workspace-1"],
      ["loadTable", "workspace-1", "public", "users", "table"],
      ["jumpToTable", "public", "users"],
    ]);
  });

  test("caches search items after the first load", async () => {
    let loads = 0;
    const store = createSchemaStore({
      getActiveSql: () => ({}) as any,
      introspectApi: {
        getSchemas: async () => [],
        getTables: async () => [],
        getColumns: async () => [],
        getIndexes: async () => [],
        getForeignKeys: async () => [],
        getSearchItems: async () => {
          loads += 1;
          return [
            {
              nodeId: "table:public:users",
              label: "users",
              type: "table",
              schema: "public",
              table: "users",
              searchText: "users",
            },
          ];
        },
      },
      getWorkspaceStore: () => ({ openTableWorkspace: () => ({ id: "", created: false }) }),
      getTableDataStore: () => ({
        getWorkspaceState: () => ({
          currentSchema: null,
          currentTable: null,
          currentTableType: null,
          primaryKeyColumns: [],
          result: null,
          totalRows: 0,
          page: 1,
          pageSize: 50,
          orderBy: null,
          orderDir: "ASC",
          quickSearch: "",
          filters: [],
          selectedRow: 0,
          selectedCol: 0,
          scrollOffsetX: 0,
          isLoading: false,
          error: null,
          isInvalid: false,
          edit: { editMode: false, editValue: "", editOriginalValue: undefined, editIsNull: false },
        }),
        initWorkspace: () => {},
        loadTable: async () => {},
      }),
      getUIStore: () => ({ setActivePanel: () => {} }),
    });

    await store.getState().loadSearchItems();
    await store.getState().loadSearchItems();

    expect(loads).toBe(1);
    expect(store.getState().searchItems).toHaveLength(1);
  });
});
