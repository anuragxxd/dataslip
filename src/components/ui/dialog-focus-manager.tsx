import { useEffect, useRef } from "react";
import { useRenderer } from "@opentui/react";
import type { Renderable } from "@opentui/core";
import { useUIStore } from "../../store/ui";

export function DialogFocusManager() {
  const renderer = useRenderer();
  const activeDialog = useUIStore((state) => state.activeDialog);
  const focusRef = useRef<Renderable | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    const isOpen = activeDialog !== "none";

    if (isOpen && !wasOpenRef.current) {
      focusRef.current = renderer.currentFocusedRenderable;
      focusRef.current?.blur();
    }

    if (!isOpen && wasOpenRef.current) {
      const focus = focusRef.current;
      focusRef.current = null;

      setTimeout(() => {
        if (!focus || focus.isDestroyed) return;

        const find = (item: Renderable): boolean => {
          if (item === focus) return true;
          for (const child of item.getChildren()) {
            if (find(child)) return true;
          }
          return false;
        };

        if (!find(renderer.root)) return;
        focus.focus();
      }, 1);
    }

    wasOpenRef.current = isOpen;
  }, [activeDialog, renderer]);

  return null;
}
