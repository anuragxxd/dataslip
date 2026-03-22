import { create } from "zustand";
import { DEFAULT_THEME_ID } from "../theme/registry";

export type Screen = "connections" | "main";
export type Panel = "sidebar" | "grid" | "query" | "query-results";
export type Dialog =
  | "none"
  | "connection-form"
  | "connection-edit"
  | "help"
  | "confirm-delete"
  | "confirm-disconnect"
  | "confirm-quit"
  | "theme-picker"
  | "command-panel"
  | "schema-search"
  | "table-filters"
  | "table-filter-preview"
  | "edit-confirm";

interface UIState {
  // Navigation
  screen: Screen;
  activePanel: Panel;

  // Dialogs
  activeDialog: Dialog;
  dialogData: any;

  // Sidebar
  sidebarWidth: number;

  // Connection list selection
  connectionListIndex: number;

  // Theme
  themeId: string;

  // Actions
  setScreen: (screen: Screen) => void;
  setActivePanel: (panel: Panel) => void;
  togglePanel: () => void;
  openDialog: (dialog: Dialog, data?: any) => void;
  closeDialog: () => void;
  setSidebarWidth: (width: number) => void;
  setConnectionListIndex: (index: number) => void;
  setThemeId: (themeId: string) => void;
  resetNavigation: () => void;
  reset: () => void;
}

function createDefaultUIState() {
  return {
    screen: "connections" as Screen,
    activePanel: "sidebar" as Panel,
    activeDialog: "none" as Dialog,
    dialogData: null,
    sidebarWidth: 30,
    connectionListIndex: 0,
    themeId: DEFAULT_THEME_ID,
  };
}

export const useUIStore = create<UIState>((set, get) => ({
  ...createDefaultUIState(),

  setScreen: (screen) => set({ screen }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  togglePanel: () =>
    set((state) => ({
      activePanel: state.activePanel === "sidebar" ? "grid" : "sidebar",
    })),
  openDialog: (dialog, data = null) =>
    set({ activeDialog: dialog, dialogData: data }),
  closeDialog: () => set({ activeDialog: "none", dialogData: null }),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setConnectionListIndex: (index) => set({ connectionListIndex: index }),
  setThemeId: (themeId) => set({ themeId }),
  resetNavigation: () =>
    set({
      activePanel: "sidebar",
      activeDialog: "none",
      dialogData: null,
    }),
  reset: () => set(createDefaultUIState()),
}));
