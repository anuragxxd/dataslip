import React from "react";
import { useTerminalDimensions } from "@opentui/react";
import { useTheme } from "../../theme";

interface DialogProps {
  title: string;
  children: React.ReactNode;
  width?: number;
  height?: number;
}

export function Dialog({
  title,
  children,
  width: propWidth,
  height: propHeight,
}: DialogProps) {
  const { width: termWidth, height: termHeight } = useTerminalDimensions();
  const theme = useTheme();

  const width = propWidth || Math.min(60, termWidth - 10);
  const height = propHeight || Math.min(20, termHeight - 6);

  return (
    <box
      title={` ${title} `}
      style={{
        position: "absolute",
        left: Math.floor((termWidth - width) / 2),
        top: Math.floor((termHeight - height) / 2),
        width,
        height,
        backgroundColor: theme.bgAlt,
        border: true,
        borderStyle: "rounded",
        borderColor: theme.borderFocused,
        titleAlignment: "center",
        flexDirection: "column",
        padding: 1,
      }}
    >
      {children}
    </box>
  );
}
