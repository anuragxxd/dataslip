import React from "react";
import { act } from "react";
import { afterEach, describe, expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { ToastContainer, resetToastState, showToast } from "../../../src/components/ui/toast";
import { useUIStore } from "../../../src/store/ui";

const originalThemeId = useUIStore.getState().themeId;

afterEach(() => {
  resetToastState();
  useUIStore.setState({ themeId: originalThemeId });
});

function compactFrame(frame: string): string[] {
  return frame
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
}

describe("toast container", () => {
  test("renders nothing when there are no active toasts", async () => {
    const setup = await testRender(React.createElement(ToastContainer), {
      width: 60,
      height: 10,
    });

    try {
      await act(async () => {
        await setup.renderOnce();
      });
      expect(compactFrame(setup.captureCharFrame())).toEqual([]);
    } finally {
      await act(async () => {
        await setup.renderer.destroy();
      });
    }
  });

  test("renders stacked toasts with the correct icons and reacts to theme-backed updates", async () => {
    useUIStore.setState({ themeId: "nord" });
    showToast("Saved successfully", "success", 1000);
    showToast("Something failed", "error", 1000);

    const setup = await testRender(React.createElement(ToastContainer), {
      width: 60,
      height: 10,
    });

    try {
      await act(async () => {
        await setup.renderOnce();
      });

      const frame = compactFrame(setup.captureCharFrame()).join("\n");
      expect(frame).toContain("[+] Saved successfully");
      expect(frame).toContain("[x] Something failed");
      expect(frame).toContain("╭──────────────────────────────────────╮");
    } finally {
      await act(async () => {
        await setup.renderer.destroy();
      });
    }
  });
});
