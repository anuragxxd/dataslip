import type { TableFilterClause, TableFilterOperator } from "../db/types";

export function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

export function quoteValue(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

// ─── Type classification helpers ───────────────────────────

function isIntegerType(columnType: string): boolean {
  const t = columnType.toLowerCase();
  return (
    t.includes("int") ||
    t === "serial" ||
    t === "bigserial" ||
    t === "smallserial"
  );
}

function isFloatType(columnType: string): boolean {
  const t = columnType.toLowerCase();
  return (
    t.includes("float") ||
    t.includes("numeric") ||
    t.includes("decimal") ||
    t.includes("real") ||
    t.includes("double")
  );
}

export function isBooleanType(columnType: string): boolean {
  const t = columnType.toLowerCase();
  return t === "bool" || t === "boolean";
}

export function isNumericType(columnType: string): boolean {
  return isIntegerType(columnType) || isFloatType(columnType);
}

export function isDateLikeType(columnType: string): boolean {
  const t = columnType.toLowerCase();
  return (
    t.includes("timestamp") ||
    t.includes("date") ||
    t.includes("time") ||
    t.includes("interval")
  );
}

export function isTextLikeType(columnType: string): boolean {
  const t = columnType.toLowerCase();
  return (
    t.includes("char") ||
    t.includes("text") ||
    t === "varchar" ||
    t === "bpchar" ||
    t === "citext" ||
    t === "name" ||
    t === "uuid"
  );
}

export function operatorNeedsValue(operator: TableFilterOperator): boolean {
  return operator !== "is_null" && operator !== "is_not_null";
}

export function getFilterOperators(columnType: string): TableFilterOperator[] {
  if (isTextLikeType(columnType)) {
    return [
      "contains",
      "starts_with",
      "=",
      "!=",
      "is_null",
      "is_not_null",
    ];
  }

  if (isNumericType(columnType) || isDateLikeType(columnType)) {
    return ["=", "!=", ">", ">=", "<", "<=", "is_null", "is_not_null"];
  }

  if (isBooleanType(columnType)) {
    return ["=", "!=", "is_null", "is_not_null"];
  }

  return ["=", "!=", "contains", "starts_with", "is_null", "is_not_null"];
}

export function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function formatFilterClauseLabel(clause: TableFilterClause): string {
  if (clause.operator === "is_null") {
    return `${clause.column} is null`;
  }

  if (clause.operator === "is_not_null") {
    return `${clause.column} is not null`;
  }

  if (clause.operator === "starts_with") {
    return `${clause.column} starts with ${clause.value ?? ""}`;
  }

  return `${clause.column} ${clause.operator} ${clause.value ?? ""}`;
}

export function formatFiltersSummary(filters: TableFilterClause[]): string {
  if (filters.length === 0) return "";
  return filters.map((filter) => formatFilterClauseLabel(filter)).join(", ");
}

const INTEGER_RE = /^-?\d+$/;
const FLOAT_RE = /^-?\d*\.?\d+(e[+-]?\d+)?$/i;

/**
 * Format a value for use in a SQL statement based on the column type.
 * Returns the SQL literal string (e.g. 'hello', 42, TRUE, NULL).
 *
 * Numeric values are validated inline before being emitted unquoted
 * to prevent SQL injection even if called without prior validation.
 */
export function formatValueForSql(
  value: string,
  columnType: string,
  isNull: boolean
): string {
  if (isNull) return "NULL";

  const trimmed = value.trim();

  // Integer types — emit unquoted only if value is a valid integer literal
  if (isIntegerType(columnType)) {
    if (INTEGER_RE.test(trimmed)) return trimmed;
    // Fall through to quoting as a safe default; Postgres will cast or error
    return quoteValue(value);
  }

  // Float / decimal types — emit unquoted only if value is a valid numeric literal
  if (isFloatType(columnType)) {
    if (FLOAT_RE.test(trimmed)) return trimmed;
    return quoteValue(value);
  }

  // Boolean
  if (isBooleanType(columnType)) {
    const lower = trimmed.toLowerCase();
    if (["true", "t", "yes", "1"].includes(lower)) return "TRUE";
    if (["false", "f", "no", "0"].includes(lower)) return "FALSE";
    return quoteValue(value);
  }

  // Money — always quote (Postgres accepts '12.50'::money)
  // Everything else — quote as string (timestamps, text, json, uuid, arrays, etc.)
  return quoteValue(value);
}

/**
 * Validate that a value is appropriate for a given column type.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateValueForType(
  value: string,
  columnType: string,
  isNull: boolean
): string | null {
  if (isNull) return null;
  if (value === "") return null; // Empty string is valid for text types

  const trimmed = value.trim();

  // Integer validation
  if (isIntegerType(columnType)) {
    if (!INTEGER_RE.test(trimmed)) {
      return `Invalid integer value: "${value}"`;
    }
    return null;
  }

  // Float / decimal validation
  if (isFloatType(columnType)) {
    if (!FLOAT_RE.test(trimmed)) {
      return `Invalid numeric value: "${value}"`;
    }
    return null;
  }

  // Money validation — accept digits, optional decimal, optional leading minus/currency sign
  if (columnType.toLowerCase() === "money") {
    if (!/^-?\$?\d[\d,]*\.?\d*$/.test(trimmed) && !/^-?\d*\.?\d+$/.test(trimmed)) {
      return `Invalid money value: "${value}"`;
    }
    return null;
  }

  // Boolean validation
  if (isBooleanType(columnType)) {
    const lower = trimmed.toLowerCase();
    if (!["true", "false", "t", "f", "yes", "no", "1", "0"].includes(lower)) {
      return `Invalid boolean value: "${value}". Use true/false, t/f, yes/no, or 1/0`;
    }
    return null;
  }

  // JSON validation
  if (columnType.toLowerCase() === "json" || columnType.toLowerCase() === "jsonb") {
    try {
      JSON.parse(value);
    } catch {
      return `Invalid JSON: ${value.slice(0, 50)}`;
    }
    return null;
  }

  // UUID basic format check
  if (columnType.toLowerCase() === "uuid") {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)
    ) {
      return `Invalid UUID format: "${value}"`;
    }
    return null;
  }

  return null;
}

/**
 * Stringify a cell value for display in the edit input.
 */
export function cellValueToEditString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) {
    return value.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Format a cell value for display in the confirmation dialog (quoted for strings, etc.)
 */
export function formatDisplayValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) {
    return value.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Build an UPDATE SQL statement for a single cell edit.
 */
export function buildUpdateQuery(
  schema: string,
  table: string,
  column: string,
  columnType: string,
  newValue: string,
  isNull: boolean,
  primaryKeyColumns: string[],
  row: Record<string, unknown>
): string {
  const target = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
  const setClause = `${quoteIdentifier(column)} = ${formatValueForSql(newValue, columnType, isNull)}`;

  const whereParts = primaryKeyColumns.map((pkCol) => {
    const pkValue = row[pkCol];
    if (pkValue === null || pkValue === undefined) {
      return `${quoteIdentifier(pkCol)} IS NULL`;
    }
    if (typeof pkValue === "number") {
      return `${quoteIdentifier(pkCol)} = ${pkValue}`;
    }
    if (typeof pkValue === "boolean") {
      return `${quoteIdentifier(pkCol)} = ${pkValue ? "TRUE" : "FALSE"}`;
    }
    return `${quoteIdentifier(pkCol)} = ${quoteValue(String(pkValue))}`;
  });

  return `UPDATE ${target}\nSET ${setClause}\nWHERE ${whereParts.join(" AND ")};`;
}

export function buildSelectAllQuery(
  schema: string,
  table: string,
  limit: number = 50,
): string {
  return `SELECT *\nFROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)}\nLIMIT ${limit};`;
}
