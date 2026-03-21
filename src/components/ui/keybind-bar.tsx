import React from "react";
import { useTheme } from "../../theme";

interface Keybind {
  key: string;
  label: string;
}

interface KeybindBarProps {
  bindings: Keybind[];
}

export function KeybindBar({ bindings }: KeybindBarProps) {
  const theme = useTheme();

  return (
    <box style={{ flexDirection: "row", gap: 1, flexWrap: "wrap" }}>
      {bindings.map((b, i) => (
        <box key={i} style={{ flexDirection: "row" }}>
          <text fg={theme.accent}>[{b.key}]</text>
          <text fg={theme.textDim}> {b.label} </text>
        </box>
      ))}
    </box>
  );
}
