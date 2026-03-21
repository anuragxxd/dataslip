import React from "react";
import { useKeyboard } from "@opentui/react";
import { useTheme } from "../../theme";
import { useUIStore } from "../../store/ui";
import { Dialog } from "./dialog";

const KEYBINDS = [
  { section: "General" },
  { key: "Ctrl+K", desc: "Open command panel" },
  { key: "Tab", desc: "Switch between sidebar and data grid" },
  { key: "Esc", desc: "Go back / close dialog" },
  { key: "Ctrl+C", desc: "Exit DataSlip" },
  { key: "/", desc: "Search schemas, tables, columns" },
  { section: "Schema Tree (Sidebar)" },
  { key: "j/k or ↑/↓", desc: "Navigate up/down" },
  { key: "Enter/l/→", desc: "Expand node / open table" },
  { key: "h/←", desc: "Collapse node" },
  { section: "Data Grid" },
  { key: "h/j/k/l", desc: "Navigate cells (left/down/up/right)" },
  { key: "Tab", desc: "Switch focus between tree and grid" },
  { key: "Enter", desc: "Edit selected cell (tables with PK)" },
  { key: "n/p", desc: "Next/previous page" },
  { key: "PgDn/PgUp", desc: "Next/previous page" },
  { key: "r", desc: "Reload current table" },
  { key: "s", desc: "Sort by current column" },
  { key: "g/G", desc: "Go to first/last row" },
  { section: "Cell Editing" },
  { key: "Enter", desc: "Confirm edit (opens SQL preview)" },
  { key: "Esc", desc: "Cancel edit" },
  { key: "Ctrl+N", desc: "Toggle NULL value" },
  { section: "Query Editor" },
  { key: "q", desc: "Open query editor" },
  { key: "Ctrl+R", desc: "Run query" },
  { key: "Ctrl+Enter", desc: "Alternate run shortcut" },
  { key: "Esc", desc: "Close query editor" },
  { key: "Tab", desc: "Cycle focus: tree -> query -> results" },
  { section: "Query Results" },
  { key: "q", desc: "Focus query editor" },
  { key: "j/k or ↑/↓", desc: "Move between rows" },
  { key: "h/l or ←/→", desc: "Move between columns" },
  { key: "h/← on first col", desc: "Move focus back to query editor" },
  { key: "g/G", desc: "Go to first/last result row" },
  { key: "Tab", desc: "Go to next panel" },
  { section: "Connection Screen" },
  { key: "n", desc: "New connection" },
  { key: "e", desc: "Edit selected connection" },
  { key: "d", desc: "Delete selected connection" },
  { key: "Enter", desc: "Connect to selected" },
  { section: "Connection Form" },
  { key: "Tab/Shift+Tab", desc: "Next/previous field" },
  { key: "Enter", desc: "Next field / Save" },
  { key: "Ctrl+S", desc: "Save connection" },
  { key: "Ctrl+T", desc: "Test connection" },
  { key: "Cmd+V", desc: "Paste into field" },
  { section: "Command Panel (Ctrl+K)" },
  { key: "↑/↓", desc: "Navigate commands" },
  { key: "Enter", desc: "Execute command" },
  { key: "Type", desc: "Filter commands" },
  { key: "Esc", desc: "Close panel" },
];

export function HelpDialog() {
  const theme = useTheme();
  const { closeDialog } = useUIStore();

  useKeyboard((key) => {
    if (key.name === "escape" || key.name === "q" || key.sequence === "?") {
      closeDialog();
    }
  });

  return (
    <Dialog title="Keyboard Shortcuts" width={52} height={KEYBINDS.length + 4}>
      <box style={{ flexDirection: "column" }}>
        {KEYBINDS.map((item, i) => {
          if ("section" in item && item.section) {
            return (
              <box key={i} style={{ paddingTop: i > 0 ? 1 : 0 }}>
                <text fg={theme.accent}>{item.section}</text>
              </box>
            );
          }
          return (
            <box key={i} style={{ flexDirection: "row" }}>
              <box style={{ width: 18 }}>
                <text fg={theme.warning}>
                  {"  "}
                  {(item as any).key}
                </text>
              </box>
              <text fg={theme.text}>{(item as any).desc}</text>
            </box>
          );
        })}
      </box>
    </Dialog>
  );
}
