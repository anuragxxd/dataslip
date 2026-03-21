import React, { useMemo } from "react";
import { useTheme } from "../../theme";
import { useWorkspaceStore } from "../../store/workspaces";
import { useTableDataStore } from "../../store/table-data";
import { truncate } from "../../utils/format";
import {
  activateWorkspaceWithUi,
  closeWorkspaceWithUi,
} from "../../utils/workspace-actions";

interface TabBarProps {
  width: number;
}

export function TabBar({ width }: TabBarProps) {
  const theme = useTheme();
  const { workspaces, activeWorkspaceId } = useWorkspaceStore();
  const tableStore = useTableDataStore();

  const tabs = useMemo(
    () =>
      workspaces.map((workspace) => {
        const tableState =
          workspace.kind === "table"
            ? tableStore.getWorkspaceState(workspace.id)
            : null;

        const typeLabel = workspace.kind === "query" ? "Q" : "T";
        const typeColor = workspace.kind === "query" ? theme.warning : theme.accent;
        const invalid = Boolean(tableState?.isInvalid);
        const dirtyMark = workspace.dirty ? "*" : "";
        const invalidMark = invalid ? " !" : "";
        const label = truncate(
          `${workspace.title}${dirtyMark}${invalidMark}`,
          Math.max(8, Math.min(20, Math.floor((width - 8) / Math.max(1, workspaces.length))))
        );

        return {
          ...workspace,
          invalid,
          typeLabel,
          typeColor,
          label,
        };
      }),
    [tableStore, theme.accent, theme.warning, width, workspaces]
  );

  if (tabs.length === 0) return null;

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
      {tabs.map((tab) => {
        const isActive = tab.id === activeWorkspaceId;

        return (
          <box
            key={tab.id}
            style={{
              flexDirection: "row",
              backgroundColor: isActive ? theme.bgSelected : "transparent",
              paddingRight: 1,
            }}
          >
            <box
              style={{ flexDirection: "row", paddingX: 1 }}
              onMouseDown={() => {
                activateWorkspaceWithUi(tab.id);
              }}
            >
              <text fg={tab.invalid ? theme.error : tab.typeColor}>{tab.typeLabel}</text>
              <text fg={isActive ? theme.textBright : theme.textDim}>{" "}{tab.label}</text>
            </box>

            <box
              style={{ paddingRight: 1 }}
              onMouseDown={() => {
                closeWorkspaceWithUi(tab.id);
              }}
            >
              <text fg={isActive ? theme.textMuted : theme.textDim}>x</text>
            </box>
          </box>
        );
      })}

      <box style={{ flexGrow: 1, justifyContent: "flex-end", flexDirection: "row" }}>
        <text fg={theme.textMuted}>
          {tabs.length > 1 ? "Ctrl+P/N switch" : ""}
        </text>
      </box>
    </box>
  );
}
