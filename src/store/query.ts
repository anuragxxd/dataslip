import { create } from "zustand";
import { getActiveSql } from "../db/connection";
import { executeRawQuery } from "../db/query";
import type { QueryResult } from "../db/types";
import type { Panel } from "./ui";
import { buildSelectAllQuery } from "../utils/sql";

type ReturnPanel = Exclude<Panel, "query" | "query-results">;

interface QueryHistoryEntry {
  sql: string;
  timestamp: number;
  duration: number;
  rowCount: number;
}

interface QueryState {
  isOpen: boolean;
  returnPanel: ReturnPanel;
  queryText: string;
  result: QueryResult | null;
  isExecuting: boolean;
  error: string | null;
  history: QueryHistoryEntry[];

  openQuery: (returnPanel: ReturnPanel, initialQuery?: string) => void;
  closeQuery: () => ReturnPanel;
  setQueryText: (queryText: string) => void;
  seedFromTable: (schema: string, table: string) => void;
  executeQuery: () => Promise<boolean>;
  clearResult: () => void;
  reset: () => void;
}

export const useQueryStore = create<QueryState>((set, get) => ({
  isOpen: false,
  returnPanel: "sidebar",
  queryText: "",
  result: null,
  isExecuting: false,
  error: null,
  history: [],

  openQuery: (returnPanel, initialQuery) => {
    const state = get();
    set({
      isOpen: true,
      returnPanel,
      queryText:
        state.queryText.trim().length > 0
          ? state.queryText
          : initialQuery || state.queryText,
      error: null,
    });
  },

  closeQuery: () => {
    const panel = get().returnPanel;
    set({ isOpen: false, error: null });
    return panel;
  },

  setQueryText: (queryText) => set({ queryText }),

  seedFromTable: (schema, table) => {
    set({
      queryText: buildSelectAllQuery(schema, table),
      result: null,
      error: null,
    });
  },

  executeQuery: async () => {
    const sql = getActiveSql();
    const queryText = get().queryText.trim();

    if (!sql) {
      set({ error: "No active database connection" });
      return false;
    }

    if (!queryText) {
      set({ error: "Enter a SQL query to run" });
      return false;
    }

    set({ isExecuting: true, error: null });

    try {
      const result = await executeRawQuery(sql, queryText);
      set((state) => ({
        result,
        isExecuting: false,
        error: null,
        history: [
          {
            sql: queryText,
            timestamp: Date.now(),
            duration: result.duration,
            rowCount: result.rowCount,
          },
          ...state.history,
        ].slice(0, 50),
      }));
      return true;
    } catch (err: any) {
      set({
        isExecuting: false,
        error: err?.message || String(err),
      });
      return false;
    }
  },

  clearResult: () => set({ result: null, error: null }),

  reset: () =>
    set({
      isOpen: false,
      returnPanel: "sidebar",
      queryText: "",
      result: null,
      isExecuting: false,
      error: null,
      history: [],
    }),
}));
