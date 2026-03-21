import type { Sql } from "postgres";
import type {
  SchemaInfo,
  TableInfo,
  ColumnInfo,
  IndexInfo,
  ForeignKeyInfo,
  SchemaSearchItem,
} from "./types";

const SYSTEM_SCHEMAS = [
  "pg_catalog",
  "information_schema",
  "pg_toast",
  "pg_temp_1",
  "pg_toast_temp_1",
];

export async function getSchemas(sql: Sql): Promise<SchemaInfo[]> {
  const rows = await sql`
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name NOT LIKE 'pg_temp%'
      AND schema_name NOT LIKE 'pg_toast%'
    ORDER BY 
      CASE WHEN schema_name = 'public' THEN 0 ELSE 1 END,
      schema_name
  `;
  return rows.map((r) => ({
    name: r.schema_name as string,
    isSystem: SYSTEM_SCHEMAS.includes(r.schema_name as string),
  }));
}

export async function getTables(
  sql: Sql,
  schema: string
): Promise<TableInfo[]> {
  const rows = await sql`
    SELECT 
      t.table_schema,
      t.table_name,
      t.table_type,
      obj_description((quote_ident(t.table_schema) || '.' || quote_ident(t.table_name))::regclass, 'pg_class') as comment,
      COALESCE(c.reltuples, 0)::bigint as estimated_rows
    FROM information_schema.tables t
    LEFT JOIN pg_catalog.pg_class c 
      ON c.relname = t.table_name
    LEFT JOIN pg_catalog.pg_namespace n 
      ON n.oid = c.relnamespace 
      AND n.nspname = t.table_schema
    WHERE t.table_schema = ${schema}
      AND t.table_type IN ('BASE TABLE', 'VIEW')
    ORDER BY t.table_type, t.table_name
  `;
  return rows.map((r) => ({
    schema: r.table_schema as string,
    name: r.table_name as string,
    type: r.table_type === "VIEW" ? "view" : "table",
    comment: r.comment as string | null,
    estimatedRows: Math.max(0, Number(r.estimated_rows)),
  }));
}

export async function getColumns(
  sql: Sql,
  schema: string,
  table: string
): Promise<ColumnInfo[]> {
  const rows = await sql`
    SELECT 
      c.column_name,
      c.data_type,
      c.udt_name,
      c.is_nullable,
      c.column_default,
      c.ordinal_position,
      col_description(
        (quote_ident(c.table_schema) || '.' || quote_ident(c.table_name))::regclass, 
        c.ordinal_position
      ) as comment,
      EXISTS (
        SELECT 1 
        FROM information_schema.key_column_usage kcu
        JOIN information_schema.table_constraints tc 
          ON tc.constraint_name = kcu.constraint_name 
          AND tc.table_schema = kcu.table_schema
        WHERE kcu.table_schema = c.table_schema 
          AND kcu.table_name = c.table_name 
          AND kcu.column_name = c.column_name
          AND tc.constraint_type = 'PRIMARY KEY'
      ) as is_primary_key
    FROM information_schema.columns c
    WHERE c.table_schema = ${schema}
      AND c.table_name = ${table}
    ORDER BY c.ordinal_position
  `;
  return rows.map((r) => ({
    name: r.column_name as string,
    type: formatType(r.data_type as string, r.udt_name as string),
    nullable: r.is_nullable === "YES",
    defaultValue: r.column_default as string | null,
    isPrimaryKey: r.is_primary_key as boolean,
    comment: r.comment as string | null,
    ordinalPosition: r.ordinal_position as number,
  }));
}

export async function getIndexes(
  sql: Sql,
  schema: string,
  table: string
): Promise<IndexInfo[]> {
  const rows = await sql`
    SELECT
      i.relname as index_name,
      ix.indisunique as is_unique,
      ix.indisprimary as is_primary,
      pg_get_indexdef(ix.indexrelid) as definition,
      array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns
    FROM pg_catalog.pg_index ix
    JOIN pg_catalog.pg_class i ON i.oid = ix.indexrelid
    JOIN pg_catalog.pg_class t ON t.oid = ix.indrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
    WHERE n.nspname = ${schema}
      AND t.relname = ${table}
    GROUP BY i.relname, ix.indisunique, ix.indisprimary, ix.indexrelid
    ORDER BY ix.indisprimary DESC, i.relname
  `;
  return rows.map((r) => ({
    name: r.index_name as string,
    columns: r.columns as string[],
    isUnique: r.is_unique as boolean,
    isPrimary: r.is_primary as boolean,
    definition: r.definition as string,
  }));
}

export async function getForeignKeys(
  sql: Sql,
  schema: string,
  table: string
): Promise<ForeignKeyInfo[]> {
  const rows = await sql`
    SELECT
      tc.constraint_name,
      array_agg(DISTINCT kcu.column_name) as columns,
      ccu.table_schema as referenced_schema,
      ccu.table_name as referenced_table,
      array_agg(DISTINCT ccu.column_name) as referenced_columns,
      rc.update_rule,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
      AND tc.table_schema = ccu.table_schema
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
      AND tc.table_schema = rc.constraint_schema
    WHERE tc.table_schema = ${schema}
      AND tc.table_name = ${table}
      AND tc.constraint_type = 'FOREIGN KEY'
    GROUP BY tc.constraint_name, ccu.table_schema, ccu.table_name, rc.update_rule, rc.delete_rule
    ORDER BY tc.constraint_name
  `;
  return rows.map((r) => ({
    name: r.constraint_name as string,
    columns: r.columns as string[],
    referencedSchema: r.referenced_schema as string,
    referencedTable: r.referenced_table as string,
    referencedColumns: r.referenced_columns as string[],
    updateRule: r.update_rule as string,
    deleteRule: r.delete_rule as string,
  }));
}

export async function getSearchItems(sql: Sql): Promise<SchemaSearchItem[]> {
  const [schemas, relations, columns, indexes, foreignKeys] = await Promise.all([
    getSchemas(sql),
    sql`
      SELECT
        t.table_schema,
        t.table_name,
        t.table_type
      FROM information_schema.tables t
      WHERE t.table_schema NOT IN ${sql(SYSTEM_SCHEMAS)}
        AND t.table_schema NOT LIKE 'pg_temp%'
        AND t.table_schema NOT LIKE 'pg_toast%'
        AND t.table_type IN ('BASE TABLE', 'VIEW')
      ORDER BY t.table_schema, t.table_type, t.table_name
    `,
    sql`
      SELECT
        c.table_schema,
        c.table_name,
        c.column_name,
        t.table_type
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema
       AND t.table_name = c.table_name
      WHERE c.table_schema NOT IN ${sql(SYSTEM_SCHEMAS)}
        AND c.table_schema NOT LIKE 'pg_temp%'
        AND c.table_schema NOT LIKE 'pg_toast%'
        AND t.table_type IN ('BASE TABLE', 'VIEW')
      ORDER BY c.table_schema, c.table_name, c.ordinal_position
    `,
    sql`
      SELECT
        n.nspname AS table_schema,
        t.relname AS table_name,
        CASE WHEN t.relkind = 'v' THEN 'VIEW' ELSE 'BASE TABLE' END AS table_type,
        i.relname AS index_name,
        ix.indisunique AS is_unique,
        ix.indisprimary AS is_primary,
        array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) AS columns
      FROM pg_catalog.pg_index ix
      JOIN pg_catalog.pg_class i ON i.oid = ix.indexrelid
      JOIN pg_catalog.pg_class t ON t.oid = ix.indrelid
      JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_catalog.pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE n.nspname NOT IN ${sql(SYSTEM_SCHEMAS)}
        AND n.nspname NOT LIKE 'pg_temp%'
        AND n.nspname NOT LIKE 'pg_toast%'
      GROUP BY n.nspname, t.relname, t.relkind, i.relname, ix.indisunique, ix.indisprimary
      ORDER BY n.nspname, t.relname, ix.indisprimary DESC, i.relname
    `,
    sql`
      SELECT
        tc.table_schema,
        tc.table_name,
        tc.constraint_name,
        array_agg(DISTINCT kcu.column_name) AS columns,
        ccu.table_schema AS referenced_schema,
        ccu.table_name AS referenced_table,
        array_agg(DISTINCT ccu.column_name) AS referenced_columns
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
       AND tc.table_schema = ccu.table_schema
      WHERE tc.table_schema NOT IN ${sql(SYSTEM_SCHEMAS)}
        AND tc.table_schema NOT LIKE 'pg_temp%'
        AND tc.table_schema NOT LIKE 'pg_toast%'
        AND tc.constraint_type = 'FOREIGN KEY'
      GROUP BY tc.table_schema, tc.table_name, tc.constraint_name, ccu.table_schema, ccu.table_name
      ORDER BY tc.table_schema, tc.table_name, tc.constraint_name
    `,
  ]);

  const items: SchemaSearchItem[] = [];

  for (const schema of schemas) {
    if (schema.isSystem) continue;
    items.push({
      nodeId: `schema:${schema.name}`,
      label: schema.name,
      type: "schema",
      schema: schema.name,
      searchText: `${schema.name} schema ${schema.name}`.toLowerCase(),
    });
  }

  for (const relation of relations) {
    const schema = relation.table_schema as string;
    const table = relation.table_name as string;
    const type = relation.table_type === "VIEW" ? "view" : "table";
    items.push({
      nodeId: `${type}:${schema}:${table}`,
      label: table,
      type,
      schema,
      table,
      searchText: `${schema} ${table} ${schema}.${table} ${type}`.toLowerCase(),
    });
  }

  for (const column of columns) {
    const schema = column.table_schema as string;
    const table = column.table_name as string;
    const columnName = column.column_name as string;
    const ownerType = column.table_type === "VIEW" ? "view" : "table";
    items.push({
      nodeId: `column:${schema}:${table}:${columnName}`,
      label: columnName,
      type: "column",
      schema,
      table,
      detail: `${ownerType} column`,
      searchText: `${schema} ${table} ${columnName} ${schema}.${table}.${columnName} ${ownerType} column`.toLowerCase(),
    });
  }

  for (const index of indexes) {
    const schema = index.table_schema as string;
    const table = index.table_name as string;
    const indexName = index.index_name as string;
    const columnsText = (index.columns as string[]).join(", ");
    const badges = [
      index.is_primary ? "PK" : null,
      index.is_unique && !index.is_primary ? "UNIQUE" : null,
    ].filter(Boolean);
    const detail = `${columnsText}${badges.length > 0 ? ` ${badges.join(" ")}` : ""}`;
    items.push({
      nodeId: `index:${schema}:${table}:${indexName}`,
      label: indexName,
      type: "index",
      schema,
      table,
      detail,
      searchText: `${schema} ${table} ${indexName} ${columnsText} ${schema}.${table} index ${detail}`.toLowerCase(),
    });
  }

  for (const foreignKey of foreignKeys) {
    const schema = foreignKey.table_schema as string;
    const table = foreignKey.table_name as string;
    const fkName = foreignKey.constraint_name as string;
    const columnsText = (foreignKey.columns as string[]).join(", ");
    const referencedSchema = foreignKey.referenced_schema as string;
    const referencedTable = foreignKey.referenced_table as string;
    const referencedColumns = foreignKey.referenced_columns as string[];
    const detail = `${columnsText} -> ${referencedSchema}.${referencedTable}.${referencedColumns.join(", ")}`;
    items.push({
      nodeId: `fk:${schema}:${table}:${fkName}`,
      label: fkName,
      type: "fk",
      schema,
      table,
      detail,
      referencedSchema,
      referencedTable,
      searchText: `${schema} ${table} ${fkName} ${columnsText} ${referencedSchema} ${referencedTable} ${referencedColumns.join(" ")} foreign key ${detail}`.toLowerCase(),
    });
  }

  return items;
}

// Format PG types into readable names
function formatType(dataType: string, udtName: string): string {
  const typeMap: Record<string, string> = {
    "character varying": "varchar",
    "character": "char",
    "timestamp without time zone": "timestamp",
    "timestamp with time zone": "timestamptz",
    "time without time zone": "time",
    "time with time zone": "timetz",
    "double precision": "float8",
    "boolean": "bool",
    "integer": "int4",
    "bigint": "int8",
    "smallint": "int2",
    "real": "float4",
    "ARRAY": udtName.replace(/^_/, "") + "[]",
    "USER-DEFINED": udtName,
  };
  return typeMap[dataType] || dataType;
}
