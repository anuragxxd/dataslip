import type { ThemeDefinition } from "../types";

export const opencode: ThemeDefinition = {
  id: "opencode",
  name: "OpenCode",
  theme: {
    // Backgrounds
    bg: "#0a0a0a",
    bgAlt: "#141414",
    bgHighlight: "#2a1f14",
    bgSelected: "#3d2a18",

    // Borders
    border: "#323232",
    borderFocused: "#fab283",

    // Text
    text: "#eeeeee",
    textDim: "#606060",
    textBright: "#ffffff",
    textMuted: "#3c3c3c",

    // Accent
    accent: "#fab283",
    accentAlt: "#9d7cd8",

    // Status
    success: "#7fd88f",
    warning: "#f5a742",
    error: "#e06c75",
    info: "#56b6c2",

    // Data types
    typeString: "#7fd88f",
    typeNumber: "#f5a742",
    typeBool: "#9d7cd8",
    typeNull: "#606060",
    typeDate: "#56b6c2",
    typeJson: "#e5c07b",

    // Tree
    treeIndent: "#323232",
    treeExpanded: "#fab283",
    treeCollapsed: "#606060",

    // Grid
    gridHeader: "#fab283",
    gridHeaderBg: "#141414",
    gridBorder: "#323232",
    gridRowAlt: "#141414",
    gridCellSelected: "#4a3220",
  },
};
