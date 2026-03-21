import React, { useState } from "react";
import { useKeyboard } from "@opentui/react";
import { useTheme } from "../../theme";
import { useUIStore } from "../../store/ui";
import { useTableDataStore } from "../../store/table-data";
import { useWorkspaceStore } from "../../store/workspaces";
import { getActiveSql } from "../../db/connection";
import * as queryModule from "../../db/query";
import { showToast } from "./toast";
import { Dialog } from "./dialog";

interface EditConfirmData {
  sql: string;
  column: string;
  columnType: string;
  oldValue: unknown;
  newValue: string;
  isNull: boolean;
  oldDisplay: string;
  newDisplay: string;
}

export function EditConfirmDialog() {
  const theme = useTheme();
  const { dialogData, closeDialog } = useUIStore();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const store = useTableDataStore();
  const [isExecuting, setIsExecuting] = useState(false);

  const data = dialogData as EditConfirmData | null;

  useKeyboard((key) => {
    if (isExecuting) return;

    if (key.name === "return") {
      handleExecute();
      key.stopPropagation();
      return;
    }

    if (key.name === "escape") {
      // Go back to edit mode — close dialog but keep edit state
      closeDialog();
      key.stopPropagation();
      return;
    }
  });

  const handleExecute = async () => {
    if (!data || !activeWorkspaceId) return;

    const sql = getActiveSql();
    if (!sql) {
      showToast("No active database connection", "error");
      closeDialog();
      store.cancelEdit(activeWorkspaceId);
      return;
    }

    setIsExecuting(true);

    try {
      const result = await queryModule.executeUpdate(sql, data.sql);

      if (result.rowsAffected === 0) {
        showToast(
          "No rows updated — row may have been modified or deleted",
          "warning",
          4000
        );
        closeDialog();
        store.cancelEdit(activeWorkspaceId);
        return;
      }

      if (result.rowsAffected > 1) {
        showToast(
          `Warning: ${result.rowsAffected} rows affected (expected 1)`,
          "error",
          5000
        );
      }

      // Apply the edit to the in-memory data
      store.applyEdit(activeWorkspaceId, data.column, data.newValue, data.isNull);
      closeDialog();
      showToast(
        `Updated ${data.column} (${result.duration}ms)`,
        "success",
        2000
      );
    } catch (err: any) {
      setIsExecuting(false);
      showToast(err.message || String(err), "error", 5000);
    }
  };

  if (!data) return null;

  // Split SQL into lines for display
  const sqlLines = data.sql.split("\n");

  // Calculate dialog height based on content
  const dialogHeight = Math.max(16, 10 + sqlLines.length);

  return (
    <Dialog title="Confirm Edit" width={64} height={dialogHeight}>
      <box style={{ flexDirection: "column", gap: 0 }}>
        {/* Column info */}
        <box style={{ flexDirection: "row" }}>
          <box style={{ width: 14 }}>
            <text fg={theme.textDim}>Column</text>
          </box>
          <text fg={theme.accent}>{data.column}</text>
          <text fg={theme.textDim}>{" "}({data.columnType})</text>
        </box>

        {/* Spacer */}
        <box style={{ height: 1 }} />

        {/* Old value */}
        <box style={{ flexDirection: "row" }}>
          <box style={{ width: 14 }}>
            <text fg={theme.textDim}>Old value</text>
          </box>
          <text fg={theme.error}>{truncateDisplay(data.oldDisplay, 46)}</text>
        </box>

        {/* New value */}
        <box style={{ flexDirection: "row" }}>
          <box style={{ width: 14 }}>
            <text fg={theme.textDim}>New value</text>
          </box>
          <text fg={theme.success}>{truncateDisplay(data.newDisplay, 46)}</text>
        </box>

        {/* Spacer */}
        <box style={{ height: 1 }} />

        {/* SQL section */}
        <box style={{ flexDirection: "row" }}>
          <text fg={theme.textDim}>{"── SQL "}</text>
          <text fg={theme.textDim}>{"─".repeat(52)}</text>
        </box>

        <box
          style={{
            flexDirection: "column",
            backgroundColor: theme.bg,
            paddingX: 1,
            paddingY: 0,
          }}
        >
          {sqlLines.map((line, i) => (
            <text key={i} fg={theme.warning}>{line}</text>
          ))}
        </box>

        {/* Spacer */}
        <box style={{ flexGrow: 1 }} />

        {/* Action bar */}
        <box
          style={{
            flexDirection: "row",
            justifyContent: "center",
            gap: 2,
            paddingTop: 1,
          }}
        >
          {isExecuting ? (
            <text fg={theme.warning}>Executing...</text>
          ) : (
            <>
              <text fg={theme.success}>[Enter] Execute</text>
              <text fg={theme.textDim}>[Esc] Back to editing</text>
            </>
          )}
        </box>
      </box>
    </Dialog>
  );
}

function truncateDisplay(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}
