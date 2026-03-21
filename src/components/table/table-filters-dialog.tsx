import React, { useEffect, useMemo, useRef, useState } from "react";
import type { InputRenderable } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useTheme } from "../../theme";
import { useUIStore } from "../../store/ui";
import { useTableDataStore } from "../../store/table-data";
import { buildTableQuerySql } from "../../db/query";
import type { TableFilterClause } from "../../db/types";
import {
  formatFilterClauseLabel,
  getFilterOperators,
  isTextLikeType,
  operatorNeedsValue,
  validateValueForType,
} from "../../utils/sql";
import { generateId, truncate } from "../../utils/format";
import { showToast } from "../ui/toast";
import { Dialog } from "../ui/dialog";
import { KeybindBar } from "../ui/keybind-bar";

type Mode = "list" | "search" | "filter";

interface FiltersDialogData {
  workspaceId: string;
  initialQuickSearch?: string;
  initialFilters?: TableFilterClause[];
}

export function TableFiltersDialog() {
  const theme = useTheme();
  const { dialogData, closeDialog, openDialog } = useUIStore();
  const data = (dialogData || {}) as FiltersDialogData;
  const workspaceId = data.workspaceId;
  const store = useTableDataStore();
  const ws = workspaceId ? store.getWorkspaceState(workspaceId) : null;
  const inputRef = useRef<InputRenderable | null>(null);

  const columns = ws?.result?.columns || [];
  const textColumns = useMemo(
    () => columns.filter((column) => isTextLikeType(column.type)),
    [columns]
  );

  const [quickSearchDraft, setQuickSearchDraft] = useState(
    data.initialQuickSearch ?? ws?.quickSearch ?? ""
  );
  const [workingFilters, setWorkingFilters] = useState<TableFilterClause[]>(
    () => (data.initialFilters ?? ws?.filters ?? []).map((filter) => ({ ...filter }))
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("list");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [focusField, setFocusField] = useState(0);
  const [draft, setDraft] = useState<TableFilterClause>(() => createDraft(columns, ws?.selectedCol || 0));

  useEffect(() => {
    if (mode === "search") {
      setTimeout(() => {
        const input = inputRef.current;
        if (!input || input.isDestroyed) return;
        input.focus();
      }, 1);
      return;
    }

    if (mode === "filter" && operatorNeedsValue(draft.operator) && focusField === 2) {
      setTimeout(() => {
        const input = inputRef.current;
        if (!input || input.isDestroyed) return;
        input.focus();
      }, 1);
    }
  }, [draft.operator, focusField, mode]);

  const operatorOptions = useMemo(
    () => getFilterOperators(draft.columnType),
    [draft.columnType]
  );

  const searchColumnsLabel = textColumns.length > 0
    ? truncate(textColumns.map((column) => column.name).join(", "), 54)
    : "No searchable text columns detected";

  const openSearchEditor = () => {
    setMode("search");
  };

  const openFilterEditor = (index?: number) => {
    if (columns.length === 0) {
      showToast("No columns available for filters", "warning");
      return;
    }

    if (typeof index === "number") {
      const existing = workingFilters[index];
      if (!existing) return;
      setDraft({ ...existing });
      setEditingIndex(index);
    } else {
      setDraft(createDraft(columns, ws?.selectedCol || 0));
      setEditingIndex(null);
    }

    setFocusField(0);
    setMode("filter");
  };

  const cycleColumn = (delta: number) => {
    if (columns.length === 0) return;
    const currentIndex = Math.max(
      0,
      columns.findIndex((column) => column.name === draft.column)
    );
    const nextIndex = (currentIndex + delta + columns.length) % columns.length;
    const nextColumn = columns[nextIndex];
    const nextOperators = getFilterOperators(nextColumn.type);
    setDraft((current) => ({
      ...current,
      column: nextColumn.name,
      columnType: nextColumn.type,
      operator: nextOperators.includes(current.operator) ? current.operator : nextOperators[0],
    }));
  };

  const cycleOperator = (delta: number) => {
    if (operatorOptions.length === 0) return;
    const currentIndex = Math.max(0, operatorOptions.indexOf(draft.operator));
    const nextIndex = (currentIndex + delta + operatorOptions.length) % operatorOptions.length;
    const nextOperator = operatorOptions[nextIndex];
    setDraft((current) => ({
      ...current,
      operator: nextOperator,
      value: operatorNeedsValue(nextOperator) ? current.value || "" : "",
    }));
  };

  const saveDraft = () => {
    if (!draft.column) {
      showToast("Choose a column first", "warning");
      return;
    }

    if (operatorNeedsValue(draft.operator)) {
      const value = draft.value || "";
      if (!value.trim()) {
        showToast("Enter a filter value", "warning");
        return;
      }

      if (draft.operator !== "contains" && draft.operator !== "starts_with") {
        const validationError = validateValueForType(value, draft.columnType, false);
        if (validationError) {
          showToast(validationError, "error");
          return;
        }
      }
    }

    const normalized: TableFilterClause = {
      ...draft,
      value: operatorNeedsValue(draft.operator) ? (draft.value || "") : undefined,
    };

    const next = [...workingFilters];
    if (editingIndex === null) {
      next.push(normalized);
      setSelectedIndex(next.length - 1);
    } else {
      next[editingIndex] = normalized;
      setSelectedIndex(editingIndex);
    }

    setWorkingFilters(next);
    setEditingIndex(null);
    setMode("list");
  };

  const removeSelected = () => {
    if (workingFilters.length === 0) return;
    const next = workingFilters.filter((_, index) => index !== selectedIndex);
    setWorkingFilters(next);
    setSelectedIndex(Math.max(0, Math.min(selectedIndex, next.length - 1)));
  };

  const openPreview = () => {
    if (!workspaceId || !ws?.currentSchema || !ws.currentTable || !ws.result) {
      closeDialog();
      return;
    }

    if (quickSearchDraft.trim() && textColumns.length === 0) {
      showToast("This table has no searchable text columns", "warning");
      return;
    }

    const sql = buildTableQuerySql(
      ws.currentSchema,
      ws.currentTable,
      ws.result.columns,
      {
        page: 1,
        pageSize: ws.pageSize,
        orderBy: ws.orderBy || undefined,
        orderDir: ws.orderDir,
        quickSearch: quickSearchDraft.trim(),
        filters: workingFilters,
      }
    );

    openDialog("table-filter-preview", {
      workspaceId,
      quickSearch: quickSearchDraft.trim(),
      filters: workingFilters,
      sql,
    });
  };

  useKeyboard((key) => {
    if (mode === "list") {
      if (key.name === "escape") {
        closeDialog();
        key.stopPropagation();
        return;
      }

      if (key.name === "down" || key.name === "j") {
        if (workingFilters.length > 0) {
          setSelectedIndex((prev) => Math.min(workingFilters.length - 1, prev + 1));
        }
        key.stopPropagation();
        return;
      }

      if (key.name === "up" || key.name === "k") {
        if (workingFilters.length > 0) {
          setSelectedIndex((prev) => Math.max(0, prev - 1));
        }
        key.stopPropagation();
        return;
      }

      if (key.sequence === "/") {
        openSearchEditor();
        key.stopPropagation();
        return;
      }

      if (key.name === "a") {
        openFilterEditor();
        key.stopPropagation();
        return;
      }

      if (key.name === "e") {
        openFilterEditor(selectedIndex);
        key.stopPropagation();
        return;
      }

      if (key.name === "d" || key.name === "backspace") {
        removeSelected();
        key.stopPropagation();
        return;
      }

      if (key.name === "x") {
        setQuickSearchDraft("");
        setWorkingFilters([]);
        setSelectedIndex(0);
        key.stopPropagation();
        return;
      }

      if (key.ctrl && key.name === "s") {
        openPreview();
        key.stopPropagation();
        return;
      }

      if (key.name === "return") {
        openPreview();
        key.stopPropagation();
        return;
      }

      return;
    }

    if (mode === "search") {
      if (key.name === "escape") {
        setMode("list");
        key.stopPropagation();
        return;
      }

      if (key.name === "return") {
        if (quickSearchDraft.trim() && textColumns.length === 0) {
          showToast("This table has no searchable text columns", "warning");
          return;
        }
        setMode("list");
        key.stopPropagation();
      }
      return;
    }

    if (key.name === "escape") {
      setMode("list");
      setEditingIndex(null);
      key.stopPropagation();
      return;
    }

    if (key.name === "tab") {
      const lastField = operatorNeedsValue(draft.operator) ? 2 : 1;
      setFocusField((prev) => (prev >= lastField ? 0 : prev + 1));
      key.stopPropagation();
      return;
    }

    if (focusField === 0 && (key.name === "left" || key.name === "h")) {
      cycleColumn(-1);
      key.stopPropagation();
      return;
    }

    if (focusField === 0 && (key.name === "right" || key.name === "l")) {
      cycleColumn(1);
      key.stopPropagation();
      return;
    }

    if (focusField === 1 && (key.name === "left" || key.name === "h")) {
      cycleOperator(-1);
      key.stopPropagation();
      return;
    }

    if (focusField === 1 && (key.name === "right" || key.name === "l")) {
      cycleOperator(1);
      key.stopPropagation();
      return;
    }

    if ((key.ctrl && key.name === "s") || key.name === "return") {
      saveDraft();
      key.stopPropagation();
    }
  });

  if (!workspaceId || !ws) return null;

  const footerBindings =
    mode === "list"
      ? [
          { key: "/", label: "Search" },
          { key: "a", label: "Add" },
          { key: "e", label: "Edit" },
          { key: "d", label: "Delete" },
          { key: "Enter", label: "Preview" },
          { key: "Esc", label: "Close" },
        ]
      : mode === "search"
        ? [
            { key: "Enter", label: "Save search" },
            { key: "Esc", label: "Back" },
          ]
        : [
            { key: "Tab", label: "Next field" },
            { key: "h/l", label: "Change" },
            { key: "Enter", label: "Save filter" },
            { key: "Esc", label: "Back" },
          ];

  return (
    <Dialog title={`Filters: ${ws.currentTable || "Table"}`} width={70} height={18}>
      <box style={{ flexDirection: "column", gap: 1, flexGrow: 1 }}>
        {mode === "list" ? (
          <>
            <text fg={theme.textDim}>
              Search: {quickSearchDraft ? `"${truncate(quickSearchDraft, 48)}"` : "none"}
            </text>
            <text fg={theme.textMuted}>Text columns: {searchColumnsLabel}</text>

            <box style={{ flexDirection: "column", flexGrow: 1 }}>
              {workingFilters.length === 0 ? (
                <text fg={theme.textMuted}>No structured filters yet. Press [a] to add one.</text>
              ) : (
                workingFilters.map((filter, index) => {
                  const selected = index === selectedIndex;
                  return (
                    <box
                      key={filter.id}
                      style={{
                        flexDirection: "row",
                        backgroundColor: selected ? theme.bgSelected : "transparent",
                        paddingX: 1,
                      }}
                    >
                      <text fg={selected ? theme.accent : theme.textDim}>
                        {selected ? ">" : " "}{" "}
                      </text>
                      <text fg={selected ? theme.textBright : theme.text}>
                        {truncate(formatFilterClauseLabel(filter), 60)}
                      </text>
                    </box>
                  );
                })
              )}
            </box>

            <text fg={theme.textMuted}>Preview shows the exact SELECT that will run for page 1.</text>
          </>
        ) : mode === "search" ? (
          <>
            <input
              ref={(value) => {
                inputRef.current = value;
              }}
              value={quickSearchDraft}
              placeholder="Search text columns"
              onInput={(value: string) => setQuickSearchDraft(value)}
              focusedBackgroundColor={theme.bgHighlight}
              textColor={theme.textBright}
              focusedTextColor={theme.textBright}
              cursorColor={theme.accent}
            />
            <text fg={theme.textDim}>Searches text-like columns only</text>
            <text fg={theme.textMuted}>{searchColumnsLabel}</text>
          </>
        ) : (
          <box style={{ flexDirection: "column", gap: 1, flexGrow: 1 }}>
            <box style={{ flexDirection: "row" }}>
              <box style={{ width: 12 }}>
                <text fg={focusField === 0 ? theme.accent : theme.textDim}>Column</text>
              </box>
              <text fg={focusField === 0 ? theme.textBright : theme.text}>{draft.column || "—"}</text>
            </box>
            <box style={{ flexDirection: "row" }}>
              <box style={{ width: 12 }}>
                <text fg={focusField === 1 ? theme.accent : theme.textDim}>Operator</text>
              </box>
              <text fg={focusField === 1 ? theme.textBright : theme.text}>{draft.operator}</text>
            </box>
            <box style={{ flexDirection: "row" }}>
              <box style={{ width: 12 }}>
                <text fg={focusField === 2 ? theme.accent : theme.textDim}>Value</text>
              </box>
              {operatorNeedsValue(draft.operator) ? (
                <input
                  ref={(value) => {
                    inputRef.current = value;
                  }}
                  value={draft.value || ""}
                  placeholder="Enter value"
                  focused={focusField === 2}
                  onInput={(value: string) => setDraft((current) => ({ ...current, value }))}
                  onSubmit={() => saveDraft()}
                  focusedBackgroundColor={theme.bgHighlight}
                  textColor={theme.textBright}
                  focusedTextColor={theme.textBright}
                  cursorColor={theme.accent}
                  style={{ flexGrow: 1 }}
                />
              ) : (
                <text fg={theme.textMuted}>No value needed</text>
              )}
            </box>
            <text fg={theme.textMuted}>Enter saves this filter back to the list.</text>
          </box>
        )}

        <KeybindBar bindings={footerBindings} />
      </box>
    </Dialog>
  );
}

function createDraft(
  columns: Array<{ name: string; type: string }>,
  selectedCol: number
): TableFilterClause {
  const fallback = columns[selectedCol] || columns[0] || { name: "", type: "text" };
  const operator = getFilterOperators(fallback.type)[0];
  return {
    id: generateId(),
    column: fallback.name,
    columnType: fallback.type,
    operator,
    value: "",
  };
}
