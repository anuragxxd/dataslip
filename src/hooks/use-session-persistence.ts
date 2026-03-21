/**
 * React hook that watches workspace/table/query stores and auto-persists
 * the session to SQLite via debounced writes.
 */

import { useEffect } from "react";
import { useWorkspaceStore } from "../store/workspaces";
import { useTableDataStore } from "../store/table-data";
import { useQueryStore } from "../store/query";
import { useSchemaStore } from "../store/schema";
import { useConnectionsStore } from "../store/connections";
import {
  debouncedSaveSession,
  flushPendingSave,
} from "../storage/session";
import type { PersistedSession, PersistedTableState, PersistedQueryState } from "../storage/session";

function buildSession(): PersistedSession | null {
  const wsState = useWorkspaceStore.getState();
  const tableState = useTableDataStore.getState();
  const queryState = useQueryStore.getState();
  const schemaState = useSchemaStore.getState();
  const connState = useConnectionsStore.getState();

  if (!connState.activeConnectionId) {
    return null;
  }

  const tableStateByWorkspaceId: Record<string, PersistedTableState> = {};
  const queryStateByWorkspaceId: Record<string, PersistedQueryState> = {};

  for (const ws of wsState.workspaces) {
    if (ws.kind === "table") {
      const ts = tableState.byWorkspaceId[ws.id];
      if (ts && ts.currentSchema && ts.currentTable) {
        tableStateByWorkspaceId[ws.id] = {
          schema: ts.currentSchema,
          table: ts.currentTable,
          relationType: ts.currentTableType || "table",
          page: ts.page,
          pageSize: ts.pageSize,
          orderBy: ts.orderBy,
          orderDir: ts.orderDir,
          selectedRow: ts.selectedRow,
          selectedCol: ts.selectedCol,
          scrollOffsetX: ts.scrollOffsetX,
        };
      }
    } else if (ws.kind === "query") {
      const qs = queryState.byWorkspaceId[ws.id];
      if (qs) {
        queryStateByWorkspaceId[ws.id] = {
          queryText: qs.queryText,
        };
      }
    }
  }

  return {
    version: 1,
    connectionId: connState.activeConnectionId,
    activeWorkspaceId: wsState.activeWorkspaceId,
    workspaces: wsState.workspaces.map((ws) => ({
      id: ws.id,
      kind: ws.kind,
      title: ws.title,
      subtitle: ws.subtitle,
      lastPanel: ws.lastPanel,
      source: ws.source,
      createdAt: ws.createdAt,
      lastActiveAt: ws.lastActiveAt,
    })),
    tableStateByWorkspaceId,
    queryStateByWorkspaceId,
    tree: {
      selectedNodeId: schemaState.selectedNodeId,
      expandedNodeIds: Array.from(schemaState.expandedNodes),
    },
  };
}

export function useSessionPersistence() {
  // Subscribe to changes in workspace, table, and query stores
  useEffect(() => {
    const handleProcessExit = () => {
      const session = buildSession();
      if (session) {
        flushPendingSave(session);
      } else {
        flushPendingSave();
      }
    };

    const persistSession = () => {
      const session = buildSession();
      if (session) {
        debouncedSaveSession(session);
      }
    };

    const unsubWorkspace = useWorkspaceStore.subscribe(() => {
      persistSession();
    });

    const unsubTable = useTableDataStore.subscribe(() => {
      persistSession();
    });

    const unsubQuery = useQueryStore.subscribe(() => {
      // Update dirty flags on query workspaces
      const wsState = useWorkspaceStore.getState();
      const qState = useQueryStore.getState();
      for (const ws of wsState.workspaces) {
        if (ws.kind === "query") {
          const qs = qState.byWorkspaceId[ws.id];
          if (qs) {
            const isDirty = qs.queryText !== qs.initialQueryText;
            if (ws.dirty !== isDirty) {
              useWorkspaceStore.getState().updateWorkspaceMeta(ws.id, { dirty: isDirty });
            }
          }
        }
      }
      persistSession();
    });

    process.on("exit", handleProcessExit);
    process.on("SIGINT", handleProcessExit);

    // Flush on unmount / exit
    return () => {
      unsubWorkspace();
      unsubTable();
      unsubQuery();
      process.off("exit", handleProcessExit);
      process.off("SIGINT", handleProcessExit);
      const session = buildSession();
      if (session) {
        flushPendingSave(session);
      } else {
        flushPendingSave();
      }
    };
  }, []);
}
