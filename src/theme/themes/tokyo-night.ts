import type { ThemeDefinition } from "../types";

export const tokyoNight: ThemeDefinition = {
  id: "tokyo-night",
  name: "Tokyo Night",
  theme: {
    // Backgrounds
    bg: "#1a1b26",
    bgAlt: "#1f2335",
    bgHighlight: "#283050",
    bgSelected: "#2e3d6b",

    // Borders
    border: "#3b4261",
    borderFocused: "#7aa2f7",

    // Text
    text: "#c0caf5",
    textDim: "#565f89",
    textBright: "#ffffff",
    textMuted: "#414868",

    // Accent
    accent: "#7aa2f7",
    accentAlt: "#bb9af7",

    // Status
    success: "#9ece6a",
    warning: "#e0af68",
    error: "#f7768e",
    info: "#7dcfff",

    // Data types
    typeString: "#9ece6a",
    typeNumber: "#ff9e64",
    typeBool: "#bb9af7",
    typeNull: "#565f89",
    typeDate: "#7dcfff",
    typeJson: "#e0af68",

    // Tree
    treeIndent: "#3b4261",
    treeExpanded: "#7aa2f7",
    treeCollapsed: "#565f89",

    // Grid
    gridHeader: "#7aa2f7",
    gridHeaderBg: "#1f2335",
    gridBorder: "#3b4261",
    gridRowAlt: "#1f2335",
    gridCellSelected: "#364a85",
  },
};
