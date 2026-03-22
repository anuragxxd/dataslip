import type { ConnectionConfig } from "../db/types";
import type { PersistedSession, PersistedTableState } from "../storage/session";
import { loadSession } from "../storage/session";
import { useConnectionsStore } from "../store/connections";
import { useQueryStore } from "../store/query";
import { useSchemaStore } from "../store/schema";
import type { Panel } from "../store/ui";
import { useUIStore } from "../store/ui";
import { useTableDataStore } from "../store/table-data";
import { useWorkspaceStore } from "../store/workspaces";
import { logInfo, logWarn } from "../utils/logger";

const DEFAULT_TABLE_PAGE = 1;
const DEFAULT_TABLE_PAGE_SIZE = 50;

export interface SessionRestoreResult {
  status: "restored" | "skipped";
  reason?: "no-session" | "missing-connection" | "connect-failed";
  backgroundHydration?: Promise<void>;
}

interface RestorableTableState {
  page: number;
  pageSize: number;
  orderBy: string | null;
  orderDir: "ASC" | "DESC";
  selectedRow: number;
  selectedCol: number;
  scrollOffsetX: number;
  isInvalid: boolean;
  error: string | null;
}

export interface SessionRestoreDependencies {
  loadSession: () => PersistedSession | null;
  loadConnections: () => void;
  listConnections: () => ConnectionConfig[];
  connectTo: (connectionId: string) => Promise<boolean>;
  setScreen: (screen: "main") => void;
  restoreWorkspaces: (session: PersistedSession) => void;
  initQueryWorkspace: (workspaceId: string, queryText: string) => void;
  initTableWorkspace: (workspaceId: string) => void;
  loadSchemas: () => Promise<void>;
  restoreTreeState: (tree: PersistedSession["tree"] | undefined) => void;
  loadTable: (workspaceId: string, state: PersistedTableState) => Promise<void>;
  patchTableState: (workspaceId: string, patch: Partial<RestorableTableState>) => void;
  reloadTable: (workspaceId: string) => Promise<void>;
  markInvalidTable: (workspaceId: string, message: string) => void;
  setActivePanel: (panel: Panel) => void;
  logInfo: (message: string, data?: Record<string, unknown>) => void;
  logWarn: (message: string, data?: Record<string, unknown>) => void;
}

function createDefaultDependencies(): SessionRestoreDependencies {
  return {
    loadSession,
    loadConnections: () => {
      useConnectionsStore.getState().loadConnections();
    },
    listConnections: () => useConnectionsStore.getState().connections,
    connectTo: (connectionId) => useConnectionsStore.getState().connectTo(connectionId),
    setScreen: (screen) => useUIStore.getState().setScreen(screen),
    restoreWorkspaces: (session) => useWorkspaceStore.getState().restoreFromSession(session),
    initQueryWorkspace: (workspaceId, queryText) => {
      useQueryStore.getState().initWorkspace(workspaceId, queryText);
    },
    initTableWorkspace: (workspaceId) => {
      useTableDataStore.getState().initWorkspace(workspaceId);
    },
    loadSchemas: () => useSchemaStore.getState().loadSchemas(),
    restoreTreeState: (tree) => {
      if (!tree) return;

      const expandedNodes = new Set(tree.expandedNodeIds);
      useSchemaStore.setState({
        expandedNodes,
        selectedNodeId: tree.selectedNodeId,
      });
      useSchemaStore.setState({
        treeNodes: useSchemaStore.getState().buildTree(),
      });
    },
    loadTable: (workspaceId, state) =>
      useTableDataStore.getState().loadTable(
        workspaceId,
        state.schema,
        state.table,
        state.relationType
      ),
    patchTableState: (workspaceId, patch) => {
      const store = useTableDataStore.getState();
      const current = store.byWorkspaceId[workspaceId];
      if (!current) return;

      useTableDataStore.setState({
        byWorkspaceId: {
          ...store.byWorkspaceId,
          [workspaceId]: { ...current, ...patch },
        },
      });
    },
    reloadTable: (workspaceId) => useTableDataStore.getState().reloadCurrent(workspaceId),
    markInvalidTable: (workspaceId, message) => {
      const store = useTableDataStore.getState();
      const current = store.byWorkspaceId[workspaceId];
      if (!current) return;

      useTableDataStore.setState({
        byWorkspaceId: {
          ...store.byWorkspaceId,
          [workspaceId]: {
            ...current,
            isInvalid: true,
            error: message,
          },
        },
      });
    },
    setActivePanel: (panel) => useUIStore.getState().setActivePanel(panel),
    logInfo,
    logWarn,
  };
}

function needsTableReload(state: PersistedTableState): boolean {
  return (
    state.page !== DEFAULT_TABLE_PAGE ||
    state.pageSize !== DEFAULT_TABLE_PAGE_SIZE ||
    state.orderBy !== null
  );
}

async function hydrateTableWorkspace(
  deps: SessionRestoreDependencies,
  workspaceId: string,
  state: PersistedTableState
): Promise<void> {
  await deps.loadTable(workspaceId, state);

  deps.patchTableState(workspaceId, {
    page: state.page,
    pageSize: state.pageSize,
    orderBy: state.orderBy,
    orderDir: state.orderDir,
  });

  if (needsTableReload(state)) {
    await deps.reloadTable(workspaceId);
  }

  deps.patchTableState(workspaceId, {
    selectedRow: state.selectedRow,
    selectedCol: state.selectedCol,
    scrollOffsetX: state.scrollOffsetX,
    isInvalid: false,
    error: null,
  });
}

function initializeWorkspaceState(
  deps: SessionRestoreDependencies,
  session: PersistedSession
): void {
  for (const workspace of session.workspaces) {
    if (workspace.kind === "query") {
      const queryState = session.queryStateByWorkspaceId[workspace.id];
      deps.initQueryWorkspace(workspace.id, queryState?.queryText || "");
      continue;
    }

    deps.initTableWorkspace(workspace.id);
  }
}

export async function restoreSession(
  deps: SessionRestoreDependencies = createDefaultDependencies()
): Promise<SessionRestoreResult> {
  const session = deps.loadSession();
  if (!session || !session.connectionId || session.workspaces.length === 0) {
    deps.logInfo("No session to restore");
    return { status: "skipped", reason: "no-session" };
  }

  deps.loadConnections();
  const savedConnection = deps.listConnections().find((connection) => connection.id === session.connectionId);

  if (!savedConnection) {
    deps.logWarn("Saved connection not found, skipping restore", {
      connectionId: session.connectionId,
    });
    return { status: "skipped", reason: "missing-connection" };
  }

  deps.logInfo("Auto-reconnecting to restore session", {
    name: savedConnection.name,
    host: savedConnection.host,
  });

  const connected = await deps.connectTo(savedConnection.id);
  if (!connected) {
    deps.logWarn("Auto-reconnect failed, showing connections screen");
    return { status: "skipped", reason: "connect-failed" };
  }

  deps.logInfo("Auto-reconnect succeeded, restoring workspaces");

  deps.setScreen("main");
  deps.restoreWorkspaces(session);
  initializeWorkspaceState(deps, session);

  await deps.loadSchemas();
  deps.restoreTreeState(session.tree);

  const activeWorkspace = session.workspaces.find(
    (workspace) => workspace.id === session.activeWorkspaceId
  );

  if (activeWorkspace?.kind === "table") {
    const activeTableState = session.tableStateByWorkspaceId[activeWorkspace.id];
    if (activeTableState) {
      await hydrateTableWorkspace(deps, activeWorkspace.id, activeTableState).catch(() => {
        deps.markInvalidTable(activeWorkspace.id, "Table may no longer exist");
      });
    }
  }

  if (activeWorkspace) {
    deps.setActivePanel(activeWorkspace.lastPanel);
  }

  const backgroundHydration = Promise.allSettled(
    session.workspaces
      .filter((workspace) => workspace.kind === "table" && workspace.id !== session.activeWorkspaceId)
      .map(async (workspace) => {
        const tableState = session.tableStateByWorkspaceId[workspace.id];
        if (!tableState) return;

        await hydrateTableWorkspace(deps, workspace.id, tableState).catch(() => {
          deps.markInvalidTable(workspace.id, "Table may no longer exist");
        });
      })
  ).then(() => undefined);

  deps.logInfo("Session restore complete", {
    workspaces: session.workspaces.length,
    activeTab: activeWorkspace?.title,
  });

  return {
    status: "restored",
    backgroundHydration,
  };
}

export function createSessionRestoreDependenciesForTest(
  overrides: Partial<SessionRestoreDependencies>
): SessionRestoreDependencies {
  const defaultDeps = createDefaultDependencies();
  return {
    ...defaultDeps,
    ...overrides,
  };
}

export async function hydrateTableWorkspaceForTest(
  deps: SessionRestoreDependencies,
  workspaceId: string,
  state: PersistedTableState
) {
  await hydrateTableWorkspace(deps, workspaceId, state);
}
