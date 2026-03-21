import { useKeyboard } from "@opentui/react";
import { useTheme } from "../../theme";
import { useUIStore } from "../../store/ui";
import { Dialog } from "./dialog";

const COMMON_SHORTCUTS = [
  { key: "?", desc: "Open this help" },
  { key: "Ctrl+K", desc: "Open command panel" },
  { key: "Tab", desc: "Switch panel focus" },
  { key: "/", desc: "Search schema" },
  { key: "Ctrl+T", desc: "New query tab" },
];

export function HelpDialog() {
  const theme = useTheme();
  const { closeDialog } = useUIStore();

  useKeyboard((key) => {
    if (key.name === "return" || key.name === "escape" || key.sequence === "?") {
      closeDialog();
      key.stopPropagation();
    }
  });

  return (
    <Dialog title="Help" width={58} height={14}>
      <box style={{ flexDirection: "column", gap: 1, flexGrow: 1 }}>
        <text fg={theme.textMuted}>
          Press `Ctrl+K` to see commands and actions available in the current context.
        </text>

        <box style={{ flexDirection: "column", paddingTop: 1, gap: 0 }}>
          {COMMON_SHORTCUTS.map((item) => (
            <box key={item.key} style={{ flexDirection: "row" }}>
              <box style={{ width: 12 }}>
                <text fg={theme.warning}>{item.key}</text>
              </box>
              <text fg={theme.text}>{item.desc}</text>
            </box>
          ))}
        </box>

        <box style={{ flexGrow: 1 }} />

        <box style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <text fg={theme.textMuted}>Press Enter or Esc to close.</text>
          <box
            style={{
              paddingX: 3,
              backgroundColor: theme.accent,
            }}
            onMouseUp={() => closeDialog()}
          >
            <text fg={theme.bg}>ok</text>
          </box>
        </box>
      </box>
    </Dialog>
  );
}
