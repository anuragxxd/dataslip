import { describe, expect, test } from "bun:test";
import type { QueryResult, TableFilterClause } from "../../src/db/types";
import { createTableDataStore } from "../../src/store/table-data";
import { createQueryResult, createTableWorkspaceState } from "./helpers";

function createHarness(options: {
  activeSql?: unknown;
  queryTable?: (...args: any[]) => Promise<QueryResult>;
  getTableRowCount?: (...args: any[]) => Promise<number>;
  getPrimaryKeyColumns?: (...args: any[]) => Promise<string[]>;
  generateId?: () => string;
} = {}) {
  const toasts: Array<[string, string | undefined]> = [];
  const calls = {
    queryTable: [] as any[],
    getTableRowCount: [] as any[],
    getPrimaryKeyColumns: [] as any[],
  };

  const store = createTableDataStore({
    getActiveSql: () => (options.activeSql === undefined ? ({}) : options.activeSql) as any,
    queryApi: {
      queryTable: async (...args) => {
        calls.queryTable.push(args);
        if (options.queryTable) return options.queryTable(...args);
        return createQueryResult();
      },
      getTableRowCount: async (...args) => {
        calls.getTableRowCount.push(args);
        if (options.getTableRowCount) return options.getTableRowCount(...args);
        return 1;
      },
      getPrimaryKeyColumns: async (...args) => {
        calls.getPrimaryKeyColumns.push(args);
        if (options.getPrimaryKeyColumns) return options.getPrimaryKeyColumns(...args);
        return ["id"];
      },
    },
    showToast: (message, type) => {
      toasts.push([message, type]);
    },
    generateId: options.generateId || (() => "filter-1"),
  });

  return { store, toasts, calls };
}

describe("table data store", () => {
  test("creates default workspace state, ignores duplicate init, removes workspaces, and resets", () => {
    const { store } = createHarness();

    expect(store.getState().getWorkspaceState("missing")).toEqual(createTableWorkspaceState());

    store.getState().initWorkspace("table-1");
    const initial = store.getState().getWorkspaceState("table-1");
    store.getState().initWorkspace("table-1");

    expect(store.getState().byWorkspaceId).toEqual({ "table-1": initial });

    store.getState().removeWorkspace("table-1");
    expect(store.getState().byWorkspaceId).toEqual({});

    store.getState().initWorkspace("table-2");
    store.getState().reset();
    expect(store.getState().byWorkspaceId).toEqual({});
  });

  test("loadTable is a no-op without SQL, loads table data with primary keys, and skips PK lookup for views", async () => {
    const noSql = createHarness({ activeSql: null });
    await noSql.store.getState().loadTable("table-1", "public", "users", "table");
    expect(noSql.store.getState().byWorkspaceId).toEqual({});

    const tableHarness = createHarness({
      getTableRowCount: async () => 42,
      getPrimaryKeyColumns: async () => ["id", "tenant_id"],
    });
    tableHarness.store.getState().initWorkspace("table-1");
    await tableHarness.store.getState().loadTable("table-1", "public", "users", "table");

    expect(tableHarness.store.getState().getWorkspaceState("table-1")).toMatchObject({
      currentSchema: "public",
      currentTable: "users",
      currentTableType: "table",
      totalRows: 42,
      primaryKeyColumns: ["id", "tenant_id"],
      isLoading: false,
      isInvalid: false,
      quickSearch: "",
      filters: [],
      orderBy: null,
      orderDir: "ASC",
    });
    expect(tableHarness.calls.getPrimaryKeyColumns).toHaveLength(1);

    const viewHarness = createHarness();
    viewHarness.store.getState().initWorkspace("view-1");
    await viewHarness.store.getState().loadTable("view-1", "public", "user_summary", "view");

    expect(viewHarness.store.getState().getWorkspaceState("view-1").primaryKeyColumns).toEqual([]);
    expect(viewHarness.calls.getPrimaryKeyColumns).toHaveLength(0);
  });

  test("loadTable captures fetch failures as invalid table state", async () => {
    const { store } = createHarness({
      queryTable: async () => {
        throw new Error("relation does not exist");
      },
    });

    store.getState().initWorkspace("table-1");
    await store.getState().loadTable("table-1", "public", "missing_table", "table");

    expect(store.getState().getWorkspaceState("table-1")).toMatchObject({
      isLoading: false,
      isInvalid: true,
      error: "relation does not exist",
    });
  });

  test("applyViewConstraints, quick search, filters, and clearSearchAndFilters reset navigation and reload data", async () => {
    const queryResults = [
      createQueryResult({ rows: [{ id: 1, name: "Ada", active: true, prefs: {} }] }),
      createQueryResult({ rows: [{ id: 2, name: "Grace", active: false, prefs: {} }] }),
      createQueryResult({ rows: [{ id: 3, name: "Linus", active: true, prefs: {} }] }),
      createQueryResult({ rows: [{ id: 4, name: "Margaret", active: true, prefs: {} }] }),
    ];
    const counts = [3, 2, 1, 4];
    let index = 0;
    const { store } = createHarness({
      queryTable: async () => queryResults[index],
      getTableRowCount: async () => counts[index++],
    });

    store.setState({
      byWorkspaceId: {
        "table-1": createTableWorkspaceState({
          currentSchema: "public",
          currentTable: "users",
          currentTableType: "table",
          page: 4,
          selectedRow: 3,
          selectedCol: 2,
          scrollOffsetX: 9,
          quickSearch: "old",
          filters: [
            {
              id: "old",
              column: "name",
              columnType: "text",
              operator: "contains",
              value: "old",
            },
          ],
          edit: {
            editMode: true,
            editValue: "stale",
            editOriginalValue: "stale",
            editIsNull: false,
          },
          isInvalid: true,
        }),
      },
    });

    const nextFilters: TableFilterClause[] = [
      {
        id: "next",
        column: "active",
        columnType: "bool",
        operator: "=",
        value: "true",
      },
    ];

    await store.getState().applyViewConstraints("table-1", {
      quickSearch: "  Ada  ",
      filters: nextFilters,
    });
    expect(store.getState().getWorkspaceState("table-1")).toMatchObject({
      quickSearch: "Ada",
      filters: nextFilters,
      page: 1,
      selectedRow: 0,
      selectedCol: 0,
      scrollOffsetX: 0,
      isLoading: false,
      totalRows: 3,
      isInvalid: false,
      edit: createTableWorkspaceState().edit,
    });

    await store.getState().applyQuickSearch("table-1", "Grace");
    expect(store.getState().getWorkspaceState("table-1")).toMatchObject({
      quickSearch: "Grace",
      filters: nextFilters,
      totalRows: 2,
    });

    await store.getState().applyFilters("table-1", []);
    expect(store.getState().getWorkspaceState("table-1")).toMatchObject({
      quickSearch: "Grace",
      filters: [],
      totalRows: 1,
    });

    await store.getState().clearSearchAndFilters("table-1");
    expect(store.getState().getWorkspaceState("table-1")).toMatchObject({
      quickSearch: "",
      filters: [],
      totalRows: 4,
    });
  });

  test("addFilterFromSelectedCell handles missing selections, null cells, and concrete values", async () => {
    const { store, toasts } = createHarness({ generateId: () => "filter-1" });

    store.setState({
      byWorkspaceId: {
        "table-1": createTableWorkspaceState({
          currentSchema: "public",
          currentTable: "users",
          currentTableType: "table",
          result: createQueryResult(),
          selectedRow: 4,
          selectedCol: 10,
        }),
      },
    });

    await store.getState().addFilterFromSelectedCell("table-1");
    expect(toasts).toContainEqual(["No cell selected", "warning"]);

    store.setState({
      byWorkspaceId: {
        "table-1": createTableWorkspaceState({
          currentSchema: "public",
          currentTable: "users",
          currentTableType: "table",
          result: createQueryResult({ rows: [{ id: 1, name: null, active: true, prefs: {} }] }),
          selectedRow: 0,
          selectedCol: 1,
        }),
      },
    });
    await store.getState().addFilterFromSelectedCell("table-1", "!=");
    expect(store.getState().getWorkspaceState("table-1").filters).toEqual([
      {
        id: "filter-1",
        column: "name",
        columnType: "text",
        operator: "is_not_null",
        value: undefined,
      },
    ]);

    store.setState({
      byWorkspaceId: {
        "table-1": createTableWorkspaceState({
          currentSchema: "public",
          currentTable: "users",
          currentTableType: "table",
          filters: [],
          result: createQueryResult(),
          selectedRow: 0,
          selectedCol: 3,
        }),
      },
    });
    await store.getState().addFilterFromSelectedCell("table-1");
    expect(store.getState().getWorkspaceState("table-1").filters[0]).toMatchObject({
      column: "prefs",
      operator: "=",
      value: '{"theme":"nord"}',
    });
    expect(toasts).toContainEqual(["Filtered by prefs", "info"]);
  });

  test("pagination, sizing, sorting, reload, selection movement, and offsets cover boundary cases", async () => {
    const { store, calls } = createHarness({
      getTableRowCount: async () => 9,
      getPrimaryKeyColumns: async () => ["id"],
    });

    store.setState({
      byWorkspaceId: {
        "table-1": createTableWorkspaceState({
          currentSchema: "public",
          currentTable: "users",
          currentTableType: "table",
          result: createQueryResult({
            columns: [
              { name: "id", type: "int4" },
              { name: "name", type: "text" },
            ],
            rows: [
              { id: 1, name: "Ada" },
              { id: 2, name: "Grace" },
            ],
          }),
          selectedRow: 1,
          selectedCol: 1,
          scrollOffsetX: 5,
          edit: {
            editMode: true,
            editValue: "draft",
            editOriginalValue: "Ada",
            editIsNull: false,
          },
        }),
      },
    });

    store.getState().moveSelection("table-1", 10, 10);
    expect(store.getState().getWorkspaceState("table-1")).toMatchObject({ selectedRow: 1, selectedCol: 1 });
    store.getState().moveSelection("table-1", -10, -10);
    expect(store.getState().getWorkspaceState("table-1")).toMatchObject({ selectedRow: 0, selectedCol: 0 });

    store.getState().setSelectedRow("table-1", 1);
    store.getState().setSelectedCol("table-1", 1);
    store.getState().setScrollOffsetX("table-1", 7);
    expect(store.getState().getWorkspaceState("table-1")).toMatchObject({
      selectedRow: 1,
      selectedCol: 1,
      scrollOffsetX: 7,
    });

    await store.getState().setPage("table-1", 3);
    expect(store.getState().getWorkspaceState("table-1")).toMatchObject({
      page: 3,
      selectedRow: 0,
      totalRows: 9,
      isLoading: false,
    });
    expect(calls.queryTable.at(-1)?.[3]).toMatchObject({ page: 3, pageSize: 50 });

    await store.getState().setPageSize("table-1", 100);
    expect(store.getState().getWorkspaceState("table-1")).toMatchObject({
      page: 1,
      pageSize: 100,
      totalRows: 9,
    });

    await store.getState().setSort("table-1", "name");
    expect(store.getState().getWorkspaceState("table-1")).toMatchObject({
      orderBy: "name",
      orderDir: "ASC",
      page: 1,
    });
    await store.getState().setSort("table-1", "name");
    expect(store.getState().getWorkspaceState("table-1")).toMatchObject({
      orderBy: "name",
      orderDir: "DESC",
    });

    store.setState({
      byWorkspaceId: {
        "table-1": {
          ...store.getState().getWorkspaceState("table-1"),
          selectedRow: 1,
          selectedCol: 1,
          scrollOffsetX: 9,
          edit: {
            editMode: true,
            editValue: "draft",
            editOriginalValue: "Ada",
            editIsNull: false,
          },
        },
      },
    });
    await store.getState().reloadCurrent("table-1");
    expect(store.getState().getWorkspaceState("table-1")).toMatchObject({
      selectedRow: 0,
      selectedCol: 0,
      scrollOffsetX: 0,
      edit: createTableWorkspaceState().edit,
      primaryKeyColumns: ["id"],
      totalRows: 9,
    });
  });

  test("edit lifecycle covers start, set, toggle, cancel, validation, no-op, and success cases", () => {
    const { store, toasts } = createHarness();

    store.setState({
      byWorkspaceId: {
        view: createTableWorkspaceState({ currentTableType: "view" }),
        noPk: createTableWorkspaceState({ currentTableType: "table", primaryKeyColumns: [] }),
        missing: createTableWorkspaceState({ currentTableType: "table", primaryKeyColumns: ["id"] }),
        table: createTableWorkspaceState({
          currentSchema: "public",
          currentTable: "users",
          currentTableType: "table",
          primaryKeyColumns: ["id"],
          result: createQueryResult(),
          selectedRow: 0,
          selectedCol: 1,
        }),
      },
    });

    expect(store.getState().startEdit("view")).toBe(false);
    expect(store.getState().startEdit("noPk")).toBe(false);
    expect(store.getState().startEdit("missing")).toBe(false);
    expect(toasts).toContainEqual(["Cannot edit views", "warning"]);
    expect(toasts).toContainEqual(["Cannot edit: table has no primary key", "warning"]);

    expect(store.getState().startEdit("table")).toBe(true);
    expect(store.getState().getWorkspaceState("table").edit).toEqual({
      editMode: true,
      editValue: "Ada",
      editOriginalValue: "Ada",
      editIsNull: false,
    });

    store.getState().setEditValue("table", "Grace");
    expect(store.getState().getWorkspaceState("table").edit).toMatchObject({ editValue: "Grace", editIsNull: false });
    store.getState().toggleEditNull("table");
    expect(store.getState().getWorkspaceState("table").edit).toMatchObject({ editIsNull: true, editValue: "" });
    store.getState().toggleEditNull("table");
    expect(store.getState().getWorkspaceState("table").edit.editIsNull).toBe(false);
    store.getState().cancelEdit("table");
    expect(store.getState().getWorkspaceState("table").edit).toEqual(createTableWorkspaceState().edit);

    store.setState({
      byWorkspaceId: {
        table: createTableWorkspaceState({
          currentSchema: "public",
          currentTable: "users",
          currentTableType: "table",
          primaryKeyColumns: ["id"],
          result: createQueryResult(),
          selectedRow: 0,
          selectedCol: 0,
          edit: {
            editMode: true,
            editValue: "oops",
            editOriginalValue: 1,
            editIsNull: false,
          },
        }),
      },
    });
    expect(store.getState().prepareEditConfirm("table")).toBeNull();
    expect(toasts.at(-1)?.[0]).toContain("Invalid integer value");

    store.setState({
      byWorkspaceId: {
        table: createTableWorkspaceState({
          currentSchema: "public",
          currentTable: "users",
          currentTableType: "table",
          primaryKeyColumns: ["id"],
          result: createQueryResult(),
          selectedRow: 0,
          selectedCol: 1,
          edit: {
            editMode: true,
            editValue: "Ada",
            editOriginalValue: "Ada",
            editIsNull: false,
          },
        }),
      },
    });
    expect(store.getState().prepareEditConfirm("table")).toBeNull();
    expect(toasts.at(-1)).toEqual(["No change", "info"]);

    store.setState({
      byWorkspaceId: {
        table: createTableWorkspaceState({
          currentSchema: "public",
          currentTable: "users",
          currentTableType: "table",
          primaryKeyColumns: ["id"],
          result: createQueryResult({ rows: [{ id: 1, name: null, active: true, prefs: {} }] }),
          selectedRow: 0,
          selectedCol: 1,
          edit: {
            editMode: true,
            editValue: "",
            editOriginalValue: null,
            editIsNull: true,
          },
        }),
      },
    });
    expect(store.getState().prepareEditConfirm("table")).toBeNull();
    expect(toasts.at(-1)).toEqual(["No change - value is still NULL", "info"]);

    store.setState({
      byWorkspaceId: {
        table: createTableWorkspaceState({
          currentSchema: "public",
          currentTable: "users",
          currentTableType: "table",
          primaryKeyColumns: ["id"],
          result: createQueryResult({ rows: [{ id: null, name: "Ada", active: true, prefs: {} }] }),
          selectedRow: 0,
          selectedCol: 1,
          edit: {
            editMode: true,
            editValue: "Grace",
            editOriginalValue: "Ada",
            editIsNull: false,
          },
        }),
      },
    });
    expect(store.getState().prepareEditConfirm("table")).toBeNull();
    expect(toasts.at(-1)?.[0]).toContain('primary key column "id" is NULL');

    store.setState({
      byWorkspaceId: {
        table: createTableWorkspaceState({
          currentSchema: "public",
          currentTable: "users",
          currentTableType: "table",
          primaryKeyColumns: ["id"],
          result: createQueryResult(),
          selectedRow: 0,
          selectedCol: 1,
          edit: {
            editMode: true,
            editValue: "Grace",
            editOriginalValue: "Ada",
            editIsNull: false,
          },
        }),
      },
    });
    const confirmation = store.getState().prepareEditConfirm("table");
    expect(confirmation).toMatchObject({
      column: "name",
      columnType: "text",
      oldDisplay: '"Ada"',
      newDisplay: '"Grace"',
      isNull: false,
    });
    expect(confirmation?.sql).toContain('UPDATE "public"."users"');
  });

  test("applyEdit coerces integer, float, boolean, json, string, and null values", () => {
    const { store } = createHarness();

    store.setState({
      byWorkspaceId: {
        "table-1": createTableWorkspaceState({
          currentSchema: "public",
          currentTable: "users",
          currentTableType: "table",
          primaryKeyColumns: ["id"],
          result: createQueryResult({
            columns: [
              { name: "id", type: "int4" },
              { name: "score", type: "numeric" },
              { name: "active", type: "bool" },
              { name: "prefs", type: "jsonb" },
              { name: "name", type: "text" },
            ],
            rows: [{ id: 1, score: 1.5, active: true, prefs: { theme: "nord" }, name: "Ada" }],
          }),
          selectedRow: 0,
          selectedCol: 0,
        }),
      },
    });

    store.getState().applyEdit("table-1", "id", "7", false);
    store.getState().applyEdit("table-1", "score", "3.14", false);
    store.getState().applyEdit("table-1", "active", "false", false);
    store.getState().applyEdit("table-1", "prefs", '{"theme":"rose-pine"}', false);
    store.getState().applyEdit("table-1", "prefs", '{oops', false);
    store.getState().applyEdit("table-1", "name", "Grace", false);
    store.getState().applyEdit("table-1", "name", "ignored", true);

    expect(store.getState().getWorkspaceState("table-1").result?.rows[0]).toEqual({
      id: 7,
      score: 3.14,
      active: false,
      prefs: "{oops",
      name: null,
    });
    expect(store.getState().getWorkspaceState("table-1").edit).toEqual(createTableWorkspaceState().edit);
  });
});
