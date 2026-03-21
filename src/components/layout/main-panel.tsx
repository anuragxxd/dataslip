import React from "react";
import { DataGrid } from "../table/data-grid";
import { QueryPanel } from "../query/query-panel";
import { TabBar } from "./tab-bar";
import { useUIStore } from "../../store/ui";
import { useWorkspaceStore } from "../../store/workspaces";
import { useTheme } from "../../theme";

interface MainPanelProps {
  width: number;
  height: number;
}

export function MainPanel({ width, height }: MainPanelProps) {
  const theme = useTheme();
  const { activePanel, activeDialog } = useUIStore();
  const { workspaces } = useWorkspaceStore();
  const activeWs = useWorkspaceStore((s) => {
    const id = s.activeWorkspaceId;
    return id ? s.workspaces.find((w) => w.id === id) || null : null;
  });

  const hasTabs = workspaces.length > 0;
  const contentHeight = hasTabs ? Math.max(1, height - 1) : height;

  if (!activeWs) {
    return (
      <box style={{ flexGrow: 1, width, height, flexDirection: "column" }}>
        <box
          style={{
            flexGrow: 1,
            height: contentHeight,
            justifyContent: "center",
            alignItems: "center",
            border: true,
            borderStyle: "rounded",
            borderColor: theme.border,
            backgroundColor: theme.bg,
          }}
        >
          <box style={{ flexDirection: "column", alignItems: "center", gap: 1 }}>
            <text fg={theme.textDim}>No open tabs</text>
            <text fg={theme.textMuted}>Press Enter on a table or Ctrl+T for a query tab</text>
          </box>
        </box>
      </box>
    );
  }

  if (activeWs.kind === "query") {
    return (
      <box style={{ flexGrow: 1, width, height, flexDirection: "column" }}>
        <TabBar width={width} />
        <box style={{ flexGrow: 1, height: contentHeight }}>
          <QueryPanel workspaceId={activeWs.id} width={width} height={contentHeight} />
        </box>
      </box>
    );
  }

  return (
    <box style={{ flexGrow: 1, width, height, flexDirection: "column" }}>
      <TabBar width={width} />
      <box style={{ flexGrow: 1, height: contentHeight }}>
        <DataGrid
          workspaceId={activeWs.id}
          focused={activePanel === "grid" && activeDialog === "none"}
          width={width}
          height={contentHeight}
        />
      </box>
    </box>
  );
}
