import React from "react";
import { useTheme } from "../../theme";
import { useTableDataStore } from "../../store/table-data";
import { useUIStore } from "../../store/ui";
import { useQueryStore } from "../../store/query";
import { formatRowCount, truncate } from "../../utils/format";

export function StatusBar() {
  const theme = useTheme();
  const {
    currentSchema,
    currentTable,
    totalRows,
    page,
    pageSize,
    result,
    isLoading,
    orderBy,
    orderDir,
  } = useTableDataStore();
  const { activePanel } = useUIStore();
  const {
    isOpen: isQueryOpen,
    isExecuting,
    result: queryResult,
    error: queryError,
    history,
  } = useQueryStore();

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  if (isQueryOpen) {
    const latest = history[0];

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
          {isExecuting && <text fg={theme.warning}> | Running...</text>}
          {!isExecuting && queryError && (
            <text fg={theme.error}> | {truncate(queryError, 60)}</text>
          )}
          {!isExecuting && !queryError && queryResult && (
            <text fg={theme.textDim}>
              {" "}
              | {queryResult.rowCount} rows | {queryResult.duration}ms
            </text>
          )}
          {!isExecuting && !queryError && !queryResult && latest && (
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
      {currentTable ? (
        <>
          <box style={{ flexDirection: "row", flexGrow: 1 }}>
            <text fg={theme.text}>
              {currentSchema}.{currentTable}
            </text>
            <text fg={theme.textDim}>
              {" "}
              | {formatRowCount(totalRows)} rows | Page {page}/{totalPages} | {pageSize}/page | n/p page | r reload
            </text>
            {orderBy && (
              <text fg={theme.textDim}>
                {" "}
                | Sort: {orderBy} {orderDir}
              </text>
            )}
            {isLoading && <text fg={theme.warning}> | Loading...</text>}
            {result && !isLoading && (
              <text fg={theme.textDim}> | {result.duration}ms</text>
            )}
          </box>
          <text fg={theme.textDim}>
            Focus: {activePanel === "sidebar" ? "Tree" : "Grid"}
          </text>
        </>
      ) : (
        <text fg={theme.textDim}>Select a table to view data | / search schema</text>
      )}
    </box>
  );
}
