import React, { useEffect, useState } from "react";
import { useTerminalDimensions } from "@opentui/react";
import { useTheme } from "../../theme";
import { getToasts, showToast, subscribeToasts, type Toast } from "./toast-state";

export { resetToastState, showToast } from "./toast-state";

export function ToastContainer() {
  const [, forceUpdate] = useState(0);
  const { width } = useTerminalDimensions();
  const theme = useTheme();

  useEffect(() => {
    return subscribeToasts(() => forceUpdate((n) => n + 1));
  }, []);

  const toasts = getToasts();

  if (toasts.length === 0) return null;

  const colors: Record<Toast["type"], string> = {
    info: theme.info,
    success: theme.success,
    error: theme.error,
    warning: theme.warning,
  };

  const icons: Record<Toast["type"], string> = {
    info: "i",
    success: "+",
    error: "x",
    warning: "!",
  };

  return (
    <box
      style={{
        position: "absolute",
        right: 2,
        top: 1,
        flexDirection: "column",
        gap: 1,
      }}
    >
      {toasts.map((toast) => (
        <box
          key={toast.id}
          style={{
            backgroundColor: theme.bgAlt,
            border: true,
            borderStyle: "rounded",
            borderColor: colors[toast.type],
            paddingX: 1,
            width: Math.min(40, width - 4),
          }}
        >
          <text fg={colors[toast.type]}>
            [{icons[toast.type]}] {toast.message}
          </text>
        </box>
      ))}
    </box>
  );
}
