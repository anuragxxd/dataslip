import { describe, expect, test } from "bun:test";
import { createTableDataStore } from "../../src/store/table-data";
import type { QueryResult } from "../../src/db/types";

function createResult(overrides: Partial<QueryResult> = {}): QueryResult {
  return {
    columns: [
      { name: "id", type: "int4" },
      { name: "name", type: "text" },
      { name: "active", type: "bool" },
      { name: "prefs", type: "jsonb" },
    ],
    rows: [{ id: 1, name: "Ada", active: true, prefs: { theme: "nord" } }],
    rowCount: 1,
    duration: 5,
    ...overrides,
  };
}

describe("table data store", () => {
  test("loads table data, row counts, and primary keys", async () => {
    const store = createTableDataStore({
      getActiveSql: () => ({}) as any,
      queryApi: {
        queryTable: async () => createResult(),
        getTableRowCount: async () => 42,
        getPrimaryKeyColumns: async () => ["id"],
      },
      showToast: () => {},
      generateId: () => "filter-1",
    });

    store.getState().initWorkspace("table-1");
    await store.getState().loadTable("table-1", "public", "users", "table");

    expect(store.getState().getWorkspaceState("table-1")).toMatchObject({
      currentSchema: "public",
      currentTable: "users",
      totalRows: 42,
      primaryKeyColumns: ["id"],
      isLoading: false,
      isInvalid: false,
    });
  });

  test("adds a filter from the selected cell and shows feedback", async () => {
    const toasts: Array<[string, string | undefined]> = [];
    const store = createTableDataStore({
      getActiveSql: () => ({}) as any,
      queryApi: {
        queryTable: async () => createResult(),
        getTableRowCount: async () => 1,
        getPrimaryKeyColumns: async () => ["id"],
      },
      showToast: (message, type) => {
        toasts.push([message, type]);
      },
      generateId: () => "filter-1",
    });

    store.getState().initWorkspace("table-1");
    store.setState({
      byWorkspaceId: {
        "table-1": {
          ...store.getState().getWorkspaceState("table-1"),
          currentSchema: "public",
          currentTable: "users",
          currentTableType: "table",
          result: createResult({ rows: [{ id: 1, name: null, active: true, prefs: { theme: "nord" } }] }),
          selectedRow: 0,
          selectedCol: 1,
        },
      },
    });

    await store.getState().addFilterFromSelectedCell("table-1");

    expect(store.getState().getWorkspaceState("table-1").filters).toEqual([
      {
        id: "filter-1",
        column: "name",
        columnType: "text",
        operator: "is_null",
        value: undefined,
      },
    ]);
    expect(toasts).toContainEqual(["Filtered by name", "info"]);
  });

  test("prepares inline edit confirmations for valid table edits", () => {
    const toasts: Array<[string, string | undefined]> = [];
    const store = createTableDataStore({
      getActiveSql: () => ({}) as any,
      queryApi: {
        queryTable: async () => createResult(),
        getTableRowCount: async () => 1,
        getPrimaryKeyColumns: async () => ["id"],
      },
      showToast: (message, type) => {
        toasts.push([message, type]);
      },
      generateId: () => "filter-1",
    });

    store.getState().initWorkspace("table-1");
    store.setState({
      byWorkspaceId: {
        "table-1": {
          ...store.getState().getWorkspaceState("table-1"),
          currentSchema: "public",
          currentTable: "users",
          currentTableType: "table",
          primaryKeyColumns: ["id"],
          result: createResult(),
          selectedRow: 0,
          selectedCol: 1,
          edit: {
            editMode: true,
            editValue: "Grace",
            editOriginalValue: "Ada",
            editIsNull: false,
          },
        },
      },
    });

    const confirmed = store.getState().prepareEditConfirm("table-1");

    expect(confirmed).toMatchObject({
      column: "name",
      columnType: "text",
      oldDisplay: "\"Ada\"",
      newDisplay: "\"Grace\"",
      isNull: false,
    });
    expect(confirmed?.sql).toContain('UPDATE "public"."users"');
    expect(toasts).toEqual([]);
  });

  test("coerces edited values into the correct runtime types", () => {
    const store = createTableDataStore({
      getActiveSql: () => ({}) as any,
      queryApi: {
        queryTable: async () => createResult(),
        getTableRowCount: async () => 1,
        getPrimaryKeyColumns: async () => ["id"],
      },
      showToast: () => {},
      generateId: () => "filter-1",
    });

    store.getState().initWorkspace("table-1");
    store.setState({
      byWorkspaceId: {
        "table-1": {
          ...store.getState().getWorkspaceState("table-1"),
          currentSchema: "public",
          currentTable: "users",
          currentTableType: "table",
          primaryKeyColumns: ["id"],
          result: createResult(),
          selectedRow: 0,
          selectedCol: 0,
          edit: {
            editMode: true,
            editValue: "",
            editOriginalValue: 1,
            editIsNull: false,
          },
        },
      },
    });

    store.getState().applyEdit("table-1", "id", "7", false);
    store.getState().applyEdit("table-1", "active", "false", false);
    store.getState().applyEdit("table-1", "prefs", '{"theme":"rose-pine"}', false);

    expect(store.getState().getWorkspaceState("table-1").result?.rows[0]).toEqual({
      id: 7,
      name: "Ada",
      active: false,
      prefs: { theme: "rose-pine" },
    });
  });
});
