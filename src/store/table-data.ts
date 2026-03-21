import { create } from "zustand";
import type { QueryResult } from "../db/types";
import { getActiveSql } from "../db/connection";
import * as query from "../db/query";
import {
  cellValueToEditString,
  validateValueForType,
  buildUpdateQuery,
  formatDisplayValue,
} from "../utils/sql";
import { showToast } from "../components/ui/toast";

interface EditState {
  editMode: boolean;
  editValue: string;
  editOriginalValue: unknown;
  editIsNull: boolean;
}

interface TableDataState {
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

  // Grid navigation
  selectedRow: number;
  selectedCol: number;
  scrollOffsetX: number;

  // Loading
  isLoading: boolean;
  error: string | null;

  // Inline editing
  edit: EditState;

  // Actions
  loadTable: (schema: string, table: string, type?: "table" | "view") => Promise<void>;
  reloadCurrent: () => Promise<void>;
  setPage: (page: number) => Promise<void>;
  setPageSize: (size: number) => Promise<void>;
  setSort: (column: string) => Promise<void>;
  moveSelection: (rowDelta: number, colDelta: number) => void;
  setSelectedRow: (row: number) => void;
  setSelectedCol: (col: number) => void;
  setScrollOffsetX: (offset: number) => void;
  reset: () => void;

  // Edit actions
  startEdit: () => boolean;
  setEditValue: (value: string) => void;
  toggleEditNull: () => void;
  cancelEdit: () => void;
  /**
   * Validate the edit and return the confirmation data if valid.
   * Returns null if validation fails (shows toast).
   */
  prepareEditConfirm: () => {
    sql: string;
    column: string;
    columnType: string;
    oldValue: unknown;
    newValue: string;
    isNull: boolean;
    oldDisplay: string;
    newDisplay: string;
  } | null;
  /**
   * Apply a successful edit to the in-memory result without re-fetching.
   */
  applyEdit: (columnName: string, newValue: string, isNull: boolean) => void;
}

const defaultEditState: EditState = {
  editMode: false,
  editValue: "",
  editOriginalValue: undefined,
  editIsNull: false,
};

export const useTableDataStore = create<TableDataState>((set, get) => ({
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
  selectedRow: 0,
  selectedCol: 0,
  scrollOffsetX: 0,
  isLoading: false,
  error: null,
  edit: { ...defaultEditState },

  loadTable: async (schema, table, type = "table") => {
    const sql = getActiveSql();
    if (!sql) return;

    set({
      currentSchema: schema,
      currentTable: table,
      currentTableType: type,
      primaryKeyColumns: [],
      isLoading: true,
      error: null,
      page: 1,
      selectedRow: 0,
      selectedCol: 0,
      scrollOffsetX: 0,
      orderBy: null,
      orderDir: "ASC",
      edit: { ...defaultEditState },
    });

    try {
      const [result, totalRows, pkColumns] = await Promise.all([
        query.queryTable(sql, schema, table, {
          page: 1,
          pageSize: get().pageSize,
        }),
        query.getTableRowCount(sql, schema, table),
        type === "table"
          ? query.getPrimaryKeyColumns(sql, schema, table)
          : Promise.resolve([]),
      ]);
      set({ result, totalRows, primaryKeyColumns: pkColumns, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message || String(err) });
    }
  },

  reloadCurrent: async () => {
    const {
      currentSchema,
      currentTable,
      currentTableType,
      page,
      pageSize,
      orderBy,
      orderDir,
    } = get();
    const sql = getActiveSql();
    if (!sql || !currentSchema || !currentTable) return;

    set({
      isLoading: true,
      error: null,
      selectedRow: 0,
      selectedCol: 0,
      scrollOffsetX: 0,
      edit: { ...defaultEditState },
    });

    try {
      const [result, totalRows, pkColumns] = await Promise.all([
        query.queryTable(sql, currentSchema, currentTable, {
          page,
          pageSize,
          orderBy: orderBy || undefined,
          orderDir,
        }),
        query.getTableRowCount(sql, currentSchema, currentTable),
        currentTableType === "table"
          ? query.getPrimaryKeyColumns(sql, currentSchema, currentTable)
          : Promise.resolve([]),
      ]);

      set({
        result,
        totalRows,
        primaryKeyColumns: pkColumns,
        isLoading: false,
      });
    } catch (err: any) {
      set({ isLoading: false, error: err.message || String(err) });
    }
  },

  setPage: async (page) => {
    const { currentSchema, currentTable, pageSize, orderBy, orderDir } = get();
    const sql = getActiveSql();
    if (!sql || !currentSchema || !currentTable) return;

    set({ isLoading: true, page, selectedRow: 0, edit: { ...defaultEditState } });
    try {
      const result = await query.queryTable(sql, currentSchema, currentTable, {
        page,
        pageSize,
        orderBy: orderBy || undefined,
        orderDir,
      });
      set({ result, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
    }
  },

  setPageSize: async (size) => {
    set({ pageSize: size, page: 1 });
    const { currentSchema, currentTable, currentTableType } = get();
    if (currentSchema && currentTable) {
      await get().loadTable(currentSchema, currentTable, currentTableType || "table");
    }
  },

  setSort: async (column) => {
    const state = get();
    let orderDir: "ASC" | "DESC" = "ASC";
    if (state.orderBy === column) {
      orderDir = state.orderDir === "ASC" ? "DESC" : "ASC";
    }
    set({ orderBy: column, orderDir, edit: { ...defaultEditState } });

    const sql = getActiveSql();
    if (!sql || !state.currentSchema || !state.currentTable) return;

    set({ isLoading: true });
    try {
      const result = await query.queryTable(
        sql,
        state.currentSchema,
        state.currentTable,
        {
          page: state.page,
          pageSize: state.pageSize,
          orderBy: column,
          orderDir,
        }
      );
      set({ result, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
    }
  },

  moveSelection: (rowDelta, colDelta) => {
    const { result, selectedRow, selectedCol } = get();
    if (!result) return;

    const maxRow = result.rows.length - 1;
    const maxCol = result.columns.length - 1;

    const newRow = Math.max(0, Math.min(maxRow, selectedRow + rowDelta));
    const newCol = Math.max(0, Math.min(maxCol, selectedCol + colDelta));

    set({ selectedRow: newRow, selectedCol: newCol });
  },

  setSelectedRow: (row) => set({ selectedRow: row }),
  setSelectedCol: (col) => set({ selectedCol: col }),
  setScrollOffsetX: (offset) => set({ scrollOffsetX: offset }),

  reset: () => {
    set({
      currentSchema: null,
      currentTable: null,
      currentTableType: null,
      primaryKeyColumns: [],
      result: null,
      totalRows: 0,
      page: 1,
      selectedRow: 0,
      selectedCol: 0,
      scrollOffsetX: 0,
      orderBy: null,
      orderDir: "ASC",
      isLoading: false,
      error: null,
      edit: { ...defaultEditState },
    });
  },

  // ─── Edit Actions ──────────────────────────────────────────

  startEdit: () => {
    const { currentTableType, primaryKeyColumns, result, selectedRow, selectedCol } =
      get();

    if (currentTableType !== "table") {
      showToast("Cannot edit views", "warning");
      return false;
    }

    if (primaryKeyColumns.length === 0) {
      showToast("Cannot edit: table has no primary key", "warning");
      return false;
    }

    if (!result || result.rows.length === 0) return false;

    const row = result.rows[selectedRow];
    const col = result.columns[selectedCol];
    if (!row || !col) return false;

    const originalValue = row[col.name];
    const isNull = originalValue === null || originalValue === undefined;

    set({
      edit: {
        editMode: true,
        editValue: isNull ? "" : cellValueToEditString(originalValue),
        editOriginalValue: originalValue,
        editIsNull: isNull,
      },
    });
    return true;
  },

  setEditValue: (value) => {
    set((state) => ({
      edit: { ...state.edit, editValue: value, editIsNull: false },
    }));
  },

  toggleEditNull: () => {
    set((state) => ({
      edit: {
        ...state.edit,
        editIsNull: !state.edit.editIsNull,
        editValue: !state.edit.editIsNull ? "" : state.edit.editValue,
      },
    }));
  },

  cancelEdit: () => {
    set({ edit: { ...defaultEditState } });
  },

  prepareEditConfirm: () => {
    const {
      currentSchema,
      currentTable,
      primaryKeyColumns,
      result,
      selectedRow,
      selectedCol,
      edit,
    } = get();

    if (!currentSchema || !currentTable || !result) return null;

    const row = result.rows[selectedRow];
    const col = result.columns[selectedCol];
    if (!row || !col) return null;

    // Check that all primary key columns have non-null values for this row
    const nullPk = primaryKeyColumns.find(
      (pkCol) => row[pkCol] === null || row[pkCol] === undefined
    );
    if (nullPk) {
      showToast(`Cannot edit: primary key column "${nullPk}" is NULL`, "error");
      return null;
    }

    // Validate the value
    const validationError = validateValueForType(
      edit.editValue,
      col.type,
      edit.editIsNull
    );
    if (validationError) {
      showToast(validationError, "error");
      return null;
    }

    // Check if value actually changed
    const oldValue = edit.editOriginalValue;
    const oldIsNull = oldValue === null || oldValue === undefined;
    if (edit.editIsNull && oldIsNull) {
      showToast("No change — value is still NULL", "info");
      set({ edit: { ...defaultEditState } });
      return null;
    }
    if (
      !edit.editIsNull &&
      !oldIsNull &&
      edit.editValue === cellValueToEditString(oldValue)
    ) {
      showToast("No change", "info");
      set({ edit: { ...defaultEditState } });
      return null;
    }

    const sqlQuery = buildUpdateQuery(
      currentSchema,
      currentTable,
      col.name,
      col.type,
      edit.editValue,
      edit.editIsNull,
      primaryKeyColumns,
      row
    );

    return {
      sql: sqlQuery,
      column: col.name,
      columnType: col.type,
      oldValue,
      newValue: edit.editValue,
      isNull: edit.editIsNull,
      oldDisplay: formatDisplayValue(oldValue),
      newDisplay: edit.editIsNull ? "NULL" : formatDisplayValue(edit.editValue),
    };
  },

  applyEdit: (columnName, newValue, isNull) => {
    const { result, selectedRow } = get();
    if (!result) return;

    const updatedRows = [...result.rows];
    const updatedRow = { ...updatedRows[selectedRow] };

    if (isNull) {
      updatedRow[columnName] = null;
    } else {
      // Try to preserve the original type
      const col = result.columns.find((c) => c.name === columnName);
      const t = col?.type.toLowerCase() || "";

      if (
        t.includes("int") ||
        t === "serial" ||
        t === "bigserial"
      ) {
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

    updatedRows[selectedRow] = updatedRow;
    set({
      result: { ...result, rows: updatedRows },
      edit: { ...defaultEditState },
    });
  },
}));
