import { create } from "zustand";
import type {
  SchemaInfo,
  TableInfo,
  ColumnInfo,
  IndexInfo,
  ForeignKeyInfo,
  SchemaSearchItem,
  TreeNode,
} from "../db/types";
import { getActiveSql } from "../db/connection";
import * as introspect from "../db/introspect";
import { useWorkspaceStore } from "./workspaces";
import { useTableDataStore } from "./table-data";
import { useUIStore } from "./ui";

interface SchemaState {
  // Data
  schemas: SchemaInfo[];
  tables: Record<string, TableInfo[]>; // keyed by schema name
  columns: Record<string, ColumnInfo[]>; // keyed by "schema.table"
  indexes: Record<string, IndexInfo[]>; // keyed by "schema.table"
  foreignKeys: Record<string, ForeignKeyInfo[]>; // keyed by "schema.table"
  searchItems: SchemaSearchItem[];

  // Tree state
  treeNodes: TreeNode[];
  expandedNodes: Set<string>;
  selectedNodeId: string | null;

  // Loading
  isLoading: boolean;
  isSearchLoading: boolean;
  error: string | null;

  // Actions
  loadSchemas: () => Promise<void>;
  loadTables: (schema: string) => Promise<void>;
  loadColumns: (schema: string, table: string) => Promise<void>;
  loadSearchItems: () => Promise<void>;
  toggleNode: (nodeId: string) => void;
  selectNode: (nodeId: string) => void;
  jumpToNode: (nodeId: string) => void;
  jumpToTable: (schema: string, table: string) => Promise<void>;
  openItem: (item: SchemaSearchItem) => Promise<void>;
  buildTree: () => TreeNode[];
  reset: () => void;
}

export const useSchemaStore = create<SchemaState>((set, get) => ({
  schemas: [],
  tables: {},
  columns: {},
  indexes: {},
  foreignKeys: {},
  searchItems: [],
  treeNodes: [],
  expandedNodes: new Set<string>(),
  selectedNodeId: null,
  isLoading: false,
  isSearchLoading: false,
  error: null,

  loadSchemas: async () => {
    const sql = getActiveSql();
    if (!sql) return;

    set({ isLoading: true, error: null });
    try {
      const schemas = await introspect.getSchemas(sql);
      set({ schemas });

      // Auto-load tables for public schema
      const publicSchema = schemas.find((s) => s.name === "public");
      if (publicSchema) {
        const tables = await introspect.getTables(sql, "public");
        set((state) => ({
          tables: { ...state.tables, public: tables },
          expandedNodes: new Set([...state.expandedNodes, "schema:public"]),
        }));
      }

      // Build tree after loading
      const tree = get().buildTree();
      set({ treeNodes: tree, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message || String(err) });
    }
  },

  loadTables: async (schema) => {
    const sql = getActiveSql();
    if (!sql) return;

    try {
      const tables = await introspect.getTables(sql, schema);
      set((state) => ({
        tables: { ...state.tables, [schema]: tables },
      }));
      const tree = get().buildTree();
      set({ treeNodes: tree });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  loadColumns: async (schema, table) => {
    const sql = getActiveSql();
    if (!sql) return;

    const key = `${schema}.${table}`;
    try {
      const [columns, indexes, foreignKeys] = await Promise.all([
        introspect.getColumns(sql, schema, table),
        introspect.getIndexes(sql, schema, table),
        introspect.getForeignKeys(sql, schema, table),
      ]);
      set((state) => ({
        columns: { ...state.columns, [key]: columns },
        indexes: { ...state.indexes, [key]: indexes },
        foreignKeys: { ...state.foreignKeys, [key]: foreignKeys },
      }));
      const tree = get().buildTree();
      set({ treeNodes: tree });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  loadSearchItems: async () => {
    const sql = getActiveSql();
    if (!sql) return;
    if (get().isSearchLoading) return;
    if (get().searchItems.length > 0) return;

    set({ isSearchLoading: true, error: null });
    try {
      const searchItems = await introspect.getSearchItems(sql);
      set({ searchItems, isSearchLoading: false });
    } catch (err: any) {
      set({ isSearchLoading: false, error: err.message || String(err) });
    }
  },

  toggleNode: (nodeId) => {
    set((state) => {
      const expanded = new Set(state.expandedNodes);
      if (expanded.has(nodeId)) {
        expanded.delete(nodeId);
      } else {
        expanded.add(nodeId);
      }
      return { expandedNodes: expanded };
    });

    // Lazy-load data when expanding
    const parts = nodeId.split(":");
    const sql = getActiveSql();
    if (!sql) return;

    if (parts[0] === "schema") {
      const schema = parts[1];
      if (!get().tables[schema]) {
        get().loadTables(schema);
      }
    } else if (parts[0] === "table" || parts[0] === "view") {
      const [, schema, table] = parts;
      const key = `${schema}.${table}`;
      if (!get().columns[key]) {
        get().loadColumns(schema, table);
      }
    }

    const tree = get().buildTree();
    set({ treeNodes: tree });
  },

  selectNode: (nodeId) => {
    set({ selectedNodeId: nodeId });
  },

  jumpToNode: (nodeId) => {
    // Parse nodeId to determine ancestors that need expanding
    const parts = nodeId.split(":");
    const expanded = new Set(get().expandedNodes);

    if (parts[0] === "schema") {
      expanded.add(nodeId);
    } else if (parts[0] === "table" || parts[0] === "view") {
      const [type, schema] = parts;
      expanded.add(`schema:${schema}`);
      expanded.add(`${type === "table" ? "table-group" : "view-group"}:${schema}`);
    } else if (parts[0] === "column" || parts[0] === "index" || parts[0] === "fk") {
      const [nodeType, schema, table] = parts;
      const schemaTables = get().tables[schema] || [];
      const match = schemaTables.find((t) => t.name === table);
      const isView = match?.type === "view";

      expanded.add(`schema:${schema}`);
      expanded.add(`${isView ? "view-group" : "table-group"}:${schema}`);
      expanded.add(`${isView ? "view" : "table"}:${schema}:${table}`);

      if (nodeType === "index") {
        expanded.add(`index-group:${schema}:${table}`);
      } else if (nodeType === "fk") {
        expanded.add(`fk-group:${schema}:${table}`);
      }
    }

    set({ expandedNodes: expanded, selectedNodeId: nodeId });
    const tree = get().buildTree();
    set({ treeNodes: tree });
  },

  jumpToTable: async (schema, table) => {
    if (!get().tables[schema]) {
      await get().loadTables(schema);
    }

    const schemaTables = get().tables[schema] || [];
    const match = schemaTables.find((t) => t.name === table);
    const type = match?.type === "view" ? "view" : "table";
    const nodeId = `${type}:${schema}:${table}`;

    const key = `${schema}.${table}`;
    if (!get().columns[key]) {
      await get().loadColumns(schema, table);
    }

    get().jumpToNode(nodeId);
  },

  openItem: async (item) => {
    const ui = useUIStore.getState();
    const wsStore = useWorkspaceStore.getState();
    const tableStore = useTableDataStore.getState();

    if (item.type === "schema") {
      get().jumpToNode(item.nodeId);
      ui.setActivePanel("sidebar");
      return;
    }

    const schema = item.schema;
    const table = item.table || item.label;

    if (!get().tables[schema]) {
      await get().loadTables(schema);
    }

    const relation = (get().tables[schema] || []).find((entry) => entry.name === table);
    const relationType = item.type === "view" || relation?.type === "view" ? "view" : "table";

    const { id: workspaceId, created } = wsStore.openTableWorkspace(
      schema,
      table,
      relationType
    );
    const workspaceState = tableStore.getWorkspaceState(workspaceId);
    const needsHydration =
      created ||
      workspaceState.currentTable !== table ||
      workspaceState.currentSchema !== schema ||
      workspaceState.currentTableType !== relationType ||
      workspaceState.isInvalid ||
      (!workspaceState.result && !workspaceState.isLoading);

    ui.setActivePanel("grid");

    if (needsHydration) {
      tableStore.initWorkspace(workspaceId);
      await Promise.all([
        tableStore.loadTable(workspaceId, schema, table, relationType),
        get().jumpToTable(schema, table),
      ]);
    } else {
      await get().jumpToTable(schema, table);
    }

    if (item.type === "column" || item.type === "index" || item.type === "fk") {
      get().jumpToNode(item.nodeId);
    }
  },

  buildTree: () => {
    const state = get();
    const nodes: TreeNode[] = [];

    for (const schema of state.schemas) {
      if (schema.isSystem) continue;

      const schemaId = `schema:${schema.name}`;
      const isExpanded = state.expandedNodes.has(schemaId);
      const schemaTables = state.tables[schema.name] || [];

      const schemaChildren: TreeNode[] = [];

      if (isExpanded) {
        const tables = schemaTables.filter((t) => t.type === "table");
        const views = schemaTables.filter((t) => t.type === "view");

        if (tables.length > 0 || schemaTables.length === 0) {
          const tablesGroupId = `table-group:${schema.name}`;
          const tablesExpanded = state.expandedNodes.has(tablesGroupId);

          const tableChildren: TreeNode[] = [];
          if (tablesExpanded) {
            for (const table of tables) {
              const tableId = `table:${schema.name}:${table.name}`;
              const tableExpanded = state.expandedNodes.has(tableId);
              const key = `${schema.name}.${table.name}`;
              const cols = state.columns[key] || [];
              const tableIndexes = state.indexes[key] || [];
              const tableFKs = state.foreignKeys[key] || [];

              const tableAllChildren: TreeNode[] = [];

              if (tableExpanded) {
                if (tableIndexes.length > 0) {
                  const idxGroupId = `index-group:${schema.name}:${table.name}`;
                  const idxGroupExpanded = state.expandedNodes.has(idxGroupId);

                  const idxChildren: TreeNode[] = idxGroupExpanded
                    ? tableIndexes.map((idx) => {
                        const badges: string[] = [];
                        if (idx.isPrimary) badges.push("PK");
                        else if (idx.isUnique) badges.push("UNIQUE");
                        const badgeStr = badges.length > 0 ? ` ${badges.join(" ")}` : "";
                        return {
                          id: `index:${schema.name}:${table.name}:${idx.name}`,
                          label: `${idx.name} (${idx.columns.join(", ")})${badgeStr}`,
                          type: "index" as const,
                          depth: 4,
                          meta: { index: idx },
                        };
                      })
                    : [];

                  tableAllChildren.push({
                    id: idxGroupId,
                    label: `Indexes (${tableIndexes.length})`,
                    type: "index-group",
                    children: idxChildren,
                    expanded: idxGroupExpanded,
                    depth: 3,
                  });
                }

                if (tableFKs.length > 0) {
                  const fkGroupId = `fk-group:${schema.name}:${table.name}`;
                  const fkGroupExpanded = state.expandedNodes.has(fkGroupId);

                  const fkChildren: TreeNode[] = fkGroupExpanded
                    ? tableFKs.map((fk) => ({
                        id: `fk:${schema.name}:${table.name}:${fk.name}`,
                        label: `${fk.columns.join(", ")} → ${fk.referencedSchema !== schema.name ? fk.referencedSchema + "." : ""}${fk.referencedTable}.${fk.referencedColumns.join(", ")}`,
                        type: "fk" as const,
                        depth: 4,
                        meta: {
                          foreignKey: fk,
                          referencedSchema: fk.referencedSchema,
                          referencedTable: fk.referencedTable,
                        },
                      }))
                    : [];

                  tableAllChildren.push({
                    id: fkGroupId,
                    label: `Foreign Keys (${tableFKs.length})`,
                    type: "fk-group",
                    children: fkChildren,
                    expanded: fkGroupExpanded,
                    depth: 3,
                  });
                }

                for (const col of cols) {
                  tableAllChildren.push({
                    id: `column:${schema.name}:${table.name}:${col.name}`,
                    label: `${col.name} ${col.type}${col.isPrimaryKey ? " PK" : ""}${col.nullable ? "" : " NOT NULL"}`,
                    type: "column" as const,
                    depth: 3,
                    meta: { column: col },
                  });
                }
              }

              tableChildren.push({
                id: tableId,
                label: table.name,
                type: "table",
                children: tableAllChildren,
                expanded: tableExpanded,
                depth: 2,
                meta: {
                  schema: schema.name,
                  estimatedRows: table.estimatedRows,
                  comment: table.comment,
                },
              });
            }
          }

          schemaChildren.push({
            id: tablesGroupId,
            label: `Tables (${tables.length})`,
            type: "table-group",
            children: tableChildren,
            expanded: tablesExpanded,
            depth: 1,
          });
        }

        if (views.length > 0) {
          const viewsGroupId = `view-group:${schema.name}`;
          const viewsExpanded = state.expandedNodes.has(viewsGroupId);

          const viewChildren: TreeNode[] = viewsExpanded
            ? views.map((view) => {
                const viewId = `view:${schema.name}:${view.name}`;
                const viewExpanded = state.expandedNodes.has(viewId);
                const key = `${schema.name}.${view.name}`;
                const cols = state.columns[key] || [];

                const children: TreeNode[] = viewExpanded
                  ? cols.map((col) => ({
                      id: `column:${schema.name}:${view.name}:${col.name}`,
                      label: `${col.name} ${col.type}${col.nullable ? "" : " NOT NULL"}`,
                      type: "column" as const,
                      depth: 3,
                      meta: { column: col },
                    }))
                  : [];

                return {
                  id: viewId,
                  label: view.name,
                  type: "view" as const,
                  children,
                  expanded: viewExpanded,
                  depth: 2,
                  meta: { schema: schema.name, comment: view.comment },
                };
              })
            : [];

          schemaChildren.push({
            id: viewsGroupId,
            label: `Views (${views.length})`,
            type: "view-group",
            children: viewChildren,
            expanded: viewsExpanded,
            depth: 1,
          });
        }
      }

      nodes.push({
        id: schemaId,
        label: schema.name,
        type: "schema",
        children: schemaChildren,
        expanded: isExpanded,
        depth: 0,
      });
    }

    return nodes;
  },

  reset: () => {
    set({
      schemas: [],
      tables: {},
      columns: {},
      indexes: {},
      foreignKeys: {},
      searchItems: [],
      treeNodes: [],
      expandedNodes: new Set(),
      selectedNodeId: null,
      isLoading: false,
      isSearchLoading: false,
      error: null,
    });
  },
}));
