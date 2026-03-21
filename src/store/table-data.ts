import { create } from "zustand";
import type { QueryResult, TableFilterClause, TableFilterOperator } from "../db/types";
import { getActiveSql } from "../db/connection";
import * as query from "../db/query";
import {
  cellValueToEditString,
  validateValueForType,
  buildUpdateQuery,
  formatDisplayValue,
} from "../utils/sql";
import { generateId } from "../utils/format";
import { showToast } from "../components/ui/toast";

// ─── Edit state (per-workspace) ───────────────────────────────

interface EditState {
  editMode: boolean;
  editValue: string;
  editOriginalValue: unknown;
  editIsNull: boolean;
}

const defaultEditState: EditState = {
  editMode: false,
  editValue: "",
  editOriginalValue: undefined,
  editIsNull: false,
};

// ─── Per-workspace table state ────────────────────────────────

export interface TableWorkspaceState {
  // Current table
  currentSchema: string | null;
  currentTable: string | null;
  currentTableType: "table" | "view" | null;

  // Primary key
  primaryKeyColumns: string[];

  // Data
  result: QueryResult | null;
  totalRows: number;

  // Pagination
  page: number;
  pageSize: number;

  // Sorting
  orderBy: string | null;
  orderDir: "ASC" | "DESC";

  // Search / filters
  quickSearch: string;
  filters: TableFilterClause[];

  // Grid navigation
  selectedRow: number;
  selectedCol: number;
  scrollOffsetX: number;

  // Loading
  isLoading: boolean;
  error: string | null;

  // Invalid (table no longer exists after restore)
  isInvalid: boolean;

  // Inline editing
  edit: EditState;
}

function createDefaultTableState(): TableWorkspaceState {
  return {
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
    edit: { ...defaultEditState },
  };
}

function getQueryOptions(ws: TableWorkspaceState) {
  return {
    page: ws.page,
    pageSize: ws.pageSize,
    orderBy: ws.orderBy || undefined,
    orderDir: ws.orderDir,
    quickSearch: ws.quickSearch,
    filters: ws.filters,
  };
}

async function fetchWorkspaceRows(ws: TableWorkspaceState) {
  const sql = getActiveSql();
  if (!sql || !ws.currentSchema || !ws.currentTable) {
    return null;
  }

  const [result, totalRows] = await Promise.all([
    query.queryTable(sql, ws.currentSchema, ws.currentTable, getQueryOptions(ws)),
    query.getTableRowCount(sql, ws.currentSchema, ws.currentTable, {
      quickSearch: ws.quickSearch,
      filters: ws.filters,
    }),
  ]);

  return { result, totalRows };
}

// ─── Store ────────────────────────────────────────────────────

interface TableDataStoreState {
  byWorkspaceId: Record<string, TableWorkspaceState>;

  // Actions — all take workspaceId
  initWorkspace: (workspaceId: string) => void;
  removeWorkspace: (workspaceId: string) => void;
  getWorkspaceState: (workspaceId: string) => TableWorkspaceState;

  loadTable: (
    workspaceId: string,
    schema: string,
    table: string,
    type?: "table" | "view"
  ) => Promise<void>;
  applyViewConstraints: (
    workspaceId: string,
    payload: { quickSearch: string; filters: TableFilterClause[] }
  ) => Promise<void>;
  applyQuickSearch: (workspaceId: string, search: string) => Promise<void>;
  applyFilters: (workspaceId: string, filters: TableFilterClause[]) => Promise<void>;
  clearSearchAndFilters: (workspaceId: string) => Promise<void>;
  addFilterFromSelectedCell: (
    workspaceId: string,
    operator?: Extract<TableFilterOperator, "=" | "!=" >
  ) => Promise<void>;
  setPage: (workspaceId: string, page: number) => Promise<void>;
  setPageSize: (workspaceId: string, size: number) => Promise<void>;
  setSort: (workspaceId: string, column: string) => Promise<void>;
  reloadCurrent: (workspaceId: string) => Promise<void>;
  moveSelection: (workspaceId: string, rowDelta: number, colDelta: number) => void;
  setSelectedRow: (workspaceId: string, row: number) => void;
  setSelectedCol: (workspaceId: string, col: number) => void;
  setScrollOffsetX: (workspaceId: string, offset: number) => void;

  // Edit actions
  startEdit: (workspaceId: string) => boolean;
  setEditValue: (workspaceId: string, value: string) => void;
  toggleEditNull: (workspaceId: string) => void;
  cancelEdit: (workspaceId: string) => void;
  prepareEditConfirm: (workspaceId: string) => {
    sql: string;
    column: string;
    columnType: string;
    oldValue: unknown;
    newValue: string;
    isNull: boolean;
    oldDisplay: string;
    newDisplay: string;
  } | null;
  applyEdit: (workspaceId: string, columnName: string, newValue: string, isNull: boolean) => void;

  reset: () => void;
}

// Helper to update a workspace's state immutably
function updateWs(
  state: TableDataStoreState,
  workspaceId: string,
  patch: Partial<TableWorkspaceState>
): Partial<TableDataStoreState> {
  const ws = state.byWorkspaceId[workspaceId] || createDefaultTableState();
  return {
    byWorkspaceId: {
      ...state.byWorkspaceId,
      [workspaceId]: { ...ws, ...patch },
    },
  };
}

export const useTableDataStore = create<TableDataStoreState>((set, get) => ({
  byWorkspaceId: {},

  initWorkspace: (workspaceId) => {
    if (get().byWorkspaceId[workspaceId]) return;
    set((state) => ({
      byWorkspaceId: {
        ...state.byWorkspaceId,
        [workspaceId]: createDefaultTableState(),
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
    return get().byWorkspaceId[workspaceId] || createDefaultTableState();
  },

  loadTable: async (workspaceId, schema, table, type = "table") => {
    const sql = getActiveSql();
    if (!sql) return;

    set((state) => updateWs(state, workspaceId, {
      currentSchema: schema,
      currentTable: table,
      currentTableType: type,
      primaryKeyColumns: [],
      isLoading: true,
      error: null,
      isInvalid: false,
      page: 1,
      quickSearch: "",
      filters: [],
      selectedRow: 0,
      selectedCol: 0,
      scrollOffsetX: 0,
      orderBy: null,
      orderDir: "ASC",
      edit: { ...defaultEditState },
    }));

    try {
      const ws = get().byWorkspaceId[workspaceId]!;
      const [result, totalRows, pkColumns] = await Promise.all([
        query.queryTable(sql, schema, table, getQueryOptions(ws)),
        query.getTableRowCount(sql, schema, table, {
          quickSearch: ws.quickSearch,
          filters: ws.filters,
        }),
        type === "table"
          ? query.getPrimaryKeyColumns(sql, schema, table)
          : Promise.resolve([]),
      ]);
      set((state) => updateWs(state, workspaceId, {
        result,
        totalRows,
        primaryKeyColumns: pkColumns,
        isLoading: false,
      }));
    } catch (err: any) {
      set((state) => updateWs(state, workspaceId, {
        isLoading: false,
        error: err.message || String(err),
        isInvalid: true,
      }));
    }
  },

  applyViewConstraints: async (workspaceId, payload) => {
    const ws = get().byWorkspaceId[workspaceId];
    if (!ws?.currentSchema || !ws.currentTable) return;

    set((state) => updateWs(state, workspaceId, {
      quickSearch: payload.quickSearch.trim(),
      filters: payload.filters,
      page: 1,
      selectedRow: 0,
      selectedCol: 0,
      scrollOffsetX: 0,
      isLoading: true,
      error: null,
      edit: { ...defaultEditState },
    }));

    try {
      const next = get().byWorkspaceId[workspaceId]!;
      const loaded = await fetchWorkspaceRows(next);
      if (!loaded) return;
      set((state) => updateWs(state, workspaceId, {
        result: loaded.result,
        totalRows: loaded.totalRows,
        isLoading: false,
        isInvalid: false,
      }));
    } catch (err: any) {
      set((state) => updateWs(state, workspaceId, {
        isLoading: false,
        error: err.message || String(err),
      }));
    }
  },

  applyQuickSearch: async (workspaceId, search) => {
    const ws = get().byWorkspaceId[workspaceId];
    if (!ws) return;
    await get().applyViewConstraints(workspaceId, {
      quickSearch: search,
      filters: ws.filters,
    });
  },

  applyFilters: async (workspaceId, filters) => {
    const ws = get().byWorkspaceId[workspaceId];
    if (!ws) return;
    await get().applyViewConstraints(workspaceId, {
      quickSearch: ws.quickSearch,
      filters,
    });
  },

  clearSearchAndFilters: async (workspaceId) => {
    const ws = get().byWorkspaceId[workspaceId];
    if (!ws?.currentSchema || !ws.currentTable) return;

    set((state) => updateWs(state, workspaceId, {
      quickSearch: "",
      filters: [],
      page: 1,
      selectedRow: 0,
      selectedCol: 0,
      scrollOffsetX: 0,
      isLoading: true,
      error: null,
      edit: { ...defaultEditState },
    }));

    try {
      const next = get().byWorkspaceId[workspaceId]!;
      const loaded = await fetchWorkspaceRows(next);
      if (!loaded) return;
      set((state) => updateWs(state, workspaceId, {
        result: loaded.result,
        totalRows: loaded.totalRows,
        isLoading: false,
        isInvalid: false,
      }));
    } catch (err: any) {
      set((state) => updateWs(state, workspaceId, {
        isLoading: false,
        error: err.message || String(err),
      }));
    }
  },

  addFilterFromSelectedCell: async (workspaceId, operator = "=") => {
    const ws = get().byWorkspaceId[workspaceId];
    if (!ws?.result || !ws.currentSchema || !ws.currentTable) return;

    const row = ws.result.rows[ws.selectedRow];
    const column = ws.result.columns[ws.selectedCol];
    if (!row || !column) {
      showToast("No cell selected", "warning");
      return;
    }

    const cellValue = row[column.name];
    const nextFilter: TableFilterClause = {
      id: generateId(),
      column: column.name,
      columnType: column.type,
      operator:
        cellValue === null || cellValue === undefined
          ? operator === "!="
            ? "is_not_null"
            : "is_null"
          : operator,
      value:
        cellValue === null || cellValue === undefined ? undefined : cellValueToEditString(cellValue),
    };

    const filters = [...ws.filters, nextFilter];
    await get().applyFilters(workspaceId, filters);
    showToast(`Filtered by ${column.name}`, "info");
  },

  setPage: async (workspaceId, page) => {
    const ws = get().byWorkspaceId[workspaceId];
    if (!ws) return;
    const sql = getActiveSql();
    if (!sql || !ws.currentSchema || !ws.currentTable) return;

    set((state) => updateWs(state, workspaceId, {
      isLoading: true,
      error: null,
      page,
      selectedRow: 0,
      edit: { ...defaultEditState },
    }));

    try {
      const next = { ...ws, page };
      const loaded = await fetchWorkspaceRows(next);
      if (!loaded) return;
      set((state) => updateWs(state, workspaceId, {
        result: loaded.result,
        totalRows: loaded.totalRows,
        isLoading: false,
        isInvalid: false,
      }));
    } catch (err: any) {
      set((state) => updateWs(state, workspaceId, {
        isLoading: false,
        error: err.message,
      }));
    }
  },

  setPageSize: async (workspaceId, size) => {
    set((state) => updateWs(state, workspaceId, {
      pageSize: size,
      page: 1,
      selectedRow: 0,
      edit: { ...defaultEditState },
      isLoading: true,
      error: null,
    }));
    const ws = get().byWorkspaceId[workspaceId];
    if (ws?.currentSchema && ws?.currentTable) {
      try {
        const next = get().byWorkspaceId[workspaceId]!;
        const loaded = await fetchWorkspaceRows(next);
        if (!loaded) return;
        set((state) => updateWs(state, workspaceId, {
          result: loaded.result,
          totalRows: loaded.totalRows,
          isLoading: false,
        }));
      } catch (err: any) {
        set((state) => updateWs(state, workspaceId, {
          isLoading: false,
          error: err.message || String(err),
        }));
      }
    }
  },

  setSort: async (workspaceId, column) => {
    const ws = get().byWorkspaceId[workspaceId];
    if (!ws) return;

    let orderDir: "ASC" | "DESC" = "ASC";
    if (ws.orderBy === column) {
      orderDir = ws.orderDir === "ASC" ? "DESC" : "ASC";
    }
    set((state) => updateWs(state, workspaceId, {
      orderBy: column,
      orderDir,
      page: 1,
      edit: { ...defaultEditState },
    }));

    const sql = getActiveSql();
    if (!sql || !ws.currentSchema || !ws.currentTable) return;

    set((state) => updateWs(state, workspaceId, { isLoading: true, error: null }));
    try {
      const next = { ...ws, orderBy: column, orderDir, page: 1 };
      const loaded = await fetchWorkspaceRows(next);
      if (!loaded) return;
      set((state) => updateWs(state, workspaceId, {
        result: loaded.result,
        totalRows: loaded.totalRows,
        isLoading: false,
        isInvalid: false,
      }));
    } catch (err: any) {
      set((state) => updateWs(state, workspaceId, {
        isLoading: false,
        error: err.message,
      }));
    }
  },

  reloadCurrent: async (workspaceId) => {
    const ws = get().byWorkspaceId[workspaceId];
    if (!ws) return;
    const sql = getActiveSql();
    if (!sql || !ws.currentSchema || !ws.currentTable) return;

    set((state) => updateWs(state, workspaceId, {
      isLoading: true,
      error: null,
      selectedRow: 0,
      selectedCol: 0,
      scrollOffsetX: 0,
      edit: { ...defaultEditState },
    }));

    try {
      const [loaded, pkColumns] = await Promise.all([
        fetchWorkspaceRows(ws),
        ws.currentTableType === "table"
          ? query.getPrimaryKeyColumns(sql, ws.currentSchema, ws.currentTable)
          : Promise.resolve([]),
      ]);
      if (!loaded) return;
      set((state) => updateWs(state, workspaceId, {
        result: loaded.result,
        totalRows: loaded.totalRows,
        primaryKeyColumns: pkColumns,
        isLoading: false,
        isInvalid: false,
      }));
    } catch (err: any) {
      set((state) => updateWs(state, workspaceId, {
        isLoading: false,
        error: err.message || String(err),
      }));
    }
  },

  moveSelection: (workspaceId, rowDelta, colDelta) => {
    const ws = get().byWorkspaceId[workspaceId];
    if (!ws?.result) return;

    const maxRow = ws.result.rows.length - 1;
    const maxCol = ws.result.columns.length - 1;
    const newRow = Math.max(0, Math.min(maxRow, ws.selectedRow + rowDelta));
    const newCol = Math.max(0, Math.min(maxCol, ws.selectedCol + colDelta));

    set((state) => updateWs(state, workspaceId, {
      selectedRow: newRow,
      selectedCol: newCol,
    }));
  },

  setSelectedRow: (workspaceId, row) => {
    set((state) => updateWs(state, workspaceId, { selectedRow: row }));
  },

  setSelectedCol: (workspaceId, col) => {
    set((state) => updateWs(state, workspaceId, { selectedCol: col }));
  },

  setScrollOffsetX: (workspaceId, offset) => {
    set((state) => updateWs(state, workspaceId, { scrollOffsetX: offset }));
  },

  // ─── Edit Actions ──────────────────────────────────────────

  startEdit: (workspaceId) => {
    const ws = get().byWorkspaceId[workspaceId];
    if (!ws) return false;

    if (ws.currentTableType !== "table") {
      showToast("Cannot edit views", "warning");
      return false;
    }

    if (ws.primaryKeyColumns.length === 0) {
      showToast("Cannot edit: table has no primary key", "warning");
      return false;
    }

    if (!ws.result || ws.result.rows.length === 0) return false;

    const row = ws.result.rows[ws.selectedRow];
    const col = ws.result.columns[ws.selectedCol];
    if (!row || !col) return false;

    const originalValue = row[col.name];
    const isNull = originalValue === null || originalValue === undefined;

    set((state) => updateWs(state, workspaceId, {
      edit: {
        editMode: true,
        editValue: isNull ? "" : cellValueToEditString(originalValue),
        editOriginalValue: originalValue,
        editIsNull: isNull,
      },
    }));
    return true;
  },

  setEditValue: (workspaceId, value) => {
    const ws = get().byWorkspaceId[workspaceId];
    if (!ws) return;
    set((state) => updateWs(state, workspaceId, {
      edit: { ...ws.edit, editValue: value, editIsNull: false },
    }));
  },

  toggleEditNull: (workspaceId) => {
    const ws = get().byWorkspaceId[workspaceId];
    if (!ws) return;
    set((state) => updateWs(state, workspaceId, {
      edit: {
        ...ws.edit,
        editIsNull: !ws.edit.editIsNull,
        editValue: !ws.edit.editIsNull ? "" : ws.edit.editValue,
      },
    }));
  },

  cancelEdit: (workspaceId) => {
    set((state) => updateWs(state, workspaceId, {
      edit: { ...defaultEditState },
    }));
  },

  prepareEditConfirm: (workspaceId) => {
    const ws = get().byWorkspaceId[workspaceId];
    if (!ws || !ws.currentSchema || !ws.currentTable || !ws.result) return null;

    const row = ws.result.rows[ws.selectedRow];
    const col = ws.result.columns[ws.selectedCol];
    if (!row || !col) return null;

    // Check that all primary key columns have non-null values for this row
    const nullPk = ws.primaryKeyColumns.find(
      (pkCol) => row[pkCol] === null || row[pkCol] === undefined
    );
    if (nullPk) {
      showToast(`Cannot edit: primary key column "${nullPk}" is NULL`, "error");
      return null;
    }

    // Validate the value
    const validationError = validateValueForType(
      ws.edit.editValue,
      col.type,
      ws.edit.editIsNull
    );
    if (validationError) {
      showToast(validationError, "error");
      return null;
    }

    // Check if value actually changed
    const oldValue = ws.edit.editOriginalValue;
    const oldIsNull = oldValue === null || oldValue === undefined;
    if (ws.edit.editIsNull && oldIsNull) {
      showToast("No change — value is still NULL", "info");
      set((state) => updateWs(state, workspaceId, { edit: { ...defaultEditState } }));
      return null;
    }
    if (
      !ws.edit.editIsNull &&
      !oldIsNull &&
      ws.edit.editValue === cellValueToEditString(oldValue)
    ) {
      showToast("No change", "info");
      set((state) => updateWs(state, workspaceId, { edit: { ...defaultEditState } }));
      return null;
    }

    const sqlQuery = buildUpdateQuery(
      ws.currentSchema,
      ws.currentTable,
      col.name,
      col.type,
      ws.edit.editValue,
      ws.edit.editIsNull,
      ws.primaryKeyColumns,
      row
    );

    return {
      sql: sqlQuery,
      column: col.name,
      columnType: col.type,
      oldValue,
      newValue: ws.edit.editValue,
      isNull: ws.edit.editIsNull,
      oldDisplay: formatDisplayValue(oldValue),
      newDisplay: ws.edit.editIsNull ? "NULL" : formatDisplayValue(ws.edit.editValue),
    };
  },

  applyEdit: (workspaceId, columnName, newValue, isNull) => {
    const ws = get().byWorkspaceId[workspaceId];
    if (!ws?.result) return;

    const updatedRows = [...ws.result.rows];
    const updatedRow = { ...updatedRows[ws.selectedRow] };

    if (isNull) {
      updatedRow[columnName] = null;
    } else {
      const col = ws.result.columns.find((c) => c.name === columnName);
      const t = col?.type.toLowerCase() || "";

      if (t.includes("int") || t === "serial" || t === "bigserial") {
        updatedRow[columnName] = parseInt(newValue, 10);
      } else if (
        t.includes("float") ||
        t.includes("numeric") ||
        t.includes("decimal") ||
        t.includes("real") ||
        t.includes("double")
      ) {
        updatedRow[columnName] = parseFloat(newValue);
      } else if (t === "bool" || t === "boolean") {
        const lower = newValue.toLowerCase().trim();
        updatedRow[columnName] = ["true", "t", "yes", "1"].includes(lower);
      } else if (t === "json" || t === "jsonb") {
        try {
          updatedRow[columnName] = JSON.parse(newValue);
        } catch {
          updatedRow[columnName] = newValue;
        }
      } else {
        updatedRow[columnName] = newValue;
      }
    }

    updatedRows[ws.selectedRow] = updatedRow;
    set((state) => updateWs(state, workspaceId, {
      result: { ...ws.result!, rows: updatedRows },
      edit: { ...defaultEditState },
    }));
  },

  reset: () => set({ byWorkspaceId: {} }),
}));
