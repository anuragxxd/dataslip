import React from "react";
import { useTheme } from "../../theme";
import { useConnectionsStore } from "../../store/connections";

export function Header() {
  const theme = useTheme();
  const { connections, activeConnectionId } = useConnectionsStore();

  const activeConn = connections.find((c) => c.id === activeConnectionId);
  const connLabel = activeConn
    ? ` ─── ${activeConn.name} (${activeConn.username}@${activeConn.host}:${activeConn.port}/${activeConn.database})`
    : "";

  return (
    <box
      style={{
        width: "100%",
        height: 1,
        flexDirection: "row",
        backgroundColor: theme.bgAlt,
        paddingX: 1,
      }}
    >
      <box style={{ flexDirection: "row", flexGrow: 1 }}>
        <text fg={theme.accent}>DataSlip</text>
        {activeConn && (
          <text fg={theme.textDim}>{connLabel}</text>
        )}
      </box>
      <text fg={theme.textDim}>/ Search  Ctrl+K Cmds  Ctrl+T Query  Ctrl+P/N Tabs  ? Help</text>
    </box>
  );
}
