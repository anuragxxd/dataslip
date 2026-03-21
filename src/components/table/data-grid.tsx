import React, { useMemo } from "react";
import { useKeyboard } from "@opentui/react";
import { useTheme } from "../../theme";
import { useTableDataStore } from "../../store/table-data";
import { useUIStore } from "../../store/ui";
import { formatCellValue, formatRowCount, getTypeColor } from "../../utils/format";
import { KeybindBar } from "../ui/keybind-bar";

interface DataGridProps {
  focused: boolean;
  width: number;
  height: number;
}

type TypeColorKey =
  | "typeString"
  | "typeNumber"
  | "typeBool"
  | "typeNull"
  | "typeDate"
  | "typeJson";

// Compute column widths based on data
function computeColumnWidths(
  columns: { name: string; type: string }[],
  rows: Record<string, unknown>[],
): number[] {
  if (columns.length === 0) return [];

  // Start with header widths
  const widths = columns.map((col) =>
    Math.max(col.name.length, col.type.length + 2)
  );

  // Expand based on data (sample first 20 rows)
  const sampleRows = rows.slice(0, 20);
  for (const row of sampleRows) {
    for (let i = 0; i < columns.length; i++) {
      const val = formatCellValue(row[columns[i].name], 40);
      widths[i] = Math.max(widths[i], val.length);
    }
  }

  // Cap individual columns
  return widths.map((w) => Math.min(Math.max(w, 4), 40));
}

export function DataGrid({ focused, width, height }: DataGridProps) {
  const theme = useTheme();
  const { activeDialog, openDialog } = useUIStore();
  const {
    currentSchema,
    result,
    totalRows,
    page,
    pageSize,
    selectedRow,
    selectedCol,
    scrollOffsetX,
    orderBy,
    orderDir,
    isLoading,
    error,
    currentTable,
    currentTableType,
    primaryKeyColumns,
    edit,
    moveSelection,
    reloadCurrent,
    setPage,
    setSort,
    setScrollOffsetX,
    startEdit,
    setEditValue,
    toggleEditNull,
    cancelEdit,
    prepareEditConfirm,
  } = useTableDataStore();

  const columns = result?.columns || [];
  const rows = result?.rows || [];
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const isEditable =
    currentTableType === "table" && primaryKeyColumns.length > 0;

  const colWidths = useMemo(
    () => computeColumnWidths(columns, rows),
    [columns, rows]
  );

  // Calculate which columns are visible
  const visibleColumns = useMemo(() => {
    let usedWidth = 0;
    const visible: { index: number; width: number }[] = [];
    for (let i = scrollOffsetX; i < columns.length; i++) {
      const w = colWidths[i] + 1; // +1 for separator
      if (usedWidth + w > width - 4) {
        // Add one more partial column
        visible.push({ index: i, width: Math.max(4, width - 4 - usedWidth) });
        break;
      }
      visible.push({ index: i, width: colWidths[i] });
      usedWidth += w;
    }
    return visible;
  }, [columns, colWidths, scrollOffsetX, width]);

  const gridHeight = height - 5; // header(2) + pagination(1) + border(2)

  useKeyboard(
    (key) => {
      if (activeDialog !== "none") return;
      if (!focused) return;

      // ── Edit mode keybindings ──
      if (edit.editMode) {
        if (key.name === "escape") {
          cancelEdit();
          key.stopPropagation();
          return;
        }
        if (key.ctrl && key.name === "n") {
          toggleEditNull();
          key.stopPropagation();
          return;
        }
        // All other keys pass through to the <input>
        return;
      }

      // ── Navigate mode keybindings ──
      if (key.name === "return") {
        if (startEdit()) {
          key.stopPropagation();
        }
        return;
      }

      if (key.name === "up" || key.name === "k") {
        moveSelection(-1, 0);
      } else if (key.name === "down" || key.name === "j") {
        moveSelection(1, 0);
      } else if (key.name === "left" || key.name === "h") {
        if (selectedCol > 0) {
          moveSelection(0, -1);
          if (selectedCol - 1 < scrollOffsetX) {
            setScrollOffsetX(Math.max(0, selectedCol - 1));
          }
        }
      } else if (key.name === "right" || key.name === "l") {
        if (selectedCol < columns.length - 1) {
          moveSelection(0, 1);
          const lastVisibleIdx =
            visibleColumns.length > 0
              ? visibleColumns[visibleColumns.length - 1].index
              : 0;
          if (selectedCol + 1 > lastVisibleIdx) {
            setScrollOffsetX(
              Math.min(columns.length - 1, scrollOffsetX + 1)
            );
          }
        }
      } else if (key.sequence === "]") {
        // Next page
        if (page < totalPages) void setPage(page + 1);
      } else if (key.sequence === "[") {
        // Previous page
        if (page > 1) void setPage(page - 1);
      } else if (key.name === "n" || key.name === "pagedown") {
        if (page < totalPages) {
          void setPage(page + 1);
        }
      } else if (key.name === "p" || key.name === "pageup") {
        if (page > 1) {
          void setPage(page - 1);
        }
      } else if (key.name === "r") {
        if (currentSchema && currentTable) {
          void reloadCurrent();
        }
      } else if (key.name === "s") {
        // Sort by current column
        if (columns[selectedCol]) {
          void setSort(columns[selectedCol].name);
        }
      } else if (key.name === "home" || key.name === "g") {
        // Go to first row
        moveSelection(-selectedRow, 0);
      } else if (key.name === "end" || key.name === "G") {
        // Go to last row
        moveSelection(rows.length - 1 - selectedRow, 0);
      }
    }
  );

  // Handle edit input submit (Enter in the <input>)
  const handleEditSubmit = () => {
    const confirmData = prepareEditConfirm();
    if (confirmData) {
      openDialog("edit-confirm", confirmData);
    }
  };

  if (!currentTable) {
    return (
      <box
        title=" Data "
        style={{
          width: "100%",
          height: "100%",
          border: true,
          borderStyle: "rounded",
          borderColor: focused ? theme.borderFocused : theme.border,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: theme.bg,
        }}
      >
        <text fg={theme.textDim}>Select a table from the sidebar</text>
      </box>
    );
  }

  if (isLoading && rows.length === 0) {
    return (
      <box
        title={` ${currentTable} `}
        style={{
          width: "100%",
          height: "100%",
          border: true,
          borderStyle: "rounded",
          borderColor: focused ? theme.borderFocused : theme.border,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: theme.bg,
        }}
      >
        <text fg={theme.warning}>Loading data...</text>
      </box>
    );
  }

  if (error) {
    return (
      <box
        title={` ${currentTable} `}
        style={{
          width: "100%",
          height: "100%",
          border: true,
          borderStyle: "rounded",
          borderColor: theme.error,
          padding: 1,
          backgroundColor: theme.bg,
        }}
      >
        <text fg={theme.error}>Error: {error}</text>
      </box>
    );
  }

  // Build keybind hints based on current state
  const keybindHints = edit.editMode
    ? [
        { key: "Enter", label: "Save" },
        { key: "Esc", label: "Cancel" },
        { key: "Ctrl+N", label: edit.editIsNull ? "Unset NULL" : "Set NULL" },
      ]
    : [
        { key: "hjkl", label: "Navigate" },
        ...(isEditable ? [{ key: "Enter", label: "Edit cell" }] : []),
        { key: "n/p", label: "Page" },
        { key: "r", label: "Reload" },
        { key: "s", label: "Sort" },
        { key: "g/G", label: "First/Last" },
      ];

  return (
    <box
      title={` ${currentTable} (${formatRowCount(totalRows)} rows) `}
      style={{
        width: "100%",
        height: "100%",
        flexDirection: "column",
        border: true,
        borderStyle: "rounded",
        borderColor: focused
          ? edit.editMode
            ? theme.warning
            : theme.borderFocused
          : theme.border,
        titleAlignment: "left",
        backgroundColor: theme.bg,
      }}
    >
      {/* Column headers */}
      <box
        style={{
          flexDirection: "row",
          backgroundColor: theme.gridHeaderBg,
          width: "100%",
        }}
      >
        {visibleColumns.map(({ index, width: colW }) => {
          const col = columns[index];
          const isSelectedCol = index === selectedCol;
          const sortIndicator =
            orderBy === col.name ? (orderDir === "ASC" ? " ↑" : " ↓") : "";

          return (
            <box
              key={col.name}
              style={{
                width: colW + 1,
                paddingX: 0,
              }}
            >
              <text
                fg={isSelectedCol ? theme.accent : theme.gridHeader}
              >
                {" "}{padRight(col.name + sortIndicator, colW)}
              </text>
            </box>
          );
        })}
      </box>

      {/* Type hints row */}
      <box
        style={{
          flexDirection: "row",
          backgroundColor: theme.gridHeaderBg,
          width: "100%",
        }}
      >
        {visibleColumns.map(({ index, width: colW }) => {
          const col = columns[index];
          const typeThemeKey = getTypeColor(col.type) as TypeColorKey;
          const typeColor = theme[typeThemeKey] || theme.textDim;

          return (
            <box key={`type-${col.name}`} style={{ width: colW + 1 }}>
              <text fg={typeColor}>
                {" "}{padRight(col.type, colW)}
              </text>
            </box>
          );
        })}
      </box>

      {/* Separator */}
      <box style={{ width: "100%", height: 1 }}>
        <text fg={theme.gridBorder}>
          {"─".repeat(width - 2)}
        </text>
      </box>

      {/* Data rows */}
      <box style={{ flexDirection: "column", flexGrow: 1 }}>
        {rows.slice(0, gridHeight).map((row, rowIdx) => {
          const isSelectedRow = rowIdx === selectedRow;
          return (
            <box
              key={rowIdx}
              style={{
                flexDirection: "row",
                backgroundColor:
                  isSelectedRow
                    ? theme.bgHighlight
                    : rowIdx % 2 === 1
                      ? theme.gridRowAlt
                      : "transparent",
                width: "100%",
              }}
            >
              {visibleColumns.map(({ index, width: colW }) => {
                const col = columns[index];
                const value = row[col.name];
                const isSelectedCell =
                  isSelectedRow && index === selectedCol;
                const isEditingThis =
                  edit.editMode && isSelectedCell;

                if (isEditingThis) {
                  // Render inline input for the cell being edited
                  return (
                    <box
                      key={`${rowIdx}-${col.name}`}
                      style={{
                        width: colW + 1,
                        backgroundColor: theme.gridCellSelected,
                      }}
                    >
                      {edit.editIsNull ? (
                        <text fg={theme.typeNull}>
                          {" "}{padRight("NULL", colW)}
                        </text>
                      ) : (
                        <input
                          value={edit.editValue}
                          focused={activeDialog === "none"}
                          onInput={(val: string) => setEditValue(val)}
                          onSubmit={() => handleEditSubmit()}
                          width={colW}
                          style={{
                            backgroundColor: theme.gridCellSelected,
                            focusedBackgroundColor: theme.gridCellSelected,
                            textColor: theme.textBright,
                            focusedTextColor: theme.textBright,
                            cursorColor: theme.accent,
                          }}
                        />
                      )}
                    </box>
                  );
                }

                const formatted = formatCellValue(value, colW);
                const isNull = value === null || value === undefined;

                return (
                  <box
                    key={`${rowIdx}-${col.name}`}
                    style={{
                      width: colW + 1,
                      backgroundColor: isSelectedCell
                        ? theme.gridCellSelected
                        : "transparent",
                    }}
                  >
                    <text
                      fg={
                        isNull
                          ? theme.typeNull
                          : isSelectedCell
                            ? theme.textBright
                            : theme.text
                      }
                    >
                      {" "}{padRight(formatted, colW)}
                    </text>
                  </box>
                );
              })}
            </box>
          );
        })}
      </box>

      {/* Pagination / keybind bar */}
      <box
        style={{
          flexDirection: "row",
          width: "100%",
          paddingX: 1,
          backgroundColor: edit.editMode ? theme.bgHighlight : theme.bgAlt,
          justifyContent: "space-between",
        }}
      >
        <KeybindBar bindings={keybindHints} />
        <text fg={theme.textDim}>
          {edit.editMode ? "EDIT" : `Page ${page}/${totalPages} | n/p page | r reload`}
        </text>
      </box>
    </box>
  );
}

function padRight(str: string, width: number): string {
  if (str.length >= width) return str.slice(0, width);
  return str + " ".repeat(width - str.length);
}
