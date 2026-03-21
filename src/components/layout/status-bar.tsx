import React from "react";
import { useTheme } from "../../theme";
import { useTableDataStore } from "../../store/table-data";
import { useUIStore } from "../../store/ui";
import { useQueryStore } from "../../store/query";
import { useWorkspaceStore } from "../../store/workspaces";
import { formatRowCount, truncate } from "../../utils/format";
import { formatFiltersSummary } from "../../utils/sql";

export function StatusBar() {
  const theme = useTheme();
  const { activePanel } = useUIStore();
  const activeWs = useWorkspaceStore((s) => {
    const id = s.activeWorkspaceId;
    return id ? s.workspaces.find((w) => w.id === id) || null : null;
  });

  if (!activeWs) {
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
        <text fg={theme.textDim}>Select a table to view data | / search schema | Ctrl+T new query</text>
      </box>
    );
  }

  if (activeWs.kind === "query") {
    return <QueryStatusBar workspaceId={activeWs.id} />;
  }

  return <TableStatusBar workspaceId={activeWs.id} />;
}

function QueryStatusBar({ workspaceId }: { workspaceId: string }) {
  const theme = useTheme();
  const { activePanel } = useUIStore();
  const qs = useQueryStore((s) => s.getWorkspaceState(workspaceId));

  const latest = qs.history[0];

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
        <text fg={theme.text}>Query editor</text>
        {qs.isExecuting && <text fg={theme.warning}> | Running...</text>}
        {!qs.isExecuting && qs.error && (
          <text fg={theme.error}> | {truncate(qs.error, 60)}</text>
        )}
        {!qs.isExecuting && !qs.error && qs.result && (
          <text fg={theme.textDim}>
            {" "}
            | {qs.result.rowCount} rows | {qs.result.duration}ms
          </text>
        )}
        {!qs.isExecuting && !qs.error && !qs.result && latest && (
          <text fg={theme.textDim}>
            {" "}
            | Last run: {latest.rowCount} rows in {latest.duration}ms
          </text>
        )}
      </box>
      <text fg={theme.textDim}>
        Focus: {activePanel === "sidebar" ? "Tree" : activePanel === "query-results" ? "Results" : "Query"}
      </text>
    </box>
  );
}

function TableStatusBar({ workspaceId }: { workspaceId: string }) {
  const theme = useTheme();
  const { activePanel } = useUIStore();
  const ts = useTableDataStore((s) => s.getWorkspaceState(workspaceId));

  const totalPages = Math.max(1, Math.ceil(ts.totalRows / ts.pageSize));

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
      {ts.currentTable ? (
        <>
          <box style={{ flexDirection: "row", flexGrow: 1 }}>
            <text fg={theme.text}>
              {ts.currentSchema}.{ts.currentTable}
            </text>
            <text fg={theme.textDim}>
              {" "}
              | {formatRowCount(ts.totalRows)} rows | Page {ts.page}/{totalPages} | {ts.pageSize}/page | n/p page | r reload
            </text>
            {ts.quickSearch && (
              <text fg={theme.textDim}> | Search: {truncate(ts.quickSearch, 20)}</text>
            )}
            {ts.filters.length > 0 && (
              <text fg={theme.textDim}> | {truncate(formatFiltersSummary(ts.filters), 36)}</text>
            )}
            {ts.orderBy && (
              <text fg={theme.textDim}>
                {" "}
                | Sort: {ts.orderBy} {ts.orderDir}
              </text>
            )}
            {ts.isLoading && <text fg={theme.warning}> | Loading...</text>}
            {ts.result && !ts.isLoading && (
              <text fg={theme.textDim}> | {ts.result.duration}ms</text>
            )}
          </box>
          <text fg={theme.textDim}>
            Focus: {activePanel === "sidebar" ? "Tree" : "Grid"}
          </text>
        </>
      ) : (
        <text fg={theme.textDim}>Loading table...</text>
      )}
    </box>
  );
}
