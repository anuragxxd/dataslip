import { describe, expect, test } from "bun:test";
import { createUIStore } from "../../src/store/ui";

describe("ui store", () => {
  test("starts with the expected defaults", () => {
    const store = createUIStore();

    expect(store.getState()).toMatchObject({
      screen: "connections",
      activePanel: "sidebar",
      activeDialog: "none",
      dialogData: null,
      sidebarWidth: 30,
      connectionListIndex: 0,
      themeId: "opencode",
    });
  });

  test("updates screen, panels, dialogs, widths, selection, and theme", () => {
    const store = createUIStore();

    store.getState().setScreen("main");
    store.getState().setActivePanel("query");
    store.getState().openDialog("command-panel", { source: "test" });
    store.getState().setSidebarWidth(42);
    store.getState().setConnectionListIndex(3);
    store.getState().setThemeId("nord");

    expect(store.getState()).toMatchObject({
      screen: "main",
      activePanel: "query",
      activeDialog: "command-panel",
      dialogData: { source: "test" },
      sidebarWidth: 42,
      connectionListIndex: 3,
      themeId: "nord",
    });
  });

  test("togglePanel switches sidebar to grid and every other panel back to sidebar", () => {
    const store = createUIStore();

    store.getState().togglePanel();
    expect(store.getState().activePanel).toBe("grid");

    store.getState().setActivePanel("query-results");
    store.getState().togglePanel();
    expect(store.getState().activePanel).toBe("sidebar");
  });

  test("closeDialog and resetNavigation clear dialog state without resetting the rest of the UI", () => {
    const store = createUIStore();

    store.getState().setScreen("main");
    store.getState().setActivePanel("query-results");
    store.getState().openDialog("help", { from: "keyboard" });
    store.getState().setSidebarWidth(55);
    store.getState().setThemeId("rose-pine");

    store.getState().closeDialog();
    expect(store.getState()).toMatchObject({
      screen: "main",
      activePanel: "query-results",
      activeDialog: "none",
      dialogData: null,
      sidebarWidth: 55,
      themeId: "rose-pine",
    });

    store.getState().openDialog("confirm-quit", { from: "menu" });
    store.getState().resetNavigation();
    expect(store.getState()).toMatchObject({
      screen: "main",
      activePanel: "sidebar",
      activeDialog: "none",
      dialogData: null,
      sidebarWidth: 55,
      themeId: "rose-pine",
    });
  });

  test("reset returns the store to its original defaults", () => {
    const store = createUIStore();

    store.getState().setScreen("main");
    store.getState().setActivePanel("query");
    store.getState().openDialog("table-filters", { table: "users" });
    store.getState().setSidebarWidth(45);
    store.getState().setConnectionListIndex(2);
    store.getState().setThemeId("nord");
    store.getState().reset();

    expect(store.getState()).toMatchObject({
      screen: "connections",
      activePanel: "sidebar",
      activeDialog: "none",
      dialogData: null,
      sidebarWidth: 30,
      connectionListIndex: 0,
      themeId: "opencode",
    });
  });
});
