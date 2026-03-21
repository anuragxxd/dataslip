import React from "react";
import { useTheme } from "../../theme";
import { useUIStore } from "../../store/ui";
import { KeybindBar } from "../ui/keybind-bar";
import { QueryEditor } from "./query-editor";
import { QueryResults } from "./query-results";

interface QueryPanelProps {
  width: number;
  height: number;
}

export function QueryPanel({ width, height }: QueryPanelProps) {
  const theme = useTheme();
  const { activePanel, activeDialog } = useUIStore();
  const queryFocused = activePanel === "query" && activeDialog === "none";
  const resultsFocused = activePanel === "query-results" && activeDialog === "none";
  const editorHeight = Math.max(8, Math.min(12, Math.floor(height * 0.35)));
  const resultsHeight = Math.max(8, height - editorHeight - 1);

  return (
    <box style={{ width: "100%", height: "100%", flexDirection: "column", gap: 1 }}>
      <box
        title=" Query "
        style={{
          width: "100%",
          height: editorHeight,
          border: true,
          borderStyle: "rounded",
          borderColor: queryFocused ? theme.borderFocused : theme.border,
          backgroundColor: theme.bg,
          flexDirection: "column",
          paddingX: 1,
        }}
      >
        <QueryEditor focused={queryFocused} width={width - 4} height={editorHeight - 3} />
        <box style={{ width: "100%", paddingTop: 1 }}>
          <KeybindBar
            bindings={[
              { key: "Ctrl+R", label: "Run" },
              { key: "Tab", label: "Next panel" },
              { key: "Esc", label: "Close" },
            ]}
          />
        </box>
      </box>

      <QueryResults
        focused={resultsFocused}
        width={width}
        height={resultsHeight}
      />
    </box>
  );
}
