import type { Sql } from "postgres";
import type { QueryResult, TableFilterClause } from "./types";
import {
  escapeLikePattern,
  formatValueForSql,
  isTextLikeType,
  operatorNeedsValue,
  quoteIdentifier,
  quoteValue,
} from "../utils/sql";

interface ColumnMeta {
  name: string;
  dataType: string;
  udtName: string;
  type: string;
}

interface TableQueryOptions {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDir?: "ASC" | "DESC";
  quickSearch?: string;
  filters?: TableFilterClause[];
}

type QueryColumn = Pick<ColumnMeta, "name" | "type">;

async function getColumnMetadata(
  sql: Sql,
  schema: string,
  table: string
): Promise<ColumnMeta[]> {
  const colInfo = await sql`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = ${schema} AND table_name = ${table}
    ORDER BY ordinal_position
  `;

  return colInfo.map((c) => ({
    name: c.column_name as string,
    dataType: c.data_type as string,
    udtName: c.udt_name as string,
    type: (c.udt_name as string) || (c.data_type as string),
  }));
}

function buildFilterClause(filter: TableFilterClause): string | null {
  const column = quoteIdentifier(filter.column);

  if (filter.operator === "is_null") {
    return `${column} IS NULL`;
  }

  if (filter.operator === "is_not_null") {
    return `${column} IS NOT NULL`;
  }

  if (!operatorNeedsValue(filter.operator) || filter.value === undefined) {
    return null;
  }

  if (filter.operator === "contains") {
    return `${column} ILIKE ${quoteValue(`%${escapeLikePattern(filter.value)}%`)} ESCAPE '\\'`;
  }

  if (filter.operator === "starts_with") {
    return `${column} ILIKE ${quoteValue(`${escapeLikePattern(filter.value)}%`)} ESCAPE '\\'`;
  }

  const operator = filter.operator === "!=" ? "<>" : filter.operator;
  const value = formatValueForSql(filter.value, filter.columnType, false);
  return `${column} ${operator} ${value}`;
}

function buildWhereClause(
  columns: QueryColumn[],
  quickSearch?: string,
  filters: TableFilterClause[] = []
): string {
  const clauses: string[] = [];

  const search = quickSearch?.trim();
  if (search) {
    const searchableColumns = columns.filter((column) => isTextLikeType(column.type));
    if (searchableColumns.length > 0) {
      const pattern = quoteValue(`%${escapeLikePattern(search)}%`);
      clauses.push(
        `(${searchableColumns
          .map((column) => `${quoteIdentifier(column.name)} ILIKE ${pattern} ESCAPE '\\'`)
          .join(" OR ")})`
      );
    }
  }

  for (const filter of filters) {
    const clause = buildFilterClause(filter);
    if (clause) clauses.push(clause);
  }

  return clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "";
}

export function buildTableQuerySql(
  schema: string,
  table: string,
  columns: QueryColumn[],
  options: TableQueryOptions = {}
): string {
  const {
    page = 1,
    pageSize = 50,
    orderBy,
    orderDir = "ASC",
    quickSearch,
    filters = [],
  } = options;
  const offset = (page - 1) * pageSize;
  const whereClause = buildWhereClause(columns, quickSearch, filters);
  const orderClause = orderBy
    ? `ORDER BY ${quoteIdentifier(orderBy)} ${orderDir === "DESC" ? "DESC" : "ASC"}`
    : "";

  return [
    `SELECT *`,
    `FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)}`,
    whereClause ? whereClause.trim() : "",
    orderClause,
    `LIMIT ${pageSize} OFFSET ${offset}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function queryTable(
  sql: Sql,
  schema: string,
  table: string,
  options: TableQueryOptions = {}
): Promise<QueryResult> {
  const start = Date.now();

  const columnMeta = await getColumnMetadata(sql, schema, table);
  const columns = columnMeta.map((column) => ({ name: column.name, type: column.type }));
  const queryText = buildTableQuerySql(schema, table, columns, options);

  const rows = await sql.unsafe(queryText);

  const duration = Date.now() - start;

  return {
    columns,
    rows: rows as Record<string, unknown>[],
    rowCount: rows.length,
    duration,
  };
}

export async function getTableRowCount(
  sql: Sql,
  schema: string,
  table: string,
  options: {
    exact?: boolean;
    quickSearch?: string;
    filters?: TableFilterClause[];
  } = {}
): Promise<number> {
  const { exact = false, quickSearch, filters = [] } = options;
  const hasConstraints = Boolean(quickSearch?.trim()) || filters.length > 0;

  if (hasConstraints) {
    const columnMeta = await getColumnMetadata(sql, schema, table);
    const whereClause = buildWhereClause(columnMeta, quickSearch, filters);
    const result = await sql.unsafe(
      `SELECT count(*)::int as count FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)}${whereClause}`
    );
    return result[0].count as number;
  }

  if (exact) {
    const result = await sql`
      SELECT count(*)::int as count 
      FROM ${sql(schema)}.${sql(table)}
    `;
    return result[0].count as number;
  }

  // Estimated count (fast)
  const result = await sql`
    SELECT COALESCE(c.reltuples, 0)::bigint as count
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = ${schema} AND c.relname = ${table}
  `;
  const estimate = Number(result[0]?.count ?? 0);
  // If estimate is small or negative (never analyzed), get exact count
  if (estimate <= 0) {
    const exactResult = await sql`
      SELECT count(*)::int as count 
      FROM ${sql(schema)}.${sql(table)}
    `;
    return exactResult[0].count as number;
  }
  return estimate;
}

export async function getPrimaryKeyColumns(
  sql: Sql,
  schema: string,
  table: string
): Promise<string[]> {
  const rows = await sql`
    SELECT kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = ${schema}
      AND tc.table_name = ${table}
      AND tc.constraint_type = 'PRIMARY KEY'
    ORDER BY kcu.ordinal_position
  `;
  return rows.map((r) => r.column_name as string);
}

export async function executeUpdate(
  sql: Sql,
  query: string
): Promise<{ rowsAffected: number; duration: number }> {
  const start = Date.now();
  const result = await sql.unsafe(query);
  const duration = Date.now() - start;
  return {
    rowsAffected: result.count ?? 0,
    duration,
  };
}

export async function executeRawQuery(
  sql: Sql,
  query: string
): Promise<QueryResult> {
  const start = Date.now();
  const rows = await sql.unsafe(query);
  const duration = Date.now() - start;

  // Try to extract column info from result
  const columns =
    rows.length > 0
      ? Object.keys(rows[0]).map((name) => ({ name, type: "unknown" }))
      : [];

  return {
    columns,
    rows: rows as Record<string, unknown>[],
    rowCount: rows.length,
    duration,
  };
}
