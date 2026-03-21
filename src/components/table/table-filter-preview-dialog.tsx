import React, { useState } from "react";
import { useKeyboard } from "@opentui/react";
import { useTheme } from "../../theme";
import type { TableFilterClause } from "../../db/types";
import { useUIStore } from "../../store/ui";
import { useTableDataStore } from "../../store/table-data";
import { Dialog } from "../ui/dialog";

interface PreviewData {
  workspaceId: string;
  quickSearch: string;
  filters: TableFilterClause[];
  sql: string;
}

export function TableFilterPreviewDialog() {
  const theme = useTheme();
  const { dialogData, closeDialog, openDialog } = useUIStore();
  const store = useTableDataStore();
  const [isApplying, setIsApplying] = useState(false);

  const data = dialogData as PreviewData | null;

  const backToFilters = () => {
    if (!data) {
      closeDialog();
      return;
    }

    openDialog("table-filters", {
      workspaceId: data.workspaceId,
      initialQuickSearch: data.quickSearch,
      initialFilters: data.filters,
    });
  };

  const apply = async () => {
    if (!data) return;
    setIsApplying(true);
    closeDialog();
    await store.applyViewConstraints(data.workspaceId, {
      quickSearch: data.quickSearch,
      filters: data.filters,
    });
  };

  useKeyboard((key) => {
    if (isApplying) return;

    if (key.name === "return") {
      void apply();
      key.stopPropagation();
      return;
    }

    if (key.name === "escape") {
      backToFilters();
      key.stopPropagation();
    }
  });

  if (!data) return null;

  const sqlLines = data.sql.split("\n");
  const dialogHeight = Math.max(14, 9 + sqlLines.length);

  return (
    <Dialog title="Preview Filter Query" width={72} height={dialogHeight}>
      <box style={{ flexDirection: "column", gap: 1, flexGrow: 1 }}>
        {data.quickSearch ? (
          <text fg={theme.textDim}>Search: "{data.quickSearch}"</text>
        ) : (
          <text fg={theme.textDim}>Search: none</text>
        )}
        <text fg={theme.textDim}>Filters: {data.filters.length}</text>

        <box style={{ flexDirection: "row" }}>
          <text fg={theme.textDim}>{"── SQL "}</text>
          <text fg={theme.textDim}>{"─".repeat(58)}</text>
        </box>

        <box
          style={{
            flexDirection: "column",
            backgroundColor: theme.bg,
            paddingX: 1,
          }}
        >
          {sqlLines.map((line, index) => (
            <text key={index} fg={theme.warning}>{line}</text>
          ))}
        </box>

        <box style={{ flexGrow: 1 }} />

        <box style={{ flexDirection: "row", justifyContent: "center", gap: 2 }}>
          {isApplying ? (
            <text fg={theme.warning}>Applying...</text>
          ) : (
            <>
              <text fg={theme.success}>[Enter] Apply</text>
              <text fg={theme.textDim}>[Esc] Back to filters</text>
            </>
          )}
        </box>
      </box>
    </Dialog>
  );
}
