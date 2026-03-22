export interface Toast {
  id: number;
  message: string;
  type: "info" | "success" | "error" | "warning";
  expiresAt: number;
}

let toasts: Toast[] = [];
let nextId = 0;
let listeners: Array<() => void> = [];
let toastTimers = new Map<number, ReturnType<typeof setTimeout>>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function removeToast(id: number) {
  const timer = toastTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    toastTimers.delete(id);
  }

  const nextToasts = toasts.filter((toast) => toast.id !== id);
  if (nextToasts.length === toasts.length) return;

  toasts = nextToasts;
  notifyListeners();
}

export function getToasts(): Toast[] {
  return toasts;
}

export function subscribeToasts(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((entry) => entry !== listener);
  };
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

  const timer = setTimeout(() => {
    removeToast(toast.id);
  }, durationMs);
  toastTimers.set(toast.id, timer);
}

export function resetToastState() {
  for (const timer of toastTimers.values()) {
    clearTimeout(timer);
  }
  toastTimers = new Map();
  toasts = [];
  nextId = 0;
  notifyListeners();
}
