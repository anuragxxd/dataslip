import type { ThemeDefinition } from "../types";

export const nord: ThemeDefinition = {
  id: "nord",
  name: "Nord",
  theme: {
    // Backgrounds
    bg: "#2e3440",
    bgAlt: "#3b4252",
    bgHighlight: "#3a4f5e",
    bgSelected: "#3d5a68",

    // Borders
    border: "#434c5e",
    borderFocused: "#88c0d0",

    // Text
    text: "#eceff4",
    textDim: "#8b95a7",
    textBright: "#ffffff",
    textMuted: "#4c566a",

    // Accent
    accent: "#88c0d0",
    accentAlt: "#b48ead",

    // Status
    success: "#a3be8c",
    warning: "#ebcb8b",
    error: "#bf616a",
    info: "#81a1c1",

    // Data types
    typeString: "#a3be8c",
    typeNumber: "#d08770",
    typeBool: "#b48ead",
    typeNull: "#8b95a7",
    typeDate: "#81a1c1",
    typeJson: "#ebcb8b",

    // Tree
    treeIndent: "#434c5e",
    treeExpanded: "#88c0d0",
    treeCollapsed: "#8b95a7",

    // Grid
    gridHeader: "#88c0d0",
    gridHeaderBg: "#3b4252",
    gridBorder: "#434c5e",
    gridRowAlt: "#3b4252",
    gridCellSelected: "#406575",
  },
};
