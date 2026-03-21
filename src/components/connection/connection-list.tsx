import React, { useCallback, useEffect } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { useTheme } from "../../theme";
import { useConnectionsStore } from "../../store/connections";
import { useUIStore } from "../../store/ui";
import { useSchemaStore } from "../../store/schema";
import { useTableDataStore } from "../../store/table-data";
import { KeybindBar } from "../ui/keybind-bar";
import { showToast } from "../ui/toast";

export function ConnectionList() {
  const { width, height } = useTerminalDimensions();
  const theme = useTheme();
  const {
    connections,
    isConnecting,
    connectError,
    connectTo,
    loadConnections,
  } = useConnectionsStore();
  const {
    connectionListIndex,
    setConnectionListIndex,
    openDialog,
    setScreen,
    setActivePanel,
    activeDialog,
  } =
    useUIStore();
  const { loadSchemas } = useSchemaStore();
  const { reset: resetTableData } = useTableDataStore();

  useEffect(() => {
    loadConnections();
  }, []);

  const handleConnect = useCallback(async () => {
    if (connections.length === 0) return;
    const conn = connections[connectionListIndex];
    if (!conn) return;

    const success = await connectTo(conn.id);
    if (success) {
      setActivePanel("sidebar");
      setScreen("main");
      resetTableData();
      await loadSchemas();
      showToast(`Connected to ${conn.name}`, "success");
    } else {
      showToast(`Failed to connect`, "error");
    }
  }, [connections, connectionListIndex, connectTo, loadSchemas, resetTableData, setActivePanel, setScreen]);

  const handleDelete = useCallback(() => {
    if (connections.length === 0) return;
    const conn = connections[connectionListIndex];
    if (!conn) return;
    openDialog("confirm-delete", conn);
  }, [connections, connectionListIndex, openDialog]);

  useKeyboard((key) => {
    // Don't handle keys when a dialog is open (form, confirm, etc.)
    if (activeDialog !== "none") return;

    if (key.name === "up" || key.name === "k") {
      setConnectionListIndex(Math.max(0, connectionListIndex - 1));
    } else if (key.name === "down" || key.name === "j") {
      setConnectionListIndex(
        Math.min(connections.length - 1, connectionListIndex + 1)
      );
    } else if (key.name === "return") {
      handleConnect();
    } else if (key.name === "n") {
      openDialog("connection-form");
    } else if (key.name === "e" && connections.length > 0) {
      openDialog("connection-edit", connections[connectionListIndex]);
    } else if (key.name === "d" && connections.length > 0) {
      handleDelete();
    }
  });

  const listHeight = height - 10;

  return (
    <box
      style={{
        flexDirection: "column",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <box
        title=" Connections "
        style={{
          flexDirection: "column",
          width: Math.min(60, width - 4),
          border: true,
          borderStyle: "rounded",
          borderColor: theme.border,
          titleAlignment: "center",
          padding: 1,
          backgroundColor: theme.bgAlt,
        }}
      >
        {connections.length === 0 ? (
          <box
            style={{
              flexDirection: "column",
              alignItems: "center",
              paddingY: 2,
            }}
          >
            <text fg={theme.textDim}>No saved connections</text>
            <text fg={theme.textDim}>Press [n] to create one</text>
          </box>
        ) : (
          <box style={{ flexDirection: "column", gap: 0 }}>
            {connections.slice(0, listHeight).map((conn, idx) => {
              const isSelected = idx === connectionListIndex;
              const connStr = `${conn.host}:${conn.port}/${conn.database}`;
              return (
                <box
                  key={conn.id}
                  style={{
                    flexDirection: "row",
                    backgroundColor: isSelected
                      ? theme.bgSelected
                      : "transparent",
                    paddingX: 1,
                    width: "100%",
                  }}
                >
                  <text fg={isSelected ? theme.accent : theme.textDim}>
                    {isSelected ? ">" : " "}{" "}
                  </text>
                  <text fg={isSelected ? theme.textBright : theme.text}>
                    {conn.name}
                  </text>
                  <text fg={theme.textDim}> ({connStr})</text>
                </box>
              );
            })}
          </box>
        )}

        {isConnecting && (
          <box style={{ paddingTop: 1 }}>
            <text fg={theme.warning}>Connecting...</text>
          </box>
        )}
        {connectError && (
          <box style={{ paddingTop: 1 }}>
            <text fg={theme.error}>Error: {connectError}</text>
          </box>
        )}

        <box style={{ paddingTop: 1 }}>
          <KeybindBar
            bindings={[
              { key: "Enter", label: "Connect" },
              { key: "n", label: "New" },
              { key: "e", label: "Edit" },
              { key: "d", label: "Delete" },
              { key: "q", label: "Quit" },
            ]}
          />
        </box>
      </box>
    </box>
  );
}
