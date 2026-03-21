import React, { useState, useCallback, useMemo } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { useTheme } from "../../theme";
import { useUIStore } from "../../store/ui";
import { useWorkspaceStore } from "../../store/workspaces";
import {
  closeWorkspaceWithUi,
  openBlankQueryWorkspace,
} from "../../utils/workspace-actions";
import type { Dialog } from "../../store/ui";

interface CommandItem {
  id: string;
  label: string;
  description: string;
  category: string;
  shortcut?: string;
  action: () => void;
}

function getCommands(
  openDialog: (dialog: Dialog, data?: any) => void,
  closeDialog: () => void,
  screen: string,
): CommandItem[] {
  const commands: CommandItem[] = [
    // --- Appearance ---
    {
      id: "theme",
      label: "Switch Theme",
      description: "Change the color theme",
      category: "Appearance",
      shortcut: "t",
      action: () => openDialog("theme-picker"),
    },

    // --- Navigation ---
    {
      id: "schema-search",
      label: "Search Schema",
      description: "Find schemas, tables, views, or columns",
      category: "Navigation",
      shortcut: "/",
      action: () => openDialog("schema-search"),
    },

    // --- Help ---
    {
      id: "help",
      label: "Keyboard Shortcuts",
      description: "Show all keybindings",
      category: "Help",
      shortcut: "?",
      action: () => openDialog("help"),
    },

    // --- Session ---
    {
      id: "new-connection",
      label: "New Connection",
      description: "Create a new database connection",
      category: "Connections",
      shortcut: "n",
      action: () => openDialog("connection-form"),
    },

    // --- System ---
    {
      id: "quit",
      label: "Quit DataSlip",
      description: "Exit the application",
      category: "System",
      shortcut: "Ctrl+C",
      action: () => openDialog("confirm-quit"),
    },
  ];

  // Add screen-specific commands
  if (screen === "main") {
    commands.push(
      {
        id: "disconnect",
        label: "Disconnect",
        description: "Disconnect from the current database",
        category: "Connections",
        shortcut: "Esc",
        action: () => {
          openDialog("confirm-disconnect");
        },
      },
      {
        id: "new-query-tab",
        label: "New Query Tab",
        description: "Open a new blank query editor tab",
        category: "Tabs",
        shortcut: "Ctrl+T",
        action: () => {
          closeDialog();
          openBlankQueryWorkspace();
        },
      },
      {
        id: "close-tab",
        label: "Close Tab",
        description: "Close the current tab",
        category: "Tabs",
        shortcut: "Ctrl+W",
        action: () => {
          closeDialog();
          const ws = useWorkspaceStore.getState().getActiveWorkspace();
          if (ws) {
            closeWorkspaceWithUi(ws.id);
          }
        },
      },
      {
        id: "next-tab",
        label: "Next Tab",
        description: "Switch to the next tab",
        category: "Tabs",
        shortcut: "Ctrl+N",
        action: () => {
          closeDialog();
          useWorkspaceStore.getState().nextWorkspace();
        },
      },
      {
        id: "prev-tab",
        label: "Previous Tab",
        description: "Switch to the previous tab",
        category: "Tabs",
        shortcut: "Ctrl+P",
        action: () => {
          closeDialog();
          useWorkspaceStore.getState().prevWorkspace();
        },
      }
    );
  }

  return commands;
}

export function CommandPanel() {
  const theme = useTheme();
  const { width: termWidth, height: termHeight } = useTerminalDimensions();
  const { openDialog, closeDialog, screen } = useUIStore();

  const [filter, setFilter] = useState("");
  const [cursorIndex, setCursorIndex] = useState(0);

  const allCommands = useMemo(
    () => getCommands(openDialog, closeDialog, screen),
    [openDialog, closeDialog, screen]
  );

  const filteredCommands = useMemo(() => {
    if (!filter) return allCommands;
    const lower = filter.toLowerCase();
    return allCommands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(lower) ||
        cmd.description.toLowerCase().includes(lower) ||
        cmd.category.toLowerCase().includes(lower)
    );
  }, [allCommands, filter]);

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    for (const cmd of filteredCommands) {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category].push(cmd);
    }
    return groups;
  }, [filteredCommands]);

  // Get navigable command indices only
  const commandCount = filteredCommands.length;

  const handleSelect = useCallback(() => {
    const cmd = filteredCommands[cursorIndex];
    if (cmd) {
      closeDialog();
      // Use setTimeout to let the dialog close before opening the next one
      setTimeout(() => cmd.action(), 0);
    }
  }, [filteredCommands, cursorIndex, closeDialog]);

  useKeyboard((key) => {
    if (key.name === "escape") {
      closeDialog();
    } else if (key.name === "return") {
      handleSelect();
    } else if (key.name === "up" || (key.ctrl && key.name === "p")) {
      setCursorIndex((prev) => Math.max(0, prev - 1));
    } else if (key.name === "down" || (key.ctrl && key.name === "n")) {
      setCursorIndex((prev) => Math.min(commandCount - 1, prev + 1));
    } else if (key.name === "backspace") {
      setFilter((prev) => prev.slice(0, -1));
      setCursorIndex(0);
    } else if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
      setFilter((prev) => prev + key.sequence);
      setCursorIndex(0);
    }
    key.stopPropagation();
  });

  const panelWidth = Math.min(50, termWidth - 6);
  const maxVisibleItems = Math.min(commandCount + Object.keys(grouped).length + 3, termHeight - 8);
  const panelHeight = Math.max(8, maxVisibleItems + 4);

  return (
    <box
      style={{
        position: "absolute",
        left: Math.floor((termWidth - panelWidth) / 2),
        top: Math.max(1, Math.floor(termHeight * 0.2)),
        width: panelWidth,
        height: panelHeight,
        backgroundColor: theme.bgAlt,
        border: true,
        borderStyle: "rounded",
        borderColor: theme.accent,
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Search input */}
      <box
        style={{
          width: "100%",
          paddingX: 1,
          height: 1,
          flexDirection: "row",
        }}
      >
        <text fg={theme.accent}>{">"} </text>
        <text fg={filter ? theme.textBright : theme.textMuted}>
          {filter || "Type to search commands..."}
        </text>
      </box>

      {/* Separator */}
      <box style={{ width: "100%", height: 1, paddingX: 0 }}>
        <text fg={theme.border}>
          {"─".repeat(panelWidth - 2)}
        </text>
      </box>

      {/* Command list */}
      <box style={{ flexDirection: "column", flexGrow: 1, paddingX: 0 }}>
        {(() => {
          let cmdIdx = 0;
          const rows: React.ReactNode[] = [];

          for (const [category, cmds] of Object.entries(grouped)) {
            // Category header
            rows.push(
              <box key={`cat-${category}`} style={{ paddingX: 1, height: 1 }}>
                <text fg={theme.textDim}>{category}</text>
              </box>
            );

            for (const cmd of cmds) {
              const isCursor = cmdIdx === cursorIndex;
              cmdIdx++;

              rows.push(
                <box
                  key={cmd.id}
                  style={{
                    flexDirection: "row",
                    paddingX: 1,
                    height: 1,
                    backgroundColor: isCursor ? theme.bgSelected : "transparent",
                    width: "100%",
                    justifyContent: "space-between",
                  }}
                >
                  <box style={{ flexDirection: "row", flexShrink: 1 }}>
                    <text fg={isCursor ? theme.accent : theme.textDim}>
                      {isCursor ? ">" : " "}{" "}
                    </text>
                    <text fg={isCursor ? theme.textBright : theme.text}>
                      {cmd.label}
                    </text>
                  </box>
                  {cmd.shortcut && (
                    <text fg={theme.textMuted}>{cmd.shortcut}</text>
                  )}
                </box>
              );
            }
          }

          if (rows.length === 0) {
            rows.push(
              <box key="empty" style={{ paddingX: 1, paddingY: 1 }}>
                <text fg={theme.textDim}>No matching commands</text>
              </box>
            );
          }

          return rows;
        })()}
      </box>

      {/* Footer */}
      <box
        style={{
          width: "100%",
          height: 1,
          paddingX: 1,
          flexDirection: "row",
          gap: 2,
          backgroundColor: theme.bg,
        }}
      >
        <box style={{ flexDirection: "row" }}>
          <text fg={theme.accent}>↑↓</text>
          <text fg={theme.textDim}> Navigate</text>
        </box>
        <box style={{ flexDirection: "row" }}>
          <text fg={theme.accent}>Enter</text>
          <text fg={theme.textDim}> Select</text>
        </box>
        <box style={{ flexDirection: "row" }}>
          <text fg={theme.accent}>Esc</text>
          <text fg={theme.textDim}> Close</text>
        </box>
      </box>
    </box>
  );
}
