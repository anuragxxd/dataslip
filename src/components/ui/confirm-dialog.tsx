import React from "react";
import { useKeyboard } from "@opentui/react";
import { useTheme } from "../../theme";
import { useUIStore } from "../../store/ui";
import { useConnectionsStore } from "../../store/connections";
import { Dialog } from "./dialog";
import { showToast } from "./toast";
import type { ConnectionConfig } from "../../db/types";

export function ConfirmDeleteDialog() {
  const theme = useTheme();
  const { closeDialog, dialogData } = useUIStore();
  const { removeConnection } = useConnectionsStore();
  const conn = dialogData as ConnectionConfig | null;

  useKeyboard((key) => {
    if (key.name === "y" || key.name === "return") {
      if (conn) {
        removeConnection(conn.id);
        // Clamp connectionListIndex to stay within the new list bounds
        const remaining = useConnectionsStore.getState().connections.length;
        const { connectionListIndex, setConnectionListIndex } = useUIStore.getState();
        if (connectionListIndex >= remaining) {
          setConnectionListIndex(Math.max(0, remaining - 1));
        }
        showToast(`Deleted ${conn.name}`, "info");
      }
      closeDialog();
    } else if (key.name === "n" || key.name === "escape") {
      closeDialog();
    }
  });

  if (!conn) return null;

  return (
    <Dialog title="Confirm Delete" width={46} height={8}>
      <box style={{ flexDirection: "column", gap: 1 }}>
        <text fg={theme.text}>
          Delete connection "{conn.name}"?
        </text>
        <text fg={theme.textDim}>
          {conn.host}:{conn.port}/{conn.database}
        </text>
        <box style={{ flexDirection: "row", gap: 2, paddingTop: 1 }}>
          <text fg={theme.error}>[y] Yes, delete</text>
          <text fg={theme.textDim}>[n] Cancel</text>
        </box>
      </box>
    </Dialog>
  );
}
