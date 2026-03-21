import React, { useEffect, useMemo, useState } from "react";
import { useKeyboard } from "@opentui/react";
import { useTheme } from "../../theme";
import { useQueryStore } from "../../store/query";
import { useUIStore } from "../../store/ui";
import { formatCellValue, getTypeColor, truncate } from "../../utils/format";

interface QueryResultsProps {
  workspaceId: string;
  focused: boolean;
  width: number;
  height: number;
}

function computeColumnWidths(
  columns: { name: string; type: string }[],
  rows: Record<string, unknown>[],
) {
  if (columns.length === 0) return [];

  const widths = columns.map((col) => Math.max(col.name.length, col.type.length, 6));

  for (const row of rows.slice(0, 20)) {
    for (let i = 0; i < columns.length; i++) {
      widths[i] = Math.max(
        widths[i],
        formatCellValue(row[columns[i].name], 40).length,
      );
    }
  }

  return widths.map((width) => Math.min(Math.max(width, 6), 32));
}

export function QueryResults({ workspaceId, focused, width, height }: QueryResultsProps) {
  const theme = useTheme();
  const { activeDialog, setActivePanel } = useUIStore();
  const { result, isExecuting, error } = useQueryStore().getWorkspaceState(workspaceId);
  const [selectedRow, setSelectedRow] = useState(0);
  const [selectedCol, setSelectedCol] = useState(0);
  const [scrollOffsetY, setScrollOffsetY] = useState(0);
  const [scrollOffsetX, setScrollOffsetX] = useState(0);

  const columns = result?.columns || [];
  const allRows = result?.rows || [];
  const colWidths = useMemo(() => computeColumnWidths(columns, allRows), [columns, allRows]);
  const availableWidth = Math.max(10, width - 4);
  const visibleRowsCount = Math.max(1, height - 6);

  useEffect(() => {
    setSelectedRow(0);
    setSelectedCol(0);
    setScrollOffsetY(0);
    setScrollOffsetX(0);
  }, [result]);

  useEffect(() => {
    const maxRow = Math.max(0, allRows.length - 1);
    const maxCol = Math.max(0, columns.length - 1);
    const maxScrollY = Math.max(0, allRows.length - visibleRowsCount);
    const maxScrollX = Math.max(0, columns.length - 1);

    if (selectedRow > maxRow) setSelectedRow(maxRow);
    if (selectedCol > maxCol) setSelectedCol(maxCol);
    if (scrollOffsetY > maxScrollY) setScrollOffsetY(maxScrollY);
    if (scrollOffsetX > maxScrollX) setScrollOffsetX(maxScrollX);
  }, [allRows.length, columns.length, scrollOffsetX, scrollOffsetY, selectedCol, selectedRow, visibleRowsCount]);

  const visibleColumns = useMemo(() => {
    let usedWidth = 0;
    const visible: Array<{ index: number; width: number }> = [];

    for (let i = scrollOffsetX; i < columns.length; i++) {
      const nextWidth = colWidths[i] + 1;
      if (usedWidth + nextWidth > availableWidth) {
        break;
      }
      visible.push({ index: i, width: colWidths[i] });
      usedWidth += nextWidth;
    }

    if (visible.length === 0 && columns.length > 0) {
      visible.push({ index: scrollOffsetX, width: Math.max(6, availableWidth - 1) });
    }

    return visible;
  }, [availableWidth, colWidths, columns, scrollOffsetX]);

  useKeyboard((key) => {
    if (activeDialog !== "none") return;
    if (!focused) return;

    if (key.name === "q") {
      setActivePanel("query");
      return;
    }

    if (!result || columns.length === 0) {
      if (key.name === "left" || key.name === "h") {
        setActivePanel("query");
      }
      return;
    }

    if (key.name === "up" || key.name === "k") {
      const nextRow = Math.max(0, selectedRow - 1);
      setSelectedRow(nextRow);
      if (nextRow < scrollOffsetY) {
        setScrollOffsetY(nextRow);
      }
      return;
    }

    if (key.name === "down" || key.name === "j") {
      const nextRow = Math.min(allRows.length - 1, selectedRow + 1);
      setSelectedRow(nextRow);
      if (nextRow >= scrollOffsetY + visibleRowsCount) {
        setScrollOffsetY(nextRow - visibleRowsCount + 1);
      }
      return;
    }

    if (key.name === "left" || key.name === "h") {
      if (selectedCol > 0) {
        const nextCol = selectedCol - 1;
        setSelectedCol(nextCol);
        if (nextCol < scrollOffsetX) {
          setScrollOffsetX(nextCol);
        }
      } else {
        setActivePanel("query");
      }
      return;
    }

    if (key.name === "right" || key.name === "l") {
      if (selectedCol < columns.length - 1) {
        const nextCol = selectedCol + 1;
        setSelectedCol(nextCol);
        const lastVisibleColumn = visibleColumns[visibleColumns.length - 1]?.index ?? 0;
        if (nextCol > lastVisibleColumn) {
          setScrollOffsetX(Math.min(columns.length - 1, scrollOffsetX + 1));
        }
      }
      return;
    }

    if (key.name === "g") {
      setSelectedRow(0);
      setScrollOffsetY(0);
      return;
    }

    if (key.name === "G" || key.name === "end") {
      const nextRow = Math.max(0, allRows.length - 1);
      setSelectedRow(nextRow);
      setScrollOffsetY(Math.max(0, allRows.length - visibleRowsCount));
    }
  });

  if (isExecuting) {
    return (
      <box
        title=" Results "
        style={{
          width: "100%",
          height,
          border: true,
          borderStyle: "rounded",
          borderColor: focused ? theme.borderFocused : theme.border,
          backgroundColor: theme.bg,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <text fg={theme.warning}>Running query...</text>
      </box>
    );
  }

  if (error) {
    return (
      <box
        title=" Results "
        style={{
          width: "100%",
          height,
          border: true,
          borderStyle: "rounded",
          borderColor: focused ? theme.borderFocused : theme.error,
          backgroundColor: theme.bg,
          padding: 1,
          flexDirection: "column",
        }}
      >
        <text fg={theme.error}>Query failed</text>
        <text fg={theme.textDim}>{truncate(error, Math.max(20, width - 6))}</text>
      </box>
    );
  }

  if (!result) {
    return (
      <box
        title=" Results "
        style={{
          width: "100%",
          height,
          border: true,
          borderStyle: "rounded",
          borderColor: focused ? theme.borderFocused : theme.border,
          backgroundColor: theme.bg,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <text fg={theme.textDim}>Run a query to see results</text>
      </box>
    );
  }

  if (result.columns.length === 0) {
    return (
      <box
        title=" Results "
        style={{
          width: "100%",
          height,
          border: true,
          borderStyle: "rounded",
          borderColor: focused ? theme.borderFocused : theme.border,
          backgroundColor: theme.bg,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <text fg={theme.success}>Query executed successfully. No rows returned.</text>
      </box>
    );
  }
  const rows = allRows.slice(scrollOffsetY, scrollOffsetY + visibleRowsCount);
  const hiddenRowCount = Math.max(0, allRows.length - rows.length);
  const hiddenColumnCount = Math.max(0, columns.length - visibleColumns.length);

  return (
    <box
      title=" Results "
      style={{
        width: "100%",
        height,
        border: true,
        borderStyle: "rounded",
        borderColor: focused ? theme.borderFocused : theme.border,
        backgroundColor: theme.bg,
        flexDirection: "column",
      }}
    >
      <box
        style={{
          flexDirection: "row",
          backgroundColor: theme.gridHeaderBg,
          width: "100%",
        }}
      >
        {visibleColumns.map(({ index, width: columnWidth }) => (
          <box key={columns[index].name} style={{ width: columnWidth + 1 }}>
            <text fg={theme.gridHeader}> {padRight(columns[index].name, columnWidth)}</text>
          </box>
        ))}
      </box>

      <box
        style={{
          flexDirection: "row",
          backgroundColor: theme.gridHeaderBg,
          width: "100%",
        }}
      >
        {visibleColumns.map(({ index, width: columnWidth }) => {
          const typeThemeKey = getTypeColor(columns[index].type);
          const typeColor =
            theme[typeThemeKey as keyof typeof theme] || theme.textDim;
          return (
            <box key={`${columns[index].name}:type`} style={{ width: columnWidth + 1 }}>
              <text fg={typeColor}> {padRight(columns[index].type, columnWidth)}</text>
            </box>
          );
        })}
      </box>

      <box style={{ width: "100%", height: 1 }}>
        <text fg={theme.gridBorder}>{"─".repeat(Math.max(0, width - 2))}</text>
      </box>

      <box style={{ flexDirection: "column", flexGrow: 1 }}>
        {rows.map((row, rowIndex) => {
          const actualRowIndex = scrollOffsetY + rowIndex;

          return (
          <box
            key={actualRowIndex}
            style={{
              flexDirection: "row",
              width: "100%",
              backgroundColor:
                actualRowIndex === selectedRow
                  ? theme.bgHighlight
                  : actualRowIndex % 2 === 1
                    ? theme.gridRowAlt
                    : "transparent",
            }}
          >
            {visibleColumns.map(({ index, width: columnWidth }) => {
              const column = columns[index];
              const value = row[column.name];
              const isNull = value === null || value === undefined;
              const isSelectedCell = actualRowIndex === selectedRow && index === selectedCol;

              return (
                <box
                  key={`${actualRowIndex}:${column.name}`}
                  style={{
                    width: columnWidth + 1,
                    backgroundColor: isSelectedCell ? theme.gridCellSelected : "transparent",
                  }}
                >
                  <text fg={isNull ? theme.typeNull : isSelectedCell ? theme.textBright : theme.text}>
                    {" "}{padRight(formatCellValue(value, columnWidth), columnWidth)}
                  </text>
                </box>
              );
            })}
          </box>
        )})}
      </box>

      <box
        style={{
          width: "100%",
          paddingX: 1,
          backgroundColor: theme.bgAlt,
          justifyContent: "space-between",
          flexDirection: "row",
        }}
      >
        <text fg={theme.textDim}>
          {result.rowCount} rows | {result.duration}ms
        </text>
        <text fg={theme.textMuted}>
          {focused ? "q: editor" : ""}
          {focused && (hiddenColumnCount > 0 || hiddenRowCount > 0) ? " | " : ""}
          {hiddenColumnCount > 0 ? `${hiddenColumnCount} cols hidden` : ""}
          {hiddenColumnCount > 0 && hiddenRowCount > 0 ? " | " : ""}
          {hiddenRowCount > 0 ? `${hiddenRowCount} rows hidden` : ""}
        </text>
      </box>
    </box>
  );
}

function padRight(value: string, width: number) {
  if (value.length >= width) return value.slice(0, width);
  return value + " ".repeat(width - value.length);
}
