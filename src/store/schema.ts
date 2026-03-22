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
import type { TableWorkspaceState } from "./table-data";
import { useTableDataStore } from "./table-data";
import type { Panel } from "./ui";
import { useUIStore } from "./ui";
import { useWorkspaceStore } from "./workspaces";

interface SchemaWorkspaceStoreDependencies {
  openTableWorkspace: (
    schema: string,
    table: string,
    relationType?: "table" | "view"
  ) => { id: string; created: boolean };
}

interface SchemaTableDataStoreDependencies {
  getWorkspaceState: (workspaceId: string) => TableWorkspaceState;
  initWorkspace: (workspaceId: string) => void;
  loadTable: (
    workspaceId: string,
    schema: string,
    table: string,
    type?: "table" | "view"
  ) => Promise<void>;
}

interface SchemaUIStoreDependencies {
  setActivePanel: (panel: Panel) => void;
}

export interface SchemaStoreDependencies {
  getActiveSql: typeof getActiveSql;
  introspectApi: Pick<
    typeof introspect,
    "getSchemas" | "getTables" | "getColumns" | "getIndexes" | "getForeignKeys" | "getSearchItems"
  >;
  getWorkspaceStore: () => SchemaWorkspaceStoreDependencies;
  getTableDataStore: () => SchemaTableDataStoreDependencies;
  getUIStore: () => SchemaUIStoreDependencies;
}

const defaultDependencies: SchemaStoreDependencies = {
  getActiveSql,
  introspectApi: introspect,
  getWorkspaceStore: () => useWorkspaceStore.getState(),
  getTableDataStore: () => useTableDataStore.getState(),
  getUIStore: () => useUIStore.getState(),
};

interface SchemaState {
  schemas: SchemaInfo[];
  tables: Record<string, TableInfo[]>;
  columns: Record<string, ColumnInfo[]>;
  indexes: Record<string, IndexInfo[]>;
  foreignKeys: Record<string, ForeignKeyInfo[]>;
  searchItems: SchemaSearchItem[];
  treeNodes: TreeNode[];
  expandedNodes: Set<string>;
  selectedNodeId: string | null;
  isLoading: boolean;
  isSearchLoading: boolean;
  error: string | null;
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

export function createSchemaStore(
  dependencies: SchemaStoreDependencies = defaultDependencies
) {
  return create<SchemaState>((set, get) => ({
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
      const sql = dependencies.getActiveSql();
      if (!sql) return;

      set({ isLoading: true, error: null });
      try {
        const schemas = await dependencies.introspectApi.getSchemas(sql);
        set({ schemas });

        const publicSchema = schemas.find((schema) => schema.name === "public");
        if (publicSchema) {
          const tables = await dependencies.introspectApi.getTables(sql, "public");
          set((state) => ({
            tables: { ...state.tables, public: tables },
            expandedNodes: new Set([...state.expandedNodes, "schema:public"]),
          }));
        }

        set({ treeNodes: get().buildTree(), isLoading: false });
      } catch (err: any) {
        set({ isLoading: false, error: err.message || String(err) });
      }
    },

    loadTables: async (schema) => {
      const sql = dependencies.getActiveSql();
      if (!sql) return;

      try {
        const tables = await dependencies.introspectApi.getTables(sql, schema);
        set((state) => ({
          tables: { ...state.tables, [schema]: tables },
        }));
        set({ treeNodes: get().buildTree() });
      } catch (err: any) {
        set({ error: err.message || String(err) });
      }
    },

    loadColumns: async (schema, table) => {
      const sql = dependencies.getActiveSql();
      if (!sql) return;

      const key = `${schema}.${table}`;
      try {
        const [columns, indexes, foreignKeys] = await Promise.all([
          dependencies.introspectApi.getColumns(sql, schema, table),
          dependencies.introspectApi.getIndexes(sql, schema, table),
          dependencies.introspectApi.getForeignKeys(sql, schema, table),
        ]);
        set((state) => ({
          columns: { ...state.columns, [key]: columns },
          indexes: { ...state.indexes, [key]: indexes },
          foreignKeys: { ...state.foreignKeys, [key]: foreignKeys },
        }));
        set({ treeNodes: get().buildTree() });
      } catch (err: any) {
        set({ error: err.message || String(err) });
      }
    },

    loadSearchItems: async () => {
      const sql = dependencies.getActiveSql();
      if (!sql) return;
      if (get().isSearchLoading || get().searchItems.length > 0) return;

      set({ isSearchLoading: true, error: null });
      try {
        const searchItems = await dependencies.introspectApi.getSearchItems(sql);
        set({ searchItems, isSearchLoading: false });
      } catch (err: any) {
        set({ isSearchLoading: false, error: err.message || String(err) });
      }
    },

    toggleNode: (nodeId) => {
      set((state) => {
        const expanded = new Set(state.expandedNodes);
        if (expanded.has(nodeId)) expanded.delete(nodeId);
        else expanded.add(nodeId);
        return { expandedNodes: expanded };
      });

      const parts = nodeId.split(":");
      const sql = dependencies.getActiveSql();
      if (!sql) return;

      if (parts[0] === "schema") {
        const schema = parts[1];
        if (!get().tables[schema]) {
          void get().loadTables(schema);
        }
      } else if (parts[0] === "table" || parts[0] === "view") {
        const [, schema, table] = parts;
        const key = `${schema}.${table}`;
        if (!get().columns[key]) {
          void get().loadColumns(schema, table);
        }
      }

      set({ treeNodes: get().buildTree() });
    },

    selectNode: (nodeId) => {
      set({ selectedNodeId: nodeId });
    },

    jumpToNode: (nodeId) => {
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
        const match = schemaTables.find((entry) => entry.name === table);
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

      set({
        expandedNodes: expanded,
        selectedNodeId: nodeId,
        treeNodes: get().buildTree(),
      });
    },

    jumpToTable: async (schema, table) => {
      if (!get().tables[schema]) {
        await get().loadTables(schema);
      }

      const schemaTables = get().tables[schema] || [];
      const match = schemaTables.find((entry) => entry.name === table);
      const type = match?.type === "view" ? "view" : "table";
      const nodeId = `${type}:${schema}:${table}`;

      const key = `${schema}.${table}`;
      if (!get().columns[key]) {
        await get().loadColumns(schema, table);
      }

      get().jumpToNode(nodeId);
    },

    openItem: async (item) => {
      const ui = dependencies.getUIStore();
      const workspaceStore = dependencies.getWorkspaceStore();
      const tableStore = dependencies.getTableDataStore();

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

      const { id: workspaceId, created } = workspaceStore.openTableWorkspace(
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
          const tables = schemaTables.filter((table) => table.type === "table");
          const views = schemaTables.filter((table) => table.type === "view");

          if (tables.length > 0 || schemaTables.length === 0) {
            const tablesGroupId = `table-group:${schema.name}`;
            const tablesExpanded = state.expandedNodes.has(tablesGroupId);
            const tableChildren: TreeNode[] = [];

            if (tablesExpanded) {
              for (const table of tables) {
                const tableId = `table:${schema.name}:${table.name}`;
                const tableExpanded = state.expandedNodes.has(tableId);
                const key = `${schema.name}.${table.name}`;
                const columns = state.columns[key] || [];
                const tableIndexes = state.indexes[key] || [];
                const tableForeignKeys = state.foreignKeys[key] || [];
                const tableAllChildren: TreeNode[] = [];

                if (tableExpanded) {
                  if (tableIndexes.length > 0) {
                    const indexGroupId = `index-group:${schema.name}:${table.name}`;
                    const indexGroupExpanded = state.expandedNodes.has(indexGroupId);
                    const indexChildren: TreeNode[] = indexGroupExpanded
                      ? tableIndexes.map((index) => {
                          const badges: string[] = [];
                          if (index.isPrimary) badges.push("PK");
                          else if (index.isUnique) badges.push("UNIQUE");
                          const badge = badges.length > 0 ? ` ${badges.join(" ")}` : "";
                          return {
                            id: `index:${schema.name}:${table.name}:${index.name}`,
                            label: `${index.name} (${index.columns.join(", ")})${badge}`,
                            type: "index",
                            depth: 4,
                            meta: { index },
                          };
                        })
                      : [];

                    tableAllChildren.push({
                      id: indexGroupId,
                      label: `Indexes (${tableIndexes.length})`,
                      type: "index-group",
                      children: indexChildren,
                      expanded: indexGroupExpanded,
                      depth: 3,
                    });
                  }

                  if (tableForeignKeys.length > 0) {
                    const foreignKeyGroupId = `fk-group:${schema.name}:${table.name}`;
                    const foreignKeyGroupExpanded = state.expandedNodes.has(foreignKeyGroupId);
                    const foreignKeyChildren: TreeNode[] = foreignKeyGroupExpanded
                      ? tableForeignKeys.map((foreignKey) => ({
                          id: `fk:${schema.name}:${table.name}:${foreignKey.name}`,
                          label: `${foreignKey.columns.join(", ")} -> ${foreignKey.referencedSchema !== schema.name ? `${foreignKey.referencedSchema}.` : ""}${foreignKey.referencedTable}.${foreignKey.referencedColumns.join(", ")}`,
                          type: "fk",
                          depth: 4,
                          meta: {
                            foreignKey,
                            referencedSchema: foreignKey.referencedSchema,
                            referencedTable: foreignKey.referencedTable,
                          },
                        }))
                      : [];

                    tableAllChildren.push({
                      id: foreignKeyGroupId,
                      label: `Foreign Keys (${tableForeignKeys.length})`,
                      type: "fk-group",
                      children: foreignKeyChildren,
                      expanded: foreignKeyGroupExpanded,
                      depth: 3,
                    });
                  }

                  for (const column of columns) {
                    tableAllChildren.push({
                      id: `column:${schema.name}:${table.name}:${column.name}`,
                      label: `${column.name} ${column.type}${column.isPrimaryKey ? " PK" : ""}${column.nullable ? "" : " NOT NULL"}`,
                      type: "column",
                      depth: 3,
                      meta: { column },
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
                  const columns = state.columns[key] || [];
                  const children: TreeNode[] = viewExpanded
                    ? columns.map((column) => ({
                        id: `column:${schema.name}:${view.name}:${column.name}`,
                        label: `${column.name} ${column.type}${column.nullable ? "" : " NOT NULL"}`,
                        type: "column",
                        depth: 3,
                        meta: { column },
                      }))
                    : [];

                  return {
                    id: viewId,
                    label: view.name,
                    type: "view",
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
        expandedNodes: new Set<string>(),
        selectedNodeId: null,
        isLoading: false,
        isSearchLoading: false,
        error: null,
      });
    },
  }));
}

export const useSchemaStore = createSchemaStore();
