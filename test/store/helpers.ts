import type { QueryResult } from "../../src/db/types";
import type { TableWorkspaceState } from "../../src/store/table-data";

export function createQueryResult(overrides: Partial<QueryResult> = {}): QueryResult {
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

export function createTableWorkspaceState(
  overrides: Partial<TableWorkspaceState> = {}
): TableWorkspaceState {
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
    edit: {
      editMode: false,
      editValue: "",
      editOriginalValue: undefined,
      editIsNull: false,
    },
    ...overrides,
  };
}
