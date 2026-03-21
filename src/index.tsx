#!/usr/bin/env bun
import { createCliRenderer } from "@opentui/core";
import { createRoot, useRenderer } from "@opentui/react";
import React, { useEffect } from "react";
import { App } from "./app";
import { enableLogging, logInfo, logWarn } from "./utils/logger";
import { getSetting } from "./storage";
import { loadSession } from "./storage/session";
import { useUIStore } from "./store/ui";
import { useConnectionsStore } from "./store/connections";
import { useSchemaStore } from "./store/schema";
import { useWorkspaceStore } from "./store/workspaces";
import { useTableDataStore } from "./store/table-data";
import { useQueryStore } from "./store/query";
import { getThemeById } from "./theme/registry";

// Always enable logging so users can debug
enableLogging();

function Root() {
  const renderer = useRenderer();

  useEffect(() => {
    renderer.setTerminalTitle("DataSlip");
  }, []);

  return <App />;
}

async function restoreSession() {
  const session = loadSession();
  if (!session || !session.connectionId || session.workspaces.length === 0) {
    logInfo("No session to restore");
    return;
  }

  // Load connections first
  useConnectionsStore.getState().loadConnections();
  const connections = useConnectionsStore.getState().connections;
  const savedConn = connections.find((c) => c.id === session.connectionId);

  if (!savedConn) {
    logWarn("Saved connection not found, skipping restore", {
      connectionId: session.connectionId,
    });
    return;
  }

  // Try to auto-reconnect
  logInfo("Auto-reconnecting to restore session", {
    name: savedConn.name,
    host: savedConn.host,
  });

  const success = await useConnectionsStore.getState().connectTo(savedConn.id);
  if (!success) {
    logWarn("Auto-reconnect failed, showing connections screen");
    return;
  }

  // Connection succeeded — restore state
  logInfo("Auto-reconnect succeeded, restoring workspaces");

  // Switch to main screen
  useUIStore.getState().setScreen("main");

  // Restore workspaces
  useWorkspaceStore.getState().restoreFromSession(session);

  // Restore query workspace states (text only, no results)
  for (const ws of session.workspaces) {
    if (ws.kind === "query") {
      const qs = session.queryStateByWorkspaceId[ws.id];
      useQueryStore.getState().initWorkspace(ws.id, qs?.queryText || "");
    } else if (ws.kind === "table") {
      useTableDataStore.getState().initWorkspace(ws.id);

      // Restore persisted table state (page, sort, selection)
      const ts = session.tableStateByWorkspaceId[ws.id];
      if (ts) {
        // Pre-populate the workspace state with persisted navigation state
        // before loading data (loadTable will reset some of these, so we
        // apply them after load below)
      }
    }
  }

  // Load schemas for the tree
  await useSchemaStore.getState().loadSchemas();

  // Restore tree state
  if (session.tree) {
    if (session.tree.expandedNodeIds.length > 0) {
      const schemaStore = useSchemaStore.getState();
      const expanded = new Set(session.tree.expandedNodeIds);
      // We need to set expandedNodes then rebuild the tree
      // Access internal state carefully via getState + set pattern
      useSchemaStore.setState({
        expandedNodes: expanded,
        selectedNodeId: session.tree.selectedNodeId,
      });
      const tree = useSchemaStore.getState().buildTree();
      useSchemaStore.setState({ treeNodes: tree });
    }
  }

  // Hydrate the active workspace first, then others lazily
  const activeWsId = session.activeWorkspaceId;
  const activeWs = session.workspaces.find((w) => w.id === activeWsId);

  if (activeWs?.kind === "table") {
    const ts = session.tableStateByWorkspaceId[activeWs.id];
    if (ts) {
      await useTableDataStore.getState().loadTable(
        activeWs.id,
        ts.schema,
        ts.table,
        ts.relationType
      );
      // Restore navigation state after load
      const store = useTableDataStore.getState();
      const wsState = store.byWorkspaceId[activeWs.id];
      if (wsState) {
        // Apply persisted state that loadTable reset
        useTableDataStore.setState({
          byWorkspaceId: {
            ...store.byWorkspaceId,
            [activeWs.id]: {
              ...wsState,
              page: ts.page,
              pageSize: ts.pageSize,
              orderBy: ts.orderBy,
              orderDir: ts.orderDir,
              selectedRow: ts.selectedRow,
              selectedCol: ts.selectedCol,
              scrollOffsetX: ts.scrollOffsetX,
            },
          },
        });

        // If page/sort differs from defaults, re-query with correct params
        if (ts.page !== 1 || ts.orderBy) {
          // Need to re-fetch with correct page/sort
          await useTableDataStore.getState().reloadCurrent(activeWs.id);
        }
      }
    }
  }

  // Set active panel based on workspace
  if (activeWs) {
    useUIStore.getState().setActivePanel(activeWs.lastPanel);
  }

  // Lazy-hydrate inactive table workspaces in the background
  for (const ws of session.workspaces) {
    if (ws.id === activeWsId) continue; // Already hydrated
    if (ws.kind === "table") {
      const ts = session.tableStateByWorkspaceId[ws.id];
      if (ts) {
        // Load in background without awaiting
        useTableDataStore.getState().loadTable(
          ws.id,
          ts.schema,
          ts.table,
          ts.relationType
        ).then(() => {
          // Restore navigation state
          const store = useTableDataStore.getState();
          const wsState = store.byWorkspaceId[ws.id];
          if (wsState) {
            useTableDataStore.setState({
              byWorkspaceId: {
                ...store.byWorkspaceId,
                [ws.id]: {
                  ...wsState,
                  page: ts.page,
                  pageSize: ts.pageSize,
                  orderBy: ts.orderBy,
                  orderDir: ts.orderDir,
                  selectedRow: ts.selectedRow,
                  selectedCol: ts.selectedCol,
                  scrollOffsetX: ts.scrollOffsetX,
                },
              },
            });
          }
        }).catch(() => {
          // Mark workspace as invalid
          const store = useTableDataStore.getState();
          const wsState = store.byWorkspaceId[ws.id];
          if (wsState) {
            useTableDataStore.setState({
              byWorkspaceId: {
                ...store.byWorkspaceId,
                [ws.id]: { ...wsState, isInvalid: true, error: "Table may no longer exist" },
              },
            });
          }
        });
      }
    }
  }

  logInfo("Session restore complete", {
    workspaces: session.workspaces.length,
    activeTab: activeWs?.title,
  });
}

async function main() {
  logInfo("Initializing renderer");

  // Load persisted theme before rendering
  try {
    const savedThemeId = getSetting("themeId");
    if (savedThemeId) {
      const themeDef = getThemeById(savedThemeId);
      if (themeDef) {
        useUIStore.getState().setThemeId(savedThemeId);
        logInfo(`Loaded saved theme: ${savedThemeId}`);
      }
    }
  } catch {
    // Ignore errors loading theme — will use default
  }

  // Attempt session restore (auto-reconnect)
  try {
    await restoreSession();
  } catch (err: any) {
    logWarn("Session restore failed", { error: err.message });
    // Fall through to normal startup on connections screen
  }

  const renderer = await createCliRenderer();
  logInfo("Renderer created, mounting React tree");
  createRoot(renderer).render(<Root />);
}

main().catch((err) => {
  console.error("DataSlip failed to start:", err);
  process.exit(1);
});
