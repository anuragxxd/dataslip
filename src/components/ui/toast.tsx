import React, { useEffect, useState } from "react";
import { useTerminalDimensions } from "@opentui/react";
import { useTheme } from "../../theme";

interface Toast {
  id: number;
  message: string;
  type: "info" | "success" | "error" | "warning";
  expiresAt: number;
}

let toasts: Toast[] = [];
let nextId = 0;
let listeners: Array<() => void> = [];

function notifyListeners() {
  listeners.forEach((l) => l());
}

export function showToast(
  message: string,
  type: Toast["type"] = "info",
  durationMs: number = 3000
) {
  const toast: Toast = {
    id: nextId++,
    message,
    type,
    expiresAt: Date.now() + durationMs,
  };
  toasts = [...toasts, toast];
  notifyListeners();

  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== toast.id);
    notifyListeners();
  }, durationMs);
}

export function ToastContainer() {
  const [, forceUpdate] = useState(0);
  const { width } = useTerminalDimensions();
  const theme = useTheme();

  useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

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
