import type { PersistedQueryState, PersistedSession, PersistedTableState } from "../storage/session";
import type { QueryWorkspaceState } from "../store/query";
import type { TableWorkspaceState } from "../store/table-data";
import type { WorkspaceMeta } from "../store/workspaces";

export interface BuildSessionInput {
  activeConnectionId: string | null;
  activeWorkspaceId: string | null;
  workspaces: WorkspaceMeta[];
  tableStateByWorkspaceId: Record<string, TableWorkspaceState>;
  queryStateByWorkspaceId: Record<string, QueryWorkspaceState>;
  tree: {
    selectedNodeId: string | null;
    expandedNodeIds: Iterable<string>;
  };
}

export function buildPersistedSession(input: BuildSessionInput): PersistedSession | null {
  if (!input.activeConnectionId) {
    return null;
  }

  const tableStateByWorkspaceId: Record<string, PersistedTableState> = {};
  const queryStateByWorkspaceId: Record<string, PersistedQueryState> = {};

  for (const workspace of input.workspaces) {
    if (workspace.kind === "table") {
      const tableState = input.tableStateByWorkspaceId[workspace.id];
      if (!tableState?.currentSchema || !tableState.currentTable) continue;

      tableStateByWorkspaceId[workspace.id] = {
        schema: tableState.currentSchema,
        table: tableState.currentTable,
        relationType: tableState.currentTableType || "table",
        page: tableState.page,
        pageSize: tableState.pageSize,
        orderBy: tableState.orderBy,
        orderDir: tableState.orderDir,
        selectedRow: tableState.selectedRow,
        selectedCol: tableState.selectedCol,
        scrollOffsetX: tableState.scrollOffsetX,
      };
      continue;
    }

    const queryState = input.queryStateByWorkspaceId[workspace.id];
    if (!queryState) continue;

    queryStateByWorkspaceId[workspace.id] = {
      queryText: queryState.queryText,
    };
  }

  return {
    version: 1,
    connectionId: input.activeConnectionId,
    activeWorkspaceId: input.activeWorkspaceId,
    workspaces: input.workspaces.map((workspace) => ({
      id: workspace.id,
      kind: workspace.kind,
      title: workspace.title,
      subtitle: workspace.subtitle,
      lastPanel: workspace.lastPanel,
      source: workspace.source,
      createdAt: workspace.createdAt,
      lastActiveAt: workspace.lastActiveAt,
    })),
    tableStateByWorkspaceId,
    queryStateByWorkspaceId,
    tree: {
      selectedNodeId: input.tree.selectedNodeId,
      expandedNodeIds: Array.from(input.tree.expandedNodeIds),
    },
  };
}
