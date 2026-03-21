import { create } from "zustand";
import { getActiveSql } from "../db/connection";
import { executeRawQuery } from "../db/query";
import type { QueryResult } from "../db/types";
import { buildSelectAllQuery } from "../utils/sql";

// ─── Per-workspace query state ────────────────────────────────

interface QueryHistoryEntry {
  sql: string;
  timestamp: number;
  duration: number;
  rowCount: number;
}

export interface QueryWorkspaceState {
  queryText: string;
  initialQueryText: string;
  result: QueryResult | null;
  isExecuting: boolean;
  error: string | null;
  history: QueryHistoryEntry[];
}

function createDefaultQueryState(): QueryWorkspaceState {
  return {
    queryText: "",
    initialQueryText: "",
    result: null,
    isExecuting: false,
    error: null,
    history: [],
  };
}

// ─── Store ────────────────────────────────────────────────────

interface QueryStoreState {
  byWorkspaceId: Record<string, QueryWorkspaceState>;

  // Actions — all take workspaceId
  initWorkspace: (workspaceId: string, initialQuery?: string) => void;
  removeWorkspace: (workspaceId: string) => void;
  getWorkspaceState: (workspaceId: string) => QueryWorkspaceState;
  setQueryText: (workspaceId: string, queryText: string) => void;
  seedFromTable: (workspaceId: string, schema: string, table: string) => void;
  executeQuery: (workspaceId: string) => Promise<boolean>;
  clearResult: (workspaceId: string) => void;
  reset: () => void;
}

export const useQueryStore = create<QueryStoreState>((set, get) => ({
  byWorkspaceId: {},

  initWorkspace: (workspaceId, initialQuery) => {
    const existing = get().byWorkspaceId[workspaceId];
    if (existing) return; // Already initialized
    const text = initialQuery || "";
    set((state) => ({
      byWorkspaceId: {
        ...state.byWorkspaceId,
        [workspaceId]: {
          ...createDefaultQueryState(),
          queryText: text,
          initialQueryText: text,
        },
      },
    }));
  },

  removeWorkspace: (workspaceId) => {
    set((state) => {
      const { [workspaceId]: _, ...rest } = state.byWorkspaceId;
      return { byWorkspaceId: rest };
    });
  },

  getWorkspaceState: (workspaceId) => {
    return get().byWorkspaceId[workspaceId] || createDefaultQueryState();
  },

  setQueryText: (workspaceId, queryText) => {
    set((state) => {
      const ws = state.byWorkspaceId[workspaceId] || createDefaultQueryState();
      return {
        byWorkspaceId: {
          ...state.byWorkspaceId,
          [workspaceId]: { ...ws, queryText },
        },
      };
    });
  },

  seedFromTable: (workspaceId, schema, table) => {
    set((state) => {
      const ws = state.byWorkspaceId[workspaceId] || createDefaultQueryState();
      return {
        byWorkspaceId: {
          ...state.byWorkspaceId,
          [workspaceId]: {
            ...ws,
            queryText: buildSelectAllQuery(schema, table),
            result: null,
            error: null,
          },
        },
      };
    });
  },

  executeQuery: async (workspaceId) => {
    const sql = getActiveSql();
    const ws = get().byWorkspaceId[workspaceId];
    if (!ws) return false;

    const queryText = ws.queryText.trim();

    if (!sql) {
      set((state) => ({
        byWorkspaceId: {
          ...state.byWorkspaceId,
          [workspaceId]: { ...ws, error: "No active database connection" },
        },
      }));
      return false;
    }

    if (!queryText) {
      set((state) => ({
        byWorkspaceId: {
          ...state.byWorkspaceId,
          [workspaceId]: { ...ws, error: "Enter a SQL query to run" },
        },
      }));
      return false;
    }

    // Mark executing
    set((state) => ({
      byWorkspaceId: {
        ...state.byWorkspaceId,
        [workspaceId]: { ...state.byWorkspaceId[workspaceId]!, isExecuting: true, error: null },
      },
    }));

    try {
      const result = await executeRawQuery(sql, queryText);
      set((state) => {
        const current = state.byWorkspaceId[workspaceId]!;
        return {
          byWorkspaceId: {
            ...state.byWorkspaceId,
            [workspaceId]: {
              ...current,
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
                ...current.history,
              ].slice(0, 50),
            },
          },
        };
      });
      return true;
    } catch (err: any) {
      set((state) => ({
        byWorkspaceId: {
          ...state.byWorkspaceId,
          [workspaceId]: {
            ...state.byWorkspaceId[workspaceId]!,
            isExecuting: false,
            error: err?.message || String(err),
          },
        },
      }));
      return false;
    }
  },

  clearResult: (workspaceId) => {
    set((state) => {
      const ws = state.byWorkspaceId[workspaceId];
      if (!ws) return state;
      return {
        byWorkspaceId: {
          ...state.byWorkspaceId,
          [workspaceId]: { ...ws, result: null, error: null },
        },
      };
    });
  },

  reset: () => set({ byWorkspaceId: {} }),
}));
