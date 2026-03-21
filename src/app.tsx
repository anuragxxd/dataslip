import React, { useEffect } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { useTheme } from "./theme";

// Stores
import { useUIStore } from "./store/ui";
import { useSchemaStore } from "./store/schema";
import { useTableDataStore } from "./store/table-data";
import { useWorkspaceStore } from "./store/workspaces";
import { useSessionPersistence } from "./hooks/use-session-persistence";
import {
  closeWorkspaceWithUi,
  openBlankQueryWorkspace,
  openSeededQueryWorkspace,
} from "./utils/workspace-actions";
import { quitApp } from "./utils/session-actions";

// Layout
import { Header } from "./components/layout/header";
import { StatusBar } from "./components/layout/status-bar";
import { Sidebar } from "./components/layout/sidebar";
import { MainPanel } from "./components/layout/main-panel";

// Screens
import { ConnectionList } from "./components/connection/connection-list";

// Dialogs
import { ConnectionForm } from "./components/connection/connection-form";
import { HelpDialog } from "./components/ui/help-dialog";
import { ConfirmDeleteDialog } from "./components/ui/confirm-dialog";
import { ThemePicker } from "./components/ui/theme-picker";
import { CommandPanel } from "./components/ui/command-panel";
import { SchemaSearch } from "./components/ui/schema-search";
import { EditConfirmDialog } from "./components/ui/edit-confirm-dialog";
import { DialogFocusManager } from "./components/ui/dialog-focus-manager";
import { SessionConfirmDialog } from "./components/ui/session-confirm-dialog";
import { TableFiltersDialog } from "./components/table/table-filters-dialog";
import { TableFilterPreviewDialog } from "./components/table/table-filter-preview-dialog";
import { ToastContainer } from "./components/ui/toast";

export function App() {
  const { width, height } = useTerminalDimensions();
  const theme = useTheme();
  const {
    screen,
    activePanel,
    activeDialog,
    dialogData,
    openDialog,
    setActivePanel,
    sidebarWidth,
  } = useUIStore();
  const { jumpToTable } = useSchemaStore();
  const wsStore = useWorkspaceStore();
  const { activeWorkspaceId, workspaces } = wsStore;

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId) || null;

  // Auto-persist session to SQLite
  useSessionPersistence();

  // When active workspace changes, sync the tree and focus
  useEffect(() => {
    const workspace = useWorkspaceStore.getState().getActiveWorkspace();
    if (!workspace) return;

    if (workspace.kind === "table" && workspace.source?.schema && workspace.source?.table) {
      void jumpToTable(workspace.source.schema, workspace.source.table);
    }

    setActivePanel(workspace.lastPanel);
  }, [activeWorkspaceId, jumpToTable, setActivePanel]);

  // Track panel changes back to workspace meta
  useEffect(() => {
    if (!activeWs) return;
    if (activePanel === "sidebar") return; // Don't store sidebar as lastPanel
    const validPanels = activeWs.kind === "query"
      ? ["query", "query-results"]
      : ["grid"];
    if (validPanels.includes(activePanel) && activePanel !== activeWs.lastPanel) {
      wsStore.updateWorkspaceMeta(activeWs.id, {
        lastPanel: activePanel as "grid" | "query" | "query-results",
      });
    }
  }, [activePanel, activeWs, wsStore]);

  // When no workspaces are open and we're on main screen, focus sidebar
  useEffect(() => {
    if (screen === "main" && workspaces.length === 0) {
      setActivePanel("sidebar");
    }
  }, [screen, workspaces.length, setActivePanel]);

  // Global keybindings
  useKeyboard((key) => {
    // Ctrl+K opens command panel from anywhere
    if (key.ctrl && key.name === "k") {
      if (activeDialog === "command-panel") {
        useUIStore.getState().closeDialog();
      } else {
        openDialog("command-panel");
      }
      return;
    }

    // Don't handle keys when a dialog is open
    if (activeDialog !== "none") return;

    const isEditingCell =
      activeWs?.kind === "table" &&
      useTableDataStore.getState().getWorkspaceState(activeWs.id).edit.editMode;

    if (isEditingCell) {
      return;
    }

    // ── Query workspace panel switching ──
    if (
      screen === "main" &&
      activeWs?.kind === "query" &&
      (activePanel === "query" || activePanel === "query-results")
    ) {
      if (key.name === "tab") {
        const nextPanel = activePanel === "query" ? "query-results" : "sidebar";
        key.preventDefault();
        key.stopPropagation();
        setActivePanel(nextPanel);
        return;
      }

      if (key.name === "escape") {
        key.preventDefault();
        key.stopPropagation();
        setActivePanel("sidebar");
        return;
      }

      if (key.ctrl && key.name === "c") {
        key.preventDefault();
        key.stopPropagation();
        openDialog("confirm-quit");
        return;
      }

      // Fall through for tab-switching shortcuts below
    }

    // ── Tab shortcuts (available on main screen) ──
    if (screen === "main") {
      if (key.ctrl && key.name === "n") {
        key.preventDefault();
        key.stopPropagation();
        wsStore.nextWorkspace();
        return;
      }

      if (key.ctrl && key.name === "p") {
        key.preventDefault();
        key.stopPropagation();
        wsStore.prevWorkspace();
        return;
      }

      if (key.ctrl && key.name === "w") {
        key.preventDefault();
        key.stopPropagation();
        if (activeWs) {
          closeWorkspaceWithUi(activeWs.id);
        }
        return;
      }

      if (key.ctrl && key.name === "t") {
        key.preventDefault();
        key.stopPropagation();
        openBlankQueryWorkspace();
        return;
      }
    }

    // ── Help ──
    if (key.sequence === "?" || (key.shift && key.name === "slash")) {
      key.preventDefault();
      key.stopPropagation();
      openDialog("help");
      return;
    }

    // ── Schema search ──
    if ((key.sequence === "/" || key.name === "slash") && screen === "main") {
      key.preventDefault();
      key.stopPropagation();
      openDialog("schema-search");
      return;
    }

    // ── Tab/panel switching ──
    if (key.name === "tab" && screen === "main") {
      key.preventDefault();
      key.stopPropagation();
      if (!activeWs) {
        setActivePanel("sidebar");
        return;
      }

      if (activeWs.kind === "query") {
        if (activePanel === "sidebar") {
          setActivePanel("query");
        } else if (activePanel === "query") {
          setActivePanel("query-results");
        } else {
          setActivePanel("sidebar");
        }
      } else {
        setActivePanel(activePanel === "sidebar" ? "grid" : "sidebar");
      }
      return;
    }

    if (
      key.name === "q" &&
      screen === "main" &&
      activeWs?.kind === "table" &&
      activeWs.source?.schema &&
      activeWs.source?.table
    ) {
      key.preventDefault();
      key.stopPropagation();
      openSeededQueryWorkspace(activeWs.source.schema, activeWs.source.table);
      return;
    }

    if (key.name === "escape" && screen === "main") {
      key.preventDefault();
      key.stopPropagation();

      if (activePanel !== "sidebar") {
        setActivePanel("sidebar");
        return;
      }

      openDialog("confirm-disconnect");
    } else if (key.name === "q" && screen === "connections") {
      key.preventDefault();
      key.stopPropagation();
      openDialog("confirm-quit");
    } else if (key.ctrl && key.name === "c") {
      key.preventDefault();
      key.stopPropagation();
      if (screen === "main" || screen === "connections") {
        openDialog("confirm-quit");
      } else {
        quitApp();
      }
    }
  });

  const contentHeight = height - 2; // header(1) + status bar(1)
  const mainPanelWidth = width - sidebarWidth;

  return (
    <box
      style={{
        width: "100%",
        height: "100%",
        flexDirection: "column",
        backgroundColor: theme.bg,
      }}
    >
      <DialogFocusManager />
      <Header />

      <box style={{ flexGrow: 1, width: "100%" }}>
        {screen === "connections" ? (
          <ConnectionList />
        ) : (
          <box
            style={{
              flexDirection: "row",
              width: "100%",
              height: contentHeight,
            }}
          >
            <Sidebar height={contentHeight} />
            <MainPanel width={mainPanelWidth} height={contentHeight} />
          </box>
        )}
      </box>

      {screen === "main" && <StatusBar />}

      {/* Dialogs (overlay layer) */}
      {activeDialog === "connection-form" && <ConnectionForm />}
      {activeDialog === "connection-edit" && (
        <ConnectionForm editConnection={dialogData} />
      )}
      {activeDialog === "help" && <HelpDialog />}
      {activeDialog === "confirm-delete" && <ConfirmDeleteDialog />}
      {(activeDialog === "confirm-disconnect" || activeDialog === "confirm-quit") && (
        <SessionConfirmDialog />
      )}
      {activeDialog === "theme-picker" && <ThemePicker />}
      {activeDialog === "command-panel" && <CommandPanel />}
      {activeDialog === "schema-search" && <SchemaSearch />}
      {activeDialog === "table-filters" && <TableFiltersDialog />}
      {activeDialog === "table-filter-preview" && <TableFilterPreviewDialog />}
      {activeDialog === "edit-confirm" && <EditConfirmDialog />}

      {/* Toast notifications */}
      <ToastContainer />
    </box>
  );
}
