import { describe, expect, test } from "bun:test";
import { createSchemaStore, type SchemaStoreDependencies } from "../../src/store/schema";
import type { SchemaSearchItem, TableInfo } from "../../src/db/types";
import { createTableWorkspaceState } from "./helpers";

function createDependencies(overrides: Partial<SchemaStoreDependencies> = {}) {
  const calls: Array<[string, ...unknown[]]> = [];

  const deps: SchemaStoreDependencies = {
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
      getWorkspaceState: () => createTableWorkspaceState(),
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
    ...overrides,
  };

  return { deps, calls };
}

function usersTable(schema: string = "public"): TableInfo {
  return { schema, name: "users", type: "table", comment: null, estimatedRows: 42 };
}

describe("schema store", () => {
  test("does nothing when there is no active SQL connection", async () => {
    const store = createSchemaStore({
      getActiveSql: () => null,
      introspectApi: {
        getSchemas: async () => {
          throw new Error("should not be called");
        },
        getTables: async () => [],
        getColumns: async () => [],
        getIndexes: async () => [],
        getForeignKeys: async () => [],
        getSearchItems: async () => [],
      },
      getWorkspaceStore: () => ({ openTableWorkspace: () => ({ id: "", created: false }) }),
      getTableDataStore: () => ({
        getWorkspaceState: () => createTableWorkspaceState(),
        initWorkspace: () => {},
        loadTable: async () => {},
      }),
      getUIStore: () => ({ setActivePanel: () => {} }),
    });

    await store.getState().loadSchemas();
    await store.getState().loadTables("public");
    await store.getState().loadColumns("public", "users");
    await store.getState().loadSearchItems();

    expect(store.getState()).toMatchObject({
      schemas: [],
      tables: {},
      columns: {},
      searchItems: [],
      isLoading: false,
      isSearchLoading: false,
      error: null,
    });
  });

  test("loads schemas, eagerly hydrates public tables, and builds the root tree", async () => {
    const store = createSchemaStore({
      getActiveSql: () => ({}) as any,
      introspectApi: {
        getSchemas: async () => [
          { name: "pg_catalog", isSystem: true },
          { name: "public", isSystem: false },
          { name: "analytics", isSystem: false },
        ],
        getTables: async (_sql, schema) => (schema === "public" ? [usersTable()] : []),
        getColumns: async () => [],
        getIndexes: async () => [],
        getForeignKeys: async () => [],
        getSearchItems: async () => [],
      },
      getWorkspaceStore: () => ({ openTableWorkspace: () => ({ id: "", created: false }) }),
      getTableDataStore: () => ({
        getWorkspaceState: () => createTableWorkspaceState(),
        initWorkspace: () => {},
        loadTable: async () => {},
      }),
      getUIStore: () => ({ setActivePanel: () => {} }),
    });

    await store.getState().loadSchemas();

    expect(store.getState().schemas.map((schema) => schema.name)).toEqual([
      "pg_catalog",
      "public",
      "analytics",
    ]);
    expect(store.getState().tables.public?.map((table) => table.name)).toEqual(["users"]);
    expect(store.getState().expandedNodes.has("schema:public")).toBe(true);
    expect(store.getState().treeNodes.map((node) => node.id)).toEqual([
      "schema:public",
      "schema:analytics",
    ]);
  });

  test("captures load errors for schemas, tables, columns, and search items", async () => {
    const store = createSchemaStore({
      getActiveSql: () => ({}) as any,
      introspectApi: {
        getSchemas: async () => {
          throw new Error("schema failure");
        },
        getTables: async () => {
          throw new Error("table failure");
        },
        getColumns: async () => {
          throw new Error("column failure");
        },
        getIndexes: async () => [],
        getForeignKeys: async () => [],
        getSearchItems: async () => {
          throw new Error("search failure");
        },
      },
      getWorkspaceStore: () => ({ openTableWorkspace: () => ({ id: "", created: false }) }),
      getTableDataStore: () => ({
        getWorkspaceState: () => createTableWorkspaceState(),
        initWorkspace: () => {},
        loadTable: async () => {},
      }),
      getUIStore: () => ({ setActivePanel: () => {} }),
    });

    await store.getState().loadSchemas();
    expect(store.getState()).toMatchObject({ isLoading: false, error: "schema failure" });

    await store.getState().loadTables("public");
    expect(store.getState().error).toBe("table failure");

    await store.getState().loadColumns("public", "users");
    expect(store.getState().error).toBe("column failure");

    await store.getState().loadSearchItems();
    expect(store.getState()).toMatchObject({ isSearchLoading: false, error: "search failure" });
  });

  test("loads tables, columns, indexes, and foreign keys into state", async () => {
    const store = createSchemaStore({
      getActiveSql: () => ({}) as any,
      introspectApi: {
        getSchemas: async () => [],
        getTables: async (_sql, schema) => [usersTable(schema)],
        getColumns: async () => [
          {
            name: "id",
            type: "int4",
            nullable: false,
            defaultValue: null,
            isPrimaryKey: true,
            comment: null,
            ordinalPosition: 1,
          },
        ],
        getIndexes: async () => [
          {
            name: "users_pkey",
            columns: ["id"],
            isUnique: true,
            isPrimary: true,
            definition: "PRIMARY KEY (id)",
          },
        ],
        getForeignKeys: async () => [
          {
            name: "users_org_id_fkey",
            columns: ["org_id"],
            referencedSchema: "public",
            referencedTable: "orgs",
            referencedColumns: ["id"],
            updateRule: "NO ACTION",
            deleteRule: "CASCADE",
          },
        ],
        getSearchItems: async () => [],
      },
      getWorkspaceStore: () => ({ openTableWorkspace: () => ({ id: "", created: false }) }),
      getTableDataStore: () => ({
        getWorkspaceState: () => createTableWorkspaceState(),
        initWorkspace: () => {},
        loadTable: async () => {},
      }),
      getUIStore: () => ({ setActivePanel: () => {} }),
    });

    await store.getState().loadTables("public");
    await store.getState().loadColumns("public", "users");

    expect(store.getState().tables.public).toEqual([usersTable()]);
    expect(store.getState().columns["public.users"]).toHaveLength(1);
    expect(store.getState().indexes["public.users"]).toHaveLength(1);
    expect(store.getState().foreignKeys["public.users"]).toHaveLength(1);
  });

  test("toggleNode expands and lazily loads schemas and tables only when missing", async () => {
    const loads: string[] = [];
    const store = createSchemaStore({
      getActiveSql: () => ({}) as any,
      introspectApi: {
        getSchemas: async () => [],
        getTables: async (_sql, schema) => {
          loads.push(`tables:${schema}`);
          return [usersTable(schema)];
        },
        getColumns: async (_sql, schema, table) => {
          loads.push(`columns:${schema}.${table}`);
          return [];
        },
        getIndexes: async () => [],
        getForeignKeys: async () => [],
        getSearchItems: async () => [],
      },
      getWorkspaceStore: () => ({ openTableWorkspace: () => ({ id: "", created: false }) }),
      getTableDataStore: () => ({
        getWorkspaceState: () => createTableWorkspaceState(),
        initWorkspace: () => {},
        loadTable: async () => {},
      }),
      getUIStore: () => ({ setActivePanel: () => {} }),
    });

    store.getState().toggleNode("schema:public");
    await Promise.resolve();
    expect(loads).toEqual(["tables:public"]);
    expect(store.getState().expandedNodes.has("schema:public")).toBe(true);

    store.setState({ tables: { public: [usersTable()] } });
    store.getState().toggleNode("table:public:users");
    await Promise.resolve();
    expect(loads).toEqual(["tables:public", "columns:public.users"]);

    store.setState({ columns: { "public.users": [] } });
    store.getState().toggleNode("table:public:users");
    await Promise.resolve();
    expect(loads).toEqual(["tables:public", "columns:public.users"]);
  });

  test("jumpToNode expands the correct ancestors for tables, views, columns, indexes, and foreign keys", () => {
    const store = createSchemaStore();

    store.setState({
      tables: {
        public: [
          { schema: "public", name: "orders", type: "table", comment: null, estimatedRows: 0 },
          { schema: "public", name: "order_summary", type: "view", comment: null, estimatedRows: 0 },
        ],
      },
    });

    store.getState().jumpToNode("table:public:orders");
    expect(Array.from(store.getState().expandedNodes)).toEqual([
      "schema:public",
      "table-group:public",
    ]);

    store.getState().jumpToNode("column:public:orders:status");
    expect(Array.from(store.getState().expandedNodes)).toEqual([
      "schema:public",
      "table-group:public",
      "table:public:orders",
    ]);

    store.getState().jumpToNode("index:public:orders:orders_pkey");
    expect(Array.from(store.getState().expandedNodes)).toContain("index-group:public:orders");

    store.getState().jumpToNode("fk:public:orders:orders_user_id_fkey");
    expect(Array.from(store.getState().expandedNodes)).toContain("fk-group:public:orders");

    store.getState().jumpToNode("view:public:order_summary");
    expect(Array.from(store.getState().expandedNodes)).toContain("view-group:public");
    expect(store.getState().selectedNodeId).toBe("view:public:order_summary");
  });

  test("jumpToTable loads missing tables and columns before selecting the target node", async () => {
    const store = createSchemaStore({
      getActiveSql: () => ({}) as any,
      introspectApi: {
        getSchemas: async () => [],
        getTables: async () => [usersTable()],
        getColumns: async () => [],
        getIndexes: async () => [],
        getForeignKeys: async () => [],
        getSearchItems: async () => [],
      },
      getWorkspaceStore: () => ({ openTableWorkspace: () => ({ id: "", created: false }) }),
      getTableDataStore: () => ({
        getWorkspaceState: () => createTableWorkspaceState(),
        initWorkspace: () => {},
        loadTable: async () => {},
      }),
      getUIStore: () => ({ setActivePanel: () => {} }),
    });

    await store.getState().jumpToTable("public", "users");

    expect(store.getState().selectedNodeId).toBe("table:public:users");
    expect(Array.from(store.getState().expandedNodes)).toEqual([
      "schema:public",
      "table-group:public",
    ]);
  });

  test("openItem handles schema items without touching workspaces", async () => {
    const { deps, calls } = createDependencies();
    const store = createSchemaStore(deps);

    await store.getState().openItem({
      nodeId: "schema:public",
      label: "public",
      type: "schema",
      schema: "public",
      searchText: "public",
    });

    expect(calls).toEqual([["setActivePanel", "sidebar"]]);
    expect(store.getState().selectedNodeId).toBe("schema:public");
  });

  test("openItem hydrates new table workspaces and jumps to child nodes when needed", async () => {
    const { deps, calls } = createDependencies();
    const item: SchemaSearchItem = {
      nodeId: "column:public:users:name",
      label: "name",
      type: "column",
      schema: "public",
      table: "users",
      searchText: "users name",
    };
    const store = createSchemaStore({
      ...deps,
      introspectApi: {
        ...deps.introspectApi,
        getTables: async () => [usersTable()],
        getColumns: async () => [],
      },
    });

    await store.getState().openItem(item);

    expect(calls).toEqual([
      ["openTableWorkspace", "public", "users", "table"],
      ["setActivePanel", "grid"],
      ["initWorkspace", "workspace-1"],
      ["loadTable", "workspace-1", "public", "users", "table"],
    ]);
    expect(store.getState().selectedNodeId).toBe("column:public:users:name");
  });

  test("openItem skips hydration for already-loaded workspaces", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const store = createSchemaStore({
      getActiveSql: () => ({}) as any,
      introspectApi: {
        getSchemas: async () => [],
        getTables: async () => [usersTable()],
        getColumns: async () => [],
        getIndexes: async () => [],
        getForeignKeys: async () => [],
        getSearchItems: async () => [],
      },
      getWorkspaceStore: () => ({
        openTableWorkspace: (schema, table, relationType) => {
          calls.push(["openTableWorkspace", schema, table, relationType]);
          return { id: "workspace-1", created: false };
        },
      }),
      getTableDataStore: () => ({
        getWorkspaceState: () =>
          createTableWorkspaceState({
            currentSchema: "public",
            currentTable: "users",
            currentTableType: "table",
            result: {
              columns: [],
              rows: [],
              rowCount: 0,
              duration: 0,
            },
            isLoading: false,
            isInvalid: false,
          }),
        initWorkspace: () => {
          calls.push(["initWorkspace"]);
        },
        loadTable: async () => {
          calls.push(["loadTable"]);
        },
      }),
      getUIStore: () => ({
        setActivePanel: (panel) => {
          calls.push(["setActivePanel", panel]);
        },
      }),
    });

    await store.getState().openItem({
      nodeId: "table:public:users",
      label: "users",
      type: "table",
      schema: "public",
      table: "users",
      searchText: "users",
    });

    expect(calls).toEqual([
      ["openTableWorkspace", "public", "users", "table"],
      ["setActivePanel", "grid"],
    ]);
  });

  test("caches search items after the first load and ignores repeated in-flight loads", async () => {
    let resolveSearch: ((value: SchemaSearchItem[]) => void) | null = null;
    let loads = 0;
    const promise = new Promise<SchemaSearchItem[]>((resolve) => {
      resolveSearch = resolve;
    });

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
          return promise;
        },
      },
      getWorkspaceStore: () => ({ openTableWorkspace: () => ({ id: "", created: false }) }),
      getTableDataStore: () => ({
        getWorkspaceState: () => createTableWorkspaceState(),
        initWorkspace: () => {},
        loadTable: async () => {},
      }),
      getUIStore: () => ({ setActivePanel: () => {} }),
    });

    const first = store.getState().loadSearchItems();
    const second = store.getState().loadSearchItems();
    expect(loads).toBe(1);
    expect(store.getState().isSearchLoading).toBe(true);

    const runResolve = resolveSearch as ((value: SchemaSearchItem[]) => void) | null;
    if (!runResolve) {
      throw new Error("expected search resolver");
    }

    runResolve([
      {
        nodeId: "table:public:users",
        label: "users",
        type: "table",
        schema: "public",
        table: "users",
        searchText: "users",
      },
    ]);
    await Promise.all([first, second]);
    await store.getState().loadSearchItems();

    expect(loads).toBe(1);
    expect(store.getState().searchItems).toHaveLength(1);
    expect(store.getState().isSearchLoading).toBe(false);
  });

  test("buildTree includes tables, views, indexes, foreign keys, and columns while skipping system schemas", () => {
    const store = createSchemaStore();

    store.setState({
      schemas: [
        { name: "pg_catalog", isSystem: true },
        { name: "public", isSystem: false },
      ],
      tables: {
        public: [
          { schema: "public", name: "users", type: "table", comment: "Users table", estimatedRows: 42 },
          { schema: "public", name: "user_summary", type: "view", comment: "Summary", estimatedRows: 0 },
        ],
      },
      columns: {
        "public.users": [
          {
            name: "id",
            type: "int4",
            nullable: false,
            defaultValue: null,
            isPrimaryKey: true,
            comment: null,
            ordinalPosition: 1,
          },
          {
            name: "name",
            type: "text",
            nullable: true,
            defaultValue: null,
            isPrimaryKey: false,
            comment: null,
            ordinalPosition: 2,
          },
        ],
        "public.user_summary": [
          {
            name: "count",
            type: "int4",
            nullable: false,
            defaultValue: null,
            isPrimaryKey: false,
            comment: null,
            ordinalPosition: 1,
          },
        ],
      },
      indexes: {
        "public.users": [
          {
            name: "users_pkey",
            columns: ["id"],
            isUnique: true,
            isPrimary: true,
            definition: "PRIMARY KEY (id)",
          },
        ],
      },
      foreignKeys: {
        "public.users": [
          {
            name: "users_org_id_fkey",
            columns: ["org_id"],
            referencedSchema: "public",
            referencedTable: "orgs",
            referencedColumns: ["id"],
            updateRule: "NO ACTION",
            deleteRule: "CASCADE",
          },
        ],
      },
      expandedNodes: new Set([
        "schema:public",
        "table-group:public",
        "view-group:public",
        "table:public:users",
        "view:public:user_summary",
        "index-group:public:users",
        "fk-group:public:users",
      ]),
    });

    const tree = store.getState().buildTree();

    expect(tree).toHaveLength(1);
    const schema = tree[0];
    expect(schema.id).toBe("schema:public");
    expect(schema.children?.map((child) => child.id)).toEqual([
      "table-group:public",
      "view-group:public",
    ]);

    const tableNode = schema.children?.[0].children?.[0];
    expect(tableNode).toMatchObject({
      id: "table:public:users",
      label: "users",
      meta: { schema: "public", estimatedRows: 42, comment: "Users table" },
    });
    expect(tableNode?.children?.map((child) => child.id)).toEqual([
      "index-group:public:users",
      "fk-group:public:users",
      "column:public:users:id",
      "column:public:users:name",
    ]);
    expect(tableNode?.children?.[0].children?.[0].label).toContain("PK");
    expect(tableNode?.children?.[1].children?.[0].label).toContain("orgs.id");

    const viewNode = schema.children?.[1].children?.[0];
    expect(viewNode).toMatchObject({
      id: "view:public:user_summary",
      label: "user_summary",
      meta: { schema: "public", comment: "Summary" },
    });
    expect(viewNode?.children?.[0].label).toBe("count int4 NOT NULL");
  });
});
