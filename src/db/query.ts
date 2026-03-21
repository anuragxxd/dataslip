import type { Sql } from "postgres";
import type { QueryResult } from "./types";

export async function queryTable(
  sql: Sql,
  schema: string,
  table: string,
  options: {
    page?: number;
    pageSize?: number;
    orderBy?: string;
    orderDir?: "ASC" | "DESC";
  } = {}
): Promise<QueryResult> {
  const { page = 1, pageSize = 50, orderBy, orderDir = "ASC" } = options;
  const offset = (page - 1) * pageSize;

  const start = Date.now();

  // Get column info for type mapping
  const colInfo = await sql`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = ${schema} AND table_name = ${table}
    ORDER BY ordinal_position
  `;

  const columns = colInfo.map((c) => ({
    name: c.column_name as string,
    type: (c.udt_name as string) || (c.data_type as string),
  }));

  // Build and execute query
  const schemaIdent = sql(schema);
  const tableIdent = sql(table);

  let rows: Record<string, unknown>[];
  if (orderBy) {
    const orderIdent = sql(orderBy);
    if (orderDir === "DESC") {
      rows = await sql`
        SELECT * FROM ${schemaIdent}.${tableIdent}
        ORDER BY ${orderIdent} DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `;
    } else {
      rows = await sql`
        SELECT * FROM ${schemaIdent}.${tableIdent}
        ORDER BY ${orderIdent} ASC
        LIMIT ${pageSize} OFFSET ${offset}
      `;
    }
  } else {
    rows = await sql`
      SELECT * FROM ${schemaIdent}.${tableIdent}
      LIMIT ${pageSize} OFFSET ${offset}
    `;
  }

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
  exact: boolean = false
): Promise<number> {
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
