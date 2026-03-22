import { describe, expect, test } from "bun:test";
import { createQueryStore } from "../../src/store/query";
import { createQueryResult } from "./helpers";

describe("query store", () => {
  test("initializes workspaces once, seeds from a table, and can create state via setQueryText", () => {
    const store = createQueryStore({
      getActiveSql: () => ({}) as any,
      executeRawQuery: async () => createQueryResult(),
      buildSelectAllQuery: (schema, table) => `${schema}.${table}`,
      now: () => 123,
    });

    store.getState().initWorkspace("query-1", "select 1;");
    store.getState().initWorkspace("query-1", "select 2;");
    store.getState().seedFromTable("query-1", "public", "users");
    store.getState().setQueryText("query-2", "select 42;");

    expect(store.getState().getWorkspaceState("query-1")).toMatchObject({
      queryText: "public.users",
      initialQueryText: "select 1;",
      result: null,
      error: null,
    });
    expect(store.getState().getWorkspaceState("query-2")).toMatchObject({
      queryText: "select 42;",
      initialQueryText: "",
    });
  });

  test("returns default state for unknown workspaces and removes initialized ones", () => {
    const store = createQueryStore({
      getActiveSql: () => ({}) as any,
      executeRawQuery: async () => createQueryResult(),
      buildSelectAllQuery: () => "",
      now: () => 123,
    });

    expect(store.getState().getWorkspaceState("missing")).toEqual({
      queryText: "",
      initialQueryText: "",
      result: null,
      isExecuting: false,
      error: null,
      history: [],
    });

    store.getState().initWorkspace("query-1", "select 1;");
    store.getState().removeWorkspace("query-1");

    expect(store.getState().byWorkspaceId).toEqual({});
  });

  test("reports missing connections and blank queries", async () => {
    const store = createQueryStore({
      getActiveSql: () => null,
      executeRawQuery: async () => createQueryResult(),
      buildSelectAllQuery: () => "",
      now: () => 123,
    });

    store.getState().initWorkspace("query-1", "select 1;");
    const noConnection = await store.getState().executeQuery("query-1");

    expect(noConnection).toBe(false);
    expect(store.getState().getWorkspaceState("query-1").error).toBe("No active database connection");

    const blankQueryStore = createQueryStore({
      getActiveSql: () => ({}) as any,
      executeRawQuery: async () => createQueryResult(),
      buildSelectAllQuery: () => "",
      now: () => 123,
    });

    blankQueryStore.getState().initWorkspace("query-1", "   ");
    const empty = await blankQueryStore.getState().executeQuery("query-1");

    expect(empty).toBe(false);
    expect(blankQueryStore.getState().getWorkspaceState("query-1").error).toBe("Enter a SQL query to run");
  });

  test("executes queries, trims SQL, clears stale errors, and records history", async () => {
    const executed: string[] = [];
    const store = createQueryStore({
      getActiveSql: () => ({}) as any,
      executeRawQuery: async (_sql, queryText) => {
        executed.push(queryText);
        return createQueryResult({ duration: 44, rowCount: 2, rows: [{ id: 1 }, { id: 2 }] });
      },
      buildSelectAllQuery: () => "",
      now: () => 999,
    });

    store.getState().initWorkspace("query-1", " select * from users ");
    store.setState({
      byWorkspaceId: {
        "query-1": {
          ...store.getState().getWorkspaceState("query-1"),
          error: "old error",
        },
      },
    });

    const success = await store.getState().executeQuery("query-1");
    const state = store.getState().getWorkspaceState("query-1");

    expect(success).toBe(true);
    expect(executed).toEqual(["select * from users"]);
    expect(state.result?.rowCount).toBe(2);
    expect(state.error).toBeNull();
    expect(state.history).toEqual([
      {
        sql: "select * from users",
        timestamp: 999,
        duration: 44,
        rowCount: 2,
      },
    ]);
  });

  test("caps history at 50 entries and keeps the newest first", async () => {
    let counter = 0;
    const store = createQueryStore({
      getActiveSql: () => ({}) as any,
      executeRawQuery: async () => createQueryResult({ duration: counter, rowCount: counter }),
      buildSelectAllQuery: () => "",
      now: () => ++counter,
    });

    store.getState().initWorkspace("query-1", "select 1");

    for (let index = 0; index < 55; index++) {
      store.getState().setQueryText("query-1", `select ${index}`);
      await store.getState().executeQuery("query-1");
    }

    const history = store.getState().getWorkspaceState("query-1").history;

    expect(history).toHaveLength(50);
    expect(history[0].sql).toBe("select 54");
    expect(history.at(-1)?.sql).toBe("select 5");
  });

  test("surfaces execution errors and keeps the store usable afterward", async () => {
    let fail = true;
    const store = createQueryStore({
      getActiveSql: () => ({}) as any,
      executeRawQuery: async () => {
        if (fail) {
          fail = false;
          throw new Error("syntax error at or near select");
        }
        return createQueryResult({ rowCount: 3, rows: [{ id: 1 }, { id: 2 }, { id: 3 }] });
      },
      buildSelectAllQuery: () => "",
      now: () => 456,
    });

    store.getState().initWorkspace("query-1", "select");
    const first = await store.getState().executeQuery("query-1");

    expect(first).toBe(false);
    expect(store.getState().getWorkspaceState("query-1")).toMatchObject({
      isExecuting: false,
      error: "syntax error at or near select",
    });

    store.getState().setQueryText("query-1", "select * from users");
    const second = await store.getState().executeQuery("query-1");

    expect(second).toBe(true);
    expect(store.getState().getWorkspaceState("query-1")).toMatchObject({
      isExecuting: false,
      error: null,
    });
  });

  test("clears results without disturbing query text and ignores unknown workspaces", () => {
    const store = createQueryStore({
      getActiveSql: () => ({}) as any,
      executeRawQuery: async () => createQueryResult(),
      buildSelectAllQuery: () => "",
      now: () => 123,
    });

    store.getState().initWorkspace("query-1", "select 1;");
    store.setState({
      byWorkspaceId: {
        "query-1": {
          ...store.getState().getWorkspaceState("query-1"),
          result: createQueryResult(),
          error: "boom",
        },
      },
    });

    store.getState().clearResult("query-1");
    store.getState().clearResult("missing");

    expect(store.getState().getWorkspaceState("query-1")).toMatchObject({
      queryText: "select 1;",
      result: null,
      error: null,
    });
  });

  test("resets all workspaces", () => {
    const store = createQueryStore({
      getActiveSql: () => ({}) as any,
      executeRawQuery: async () => createQueryResult(),
      buildSelectAllQuery: () => "",
      now: () => 123,
    });

    store.getState().initWorkspace("query-1", "select 1;");
    store.getState().initWorkspace("query-2", "select 2;");
    store.getState().reset();

    expect(store.getState().byWorkspaceId).toEqual({});
  });
});
