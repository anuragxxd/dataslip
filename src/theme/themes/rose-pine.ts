import type { ThemeDefinition } from "../types";

export const rosePine: ThemeDefinition = {
  id: "rose-pine",
  name: "Rosé Pine",
  theme: {
    // Backgrounds
    bg: "#191724",
    bgAlt: "#1f1d2e",
    bgHighlight: "#253040",
    bgSelected: "#2d3d50",

    // Borders
    border: "#26233a",
    borderFocused: "#9ccfd8",

    // Text
    text: "#e0def4",
    textDim: "#6e6a86",
    textBright: "#ffffff",
    textMuted: "#403d52",

    // Accent
    accent: "#9ccfd8",
    accentAlt: "#c4a7e7",

    // Status
    success: "#31748f",
    warning: "#f6c177",
    error: "#eb6f92",
    info: "#9ccfd8",

    // Data types
    typeString: "#f6c177",
    typeNumber: "#c4a7e7",
    typeBool: "#eb6f92",
    typeNull: "#6e6a86",
    typeDate: "#9ccfd8",
    typeJson: "#f6c177",

    // Tree
    treeIndent: "#26233a",
    treeExpanded: "#9ccfd8",
    treeCollapsed: "#6e6a86",

    // Grid
    gridHeader: "#9ccfd8",
    gridHeaderBg: "#1f1d2e",
    gridBorder: "#26233a",
    gridRowAlt: "#1f1d2e",
    gridCellSelected: "#354a5c",
  },
};
