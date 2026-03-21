import React from "react";
import { useKeyboard } from "@opentui/react";
import { useTheme } from "../../theme";
import { useUIStore } from "../../store/ui";
import { useConnectionsStore } from "../../store/connections";
import { Dialog } from "./dialog";
import { disconnectCurrentSession, quitApp } from "../../utils/session-actions";

type Mode = "disconnect" | "quit";

export function SessionConfirmDialog() {
  const theme = useTheme();
  const { activeDialog, closeDialog } = useUIStore();
  const { connections, activeConnectionId } = useConnectionsStore();

  const mode: Mode | null =
    activeDialog === "confirm-disconnect"
      ? "disconnect"
      : activeDialog === "confirm-quit"
        ? "quit"
        : null;

  const activeConnection = connections.find((item) => item.id === activeConnectionId) || null;

  const handleConfirm = async () => {
    if (mode === "disconnect") {
      closeDialog();
      await disconnectCurrentSession();
      return;
    }

    if (mode === "quit") {
      closeDialog();
      quitApp();
    }
  };

  useKeyboard((key) => {
    if (!mode) return;

    if (key.name === "y" || key.name === "return") {
      key.preventDefault();
      key.stopPropagation();
      void handleConfirm();
      return;
    }

    if (key.name === "n" || key.name === "escape") {
      key.preventDefault();
      key.stopPropagation();
      closeDialog();
    }
  });

  if (!mode) return null;

  const title = mode === "disconnect" ? "Disconnect Session" : "Quit DataSlip";
  const primaryLabel = mode === "disconnect" ? "[y] Disconnect" : "[y] Quit";
  const question =
    mode === "disconnect"
      ? "Disconnect from the current database session?"
      : "Quit DataSlip now?";
  const detail =
    mode === "disconnect"
      ? activeConnection
        ? `${activeConnection.name} · ${activeConnection.username}@${activeConnection.host}:${activeConnection.port}/${activeConnection.database}`
        : "Current connection will be closed"
      : activeConnection
        ? `Current session for ${activeConnection.name} will be restored next launch`
        : "Your saved tabs will be restored next launch";
  const secondary =
    mode === "disconnect"
      ? "Open tabs for this connection will be cleared"
      : "Open tabs and query text will be restored when you reopen the app";

  return (
    <Dialog title={title} width={60} height={9}>
      <box style={{ flexDirection: "column", gap: 1 }}>
        <text fg={theme.text}>{question}</text>
        <text fg={theme.textDim}>{detail}</text>
        <text fg={theme.textMuted}>{secondary}</text>
        <box style={{ flexDirection: "row", gap: 2, paddingTop: 1 }}>
          <text fg={mode === "disconnect" ? theme.warning : theme.error}>{primaryLabel}</text>
          <text fg={theme.textDim}>[n] Cancel</text>
        </box>
      </box>
    </Dialog>
  );
}
