import { z } from "zod";

// ─── Connection ───────────────────────────────────────────────
export const ConnectionConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  host: z.string().default("localhost"),
  port: z.number().default(5432),
  database: z.string(),
  username: z.string(),
  password: z.string().default(""),
  ssl: z.enum(["disable", "require", "prefer"]).default("disable"),
  color: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type ConnectionConfig = z.infer<typeof ConnectionConfigSchema>;

// ─── Schema Introspection Types ───────────────────────────────
export interface SchemaInfo {
  name: string;
  isSystem: boolean;
}

export interface TableInfo {
  schema: string;
  name: string;
  type: "table" | "view";
  comment: string | null;
  estimatedRows: number;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
  comment: string | null;
  ordinalPosition: number;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
  definition: string;
}

export interface ForeignKeyInfo {
  name: string;
  columns: string[];
  referencedSchema: string;
  referencedTable: string;
  referencedColumns: string[];
  updateRule: string;
  deleteRule: string;
}

export interface ConstraintInfo {
  name: string;
  type: "PRIMARY KEY" | "FOREIGN KEY" | "UNIQUE" | "CHECK";
  columns: string[];
  definition: string | null;
}

export type SchemaSearchItemType =
  | "schema"
  | "table"
  | "view"
  | "column"
  | "index"
  | "fk";

export interface SchemaSearchItem {
  nodeId: string;
  label: string;
  type: SchemaSearchItemType;
  schema: string;
  table?: string;
  detail?: string;
  searchText: string;
  referencedSchema?: string;
  referencedTable?: string;
}

// ─── Query Results ────────────────────────────────────────────
export interface QueryResult {
  columns: { name: string; type: string }[];
  rows: Record<string, unknown>[];
  rowCount: number;
  duration: number; // ms
}

// ─── Tree Node (for schema browser) ──────────────────────────
export type TreeNodeType =
  | "schema"
  | "table-group"
  | "view-group"
  | "table"
  | "view"
  | "column"
  | "index-group"
  | "index"
  | "fk-group"
  | "fk";

export interface TreeNode {
  id: string;
  label: string;
  type: TreeNodeType;
  children?: TreeNode[];
  expanded?: boolean;
  depth: number;
  meta?: Record<string, unknown>;
}
