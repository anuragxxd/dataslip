import { describe, expect, test } from "bun:test";
import {
  getToasts,
  resetToastState,
  showToast,
  subscribeToasts,
} from "../../../src/components/ui/toast-state";

async function waitFor(predicate: () => boolean, timeoutMs: number = 200) {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("timed out waiting for condition");
    }
    await Bun.sleep(10);
  }
}

describe("toast state", () => {
  test("shows a toast, notifies listeners, and auto-removes it after the duration", async () => {
    resetToastState();
    const notifications: number[] = [];
    const unsubscribe = subscribeToasts(() => {
      notifications.push(getToasts().length);
    });

    showToast("Saved", "success", 20);

    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0]).toMatchObject({
      id: 0,
      message: "Saved",
      type: "success",
    });

    await waitFor(() => getToasts().length === 0);
    unsubscribe();

    expect(notifications).toEqual([1, 0]);
  });

  test("unsubscribe stops notifications and reset clears pending timers and ids", async () => {
    resetToastState();
    let notifications = 0;
    const unsubscribe = subscribeToasts(() => {
      notifications += 1;
    });

    showToast("First", "info", 100);
    unsubscribe();
    showToast("Second", "warning", 100);

    expect(notifications).toBe(1);
    expect(getToasts().map((toast) => toast.id)).toEqual([0, 1]);

    resetToastState();
    expect(getToasts()).toEqual([]);

    await Bun.sleep(120);
    expect(getToasts()).toEqual([]);

    showToast("After reset", "error", 5);
    expect(getToasts()[0]).toMatchObject({ id: 0, message: "After reset", type: "error" });
    await waitFor(() => getToasts().length === 0);
  });
});
