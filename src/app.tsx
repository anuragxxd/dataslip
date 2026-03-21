import React, { useCallback, useEffect } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { useTheme } from "./theme";

// Stores
import { useUIStore } from "./store/ui";
import { useConnectionsStore } from "./store/connections";
import { useSchemaStore } from "./store/schema";
import { useTableDataStore } from "./store/table-data";
import { useQueryStore } from "./store/query";
import { buildSelectAllQuery } from "./utils/sql";

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
import { ToastContainer } from "./components/ui/toast";

export function App() {
  const { width, height } = useTerminalDimensions();
  const theme = useTheme();
  const {
    screen,
    setScreen,
    activePanel,
    activeDialog,
    dialogData,
    openDialog,
    setActivePanel,
    togglePanel,
    sidebarWidth,
    resetNavigation,
  } = useUIStore();
  const { disconnectCurrent } = useConnectionsStore();
  const { reset: resetSchema } = useSchemaStore();
  const { currentSchema, currentTable, reset: resetTableData } = useTableDataStore();
  const { isOpen: isQueryOpen, openQuery, closeQuery, reset: resetQuery } = useQueryStore();

  const handleDisconnect = useCallback(async () => {
    await disconnectCurrent();
    resetSchema();
    resetTableData();
    resetQuery();
    resetNavigation();
    setScreen("connections");
  }, [disconnectCurrent, resetNavigation, resetQuery, resetSchema, resetTableData, setScreen]);

  useEffect(() => {
    if (screen === "main" && !currentTable && activePanel === "grid") {
      setActivePanel("sidebar");
    }
  }, [activePanel, currentTable, screen, setActivePanel]);

  // Global keybindings
  useKeyboard((key) => {
    // Ctrl+K opens command panel from anywhere (even over other dialogs)
    if (key.ctrl && key.name === "k") {
      if (activeDialog === "command-panel") {
        // Toggle off if already open
        useUIStore.getState().closeDialog();
      } else {
        openDialog("command-panel");
      }
      return;
    }

    // Don't handle keys when a dialog is open (dialogs handle their own)
    if (activeDialog !== "none") return;

    if (
      screen === "main" &&
      isQueryOpen &&
      (activePanel === "query" || activePanel === "query-results")
    ) {
      if (key.name === "tab") {
        setActivePanel(activePanel === "query" ? "query-results" : "sidebar");
        return;
      }

      if (key.name === "escape") {
        setActivePanel(closeQuery());
        return;
      }

      if (key.ctrl && key.name === "c") {
        process.exit(0);
      }

      return;
    }

    if ((key.sequence === "/" || key.name === "slash") && screen === "main") {
      openDialog("schema-search");
      return;
    }

    if (key.name === "tab" && screen === "main") {
      if (isQueryOpen) {
        setActivePanel(activePanel === "sidebar" ? "query" : "sidebar");
        return;
      }

      if (!currentTable) {
        setActivePanel("sidebar");
        return;
      }
      togglePanel();
    } else if (key.name === "q" && screen === "main") {
      if (isQueryOpen) {
        setActivePanel("query");
        return;
      }

      const initialQuery =
        currentSchema && currentTable
          ? buildSelectAllQuery(currentSchema, currentTable)
          : undefined;
      openQuery(activePanel === "grid" ? "grid" : "sidebar", initialQuery);
      setActivePanel("query");
    } else if (key.name === "escape" && screen === "main") {
      if (isQueryOpen) {
        setActivePanel(closeQuery());
        return;
      }
      // Don't disconnect if the grid is in edit mode — let the grid handle Escape
      if (useTableDataStore.getState().edit.editMode) {
        return;
      }
      handleDisconnect();
    } else if (key.name === "q" && screen === "connections") {
      process.exit(0);
    } else if (key.ctrl && key.name === "c") {
      process.exit(0);
    }
  });

  const contentHeight = height - 2; // header + status bar
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
          <box style={{ flexDirection: "row", width: "100%", height: contentHeight }}>
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
      {activeDialog === "theme-picker" && <ThemePicker />}
      {activeDialog === "command-panel" && <CommandPanel />}
      {activeDialog === "schema-search" && <SchemaSearch />}
      {activeDialog === "edit-confirm" && <EditConfirmDialog />}

      {/* Toast notifications */}
      <ToastContainer />
    </box>
  );
}
