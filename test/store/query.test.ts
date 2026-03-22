import { describe, expect, test } from "bun:test";
import { createQueryStore } from "../../src/store/query";
import type { QueryResult } from "../../src/db/types";

function createResult(overrides: Partial<QueryResult> = {}): QueryResult {
  return {
    columns: [{ name: "id", type: "int4" }],
    rows: [{ id: 1 }],
    rowCount: 1,
    duration: 12,
    ...overrides,
  };
}

describe("query store", () => {
  test("initializes workspaces once and seeds from a table", () => {
    const store = createQueryStore({
      getActiveSql: () => ({}) as any,
      executeRawQuery: async () => createResult(),
      buildSelectAllQuery: (schema, table) => `${schema}.${table}`,
      now: () => 123,
    });

    store.getState().initWorkspace("query-1", "select 1;");
    store.getState().initWorkspace("query-1", "select 2;");
    store.getState().seedFromTable("query-1", "public", "users");

    expect(store.getState().getWorkspaceState("query-1")).toMatchObject({
      queryText: "public.users",
      initialQueryText: "select 1;",
      result: null,
      error: null,
    });
  });

  test("reports a missing database connection", async () => {
    const store = createQueryStore({
      getActiveSql: () => null,
      executeRawQuery: async () => createResult(),
      buildSelectAllQuery: () => "",
      now: () => 123,
    });

    store.getState().initWorkspace("query-1", "select 1;");
    const success = await store.getState().executeQuery("query-1");

    expect(success).toBe(false);
    expect(store.getState().getWorkspaceState("query-1").error).toBe("No active database connection");
  });

  test("executes queries and records history", async () => {
    const executed: string[] = [];
    const store = createQueryStore({
      getActiveSql: () => ({}) as any,
      executeRawQuery: async (_sql, queryText) => {
        executed.push(queryText);
        return createResult({ duration: 44, rowCount: 2, rows: [{ id: 1 }, { id: 2 }] });
      },
      buildSelectAllQuery: () => "",
      now: () => 999,
    });

    store.getState().initWorkspace("query-1", " select * from users ");
    const success = await store.getState().executeQuery("query-1");

    const state = store.getState().getWorkspaceState("query-1");
    expect(success).toBe(true);
    expect(executed).toEqual(["select * from users"]);
    expect(state.result?.rowCount).toBe(2);
    expect(state.history).toEqual([
      {
        sql: "select * from users",
        timestamp: 999,
        duration: 44,
        rowCount: 2,
      },
    ]);
  });

  test("surfaces execution errors and clears the executing flag", async () => {
    const store = createQueryStore({
      getActiveSql: () => ({}) as any,
      executeRawQuery: async () => {
        throw new Error("syntax error at or near select");
      },
      buildSelectAllQuery: () => "",
      now: () => 0,
    });

    store.getState().initWorkspace("query-1", "select");
    const success = await store.getState().executeQuery("query-1");

    expect(success).toBe(false);
    expect(store.getState().getWorkspaceState("query-1")).toMatchObject({
      isExecuting: false,
      error: "syntax error at or near select",
    });
  });
});
