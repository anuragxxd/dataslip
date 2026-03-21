import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useKeyboard } from "@opentui/react";
import { useTheme } from "../../theme";
import { useSchemaStore } from "../../store/schema";
import { useUIStore } from "../../store/ui";
import type { SchemaSearchItem, TreeNode } from "../../db/types";
import { truncate } from "../../utils/format";

interface FlatNode {
  node: TreeNode;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
}

function flattenTree(nodes: TreeNode[]): FlatNode[] {
  const result: FlatNode[] = [];

  function walk(nodeList: TreeNode[], depth: number) {
    for (const node of nodeList) {
      const hasChildren = (node.children && node.children.length > 0) ||
        ["schema", "table-group", "view-group", "table", "view", "index-group", "fk-group"].includes(node.type);
      result.push({
        node,
        depth,
        hasChildren,
        isExpanded: node.expanded || false,
      });
      if (node.expanded && node.children) {
        walk(node.children, depth + 1);
      }
    }
  }

  walk(nodes, 0);
  return result;
}

interface SchemaTreeProps {
  focused: boolean;
  height: number;
}

export function SchemaTree({ focused, height }: SchemaTreeProps) {
  const theme = useTheme();
  const { treeNodes, selectedNodeId, toggleNode, selectNode, openItem, isLoading } =
    useSchemaStore();
  const { activeDialog, setActivePanel, sidebarWidth } = useUIStore();

  const flatNodes = useMemo(() => flattenTree(treeNodes), [treeNodes]);
  const [cursorIndex, setCursorIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const visibleHeight = height - 2; // Account for border

  // Keep cursor in bounds
  useEffect(() => {
    if (cursorIndex >= flatNodes.length && flatNodes.length > 0) {
      setCursorIndex(flatNodes.length - 1);
    }
  }, [flatNodes.length]);

  // Sync cursor when selectedNodeId changes externally (search, FK jump)
  useEffect(() => {
    if (!selectedNodeId) return;
    const idx = flatNodes.findIndex((f) => f.node.id === selectedNodeId);
    if (idx !== -1 && idx !== cursorIndex) {
      setCursorIndex(idx);
      // Adjust scroll to center the selected node
      const targetScroll = Math.max(0, idx - Math.floor(visibleHeight / 2));
      const maxScroll = Math.max(0, flatNodes.length - visibleHeight);
      setScrollOffset(Math.min(targetScroll, maxScroll));
    }
  }, [selectedNodeId, flatNodes]);

  useEffect(() => {
    const maxScrollOffset = Math.max(0, flatNodes.length - visibleHeight);
    if (scrollOffset > maxScrollOffset) {
      setScrollOffset(maxScrollOffset);
    }
  }, [flatNodes.length, scrollOffset, visibleHeight]);

  const handleSelect = useCallback(
    (index: number) => {
      const flat = flatNodes[index];
      if (!flat) return;

      const { node } = flat;
      selectNode(node.id);

      const item = toSearchItem(node);
      if (item) {
        void openItem(item);
      }
    },
    [flatNodes, openItem, selectNode]
  );

  const handleToggle = useCallback(
    (index: number) => {
      const flat = flatNodes[index];
      if (!flat) return;
      toggleNode(flat.node.id);
    },
    [flatNodes]
  );

  useKeyboard(
    (key) => {
      if (activeDialog !== "none") return;
      if (!focused) return;

      if (key.name === "up" || key.name === "k") {
        const newIdx = Math.max(0, cursorIndex - 1);
        setCursorIndex(newIdx);
        if (newIdx < scrollOffset) setScrollOffset(newIdx);
      } else if (key.name === "down" || key.name === "j") {
        const newIdx = Math.min(flatNodes.length - 1, cursorIndex + 1);
        setCursorIndex(newIdx);
        if (newIdx >= scrollOffset + visibleHeight)
          setScrollOffset(newIdx - visibleHeight + 1);
      } else if (key.name === "return" || key.name === "l") {
        const flat = flatNodes[cursorIndex];
        if (flat?.hasChildren) {
          handleToggle(cursorIndex);
        }
        handleSelect(cursorIndex);
      } else if (key.name === "h") {
        // Collapse current node or go to parent
        const flat = flatNodes[cursorIndex];
        if (flat?.isExpanded) {
          handleToggle(cursorIndex);
        }
      } else if (key.name === "right") {
        const flat = flatNodes[cursorIndex];
        if (flat?.hasChildren && !flat.isExpanded) {
          handleToggle(cursorIndex);
        }
      } else if (key.name === "left") {
        const flat = flatNodes[cursorIndex];
        if (flat?.isExpanded) {
          handleToggle(cursorIndex);
        }
      }
    }
  );

  const visibleNodes = flatNodes.slice(
    scrollOffset,
    scrollOffset + visibleHeight
  );

  const getNodeColor = (type: string, isCursor: boolean): string => {
    if (isCursor) return theme.textBright;
    switch (type) {
      case "schema":
        return theme.accent;
      case "table-group":
      case "view-group":
      case "index-group":
      case "fk-group":
        return theme.textDim;
      case "table":
        return theme.text;
      case "view":
        return theme.accentAlt;
      case "column":
        return theme.textDim;
      default:
        return theme.text;
    }
  };

  return (
    <box
      title=" Schema "
      style={{
        flexDirection: "column",
        width: "100%",
        height: "100%",
        border: true,
        borderStyle: "rounded",
        borderColor: focused ? theme.borderFocused : theme.border,
        titleAlignment: "left",
        backgroundColor: theme.bg,
      }}
    >
      {isLoading && flatNodes.length === 0 ? (
        <text fg={theme.textDim}> Loading schemas...</text>
      ) : flatNodes.length === 0 ? (
        <text fg={theme.textDim}> No schemas found</text>
      ) : (
        visibleNodes.map((flat, visIdx) => {
          const actualIdx = scrollOffset + visIdx;
          const isCursor = actualIdx === cursorIndex;
          const isSelected = flat.node.id === selectedNodeId;

          const indent = "  ".repeat(flat.depth);
          const icon = getNodeIcon(flat);
          const labelColor = getNodeColor(flat.node.type, isCursor);
          const prefixWidth = indent.length + 2;
          const rowContentWidth = Math.max(1, sidebarWidth - 4);
          const labelWidth = Math.max(1, rowContentWidth - prefixWidth);
          const displayLabel = truncate(flat.node.label, labelWidth);

          return (
            <box
              key={flat.node.id}
              style={{
                flexDirection: "row",
                height: 1,
                backgroundColor: isCursor
                  ? theme.bgSelected
                  : isSelected
                    ? theme.bgHighlight
                    : "transparent",
                width: "100%",
                paddingX: 1,
              }}
              onMouseDown={() => {
                setActivePanel("sidebar");
                setCursorIndex(actualIdx);
                selectNode(flat.node.id);
              }}
              onMouseUp={() => {
                if (
                  flat.node.type === "schema" ||
                  flat.node.type === "table-group" ||
                  flat.node.type === "view-group" ||
                  flat.node.type === "index-group" ||
                  flat.node.type === "fk-group"
                ) {
                  handleToggle(actualIdx);
                  return;
                }

                handleSelect(actualIdx);
              }}
            >
              <text fg={theme.treeIndent}>{indent}</text>
              <text fg={flat.hasChildren ? theme.treeExpanded : theme.treeCollapsed}>
                {icon}{" "}
              </text>
              <text fg={labelColor}>{displayLabel}</text>
            </box>
          );
        })
      )}

      {flatNodes.length > visibleHeight && (
        <box style={{ position: "absolute", right: 0, bottom: 0 }}>
          <text fg={theme.textMuted}>
            {Math.round(
              (scrollOffset / Math.max(1, flatNodes.length - visibleHeight)) *
                100
            )}
            %
          </text>
        </box>
      )}
    </box>
  );
}

function toSearchItem(node: TreeNode): SchemaSearchItem | null {
  if (node.type === "schema") {
    return {
      nodeId: node.id,
      label: node.label,
      type: "schema",
      schema: node.label,
      searchText: "",
    };
  }

  if (node.type === "table" || node.type === "view") {
    const meta = node.meta as { schema?: string } | undefined;
    if (!meta?.schema) return null;
    return {
      nodeId: node.id,
      label: node.label,
      type: node.type,
      schema: meta.schema,
      table: node.label,
      searchText: "",
    };
  }

  if (node.type === "column" || node.type === "index" || node.type === "fk") {
    const parts = node.id.split(":");
    const [, schema, table, name] = parts;
    if (!schema || !table || !name) return null;
    return {
      nodeId: node.id,
      label: name,
      type: node.type,
      schema,
      table,
      searchText: "",
    };
  }

  return null;
}

function getNodeIcon(flat: FlatNode): string {
  if (flat.hasChildren) {
    return flat.isExpanded ? "▼" : "▶";
  }

  switch (flat.node.type) {
    case "column":
      return "·";
    case "index":
      return "◈";
    case "fk":
      return "→";
    default:
      return "·";
  }
}
