import type { ThemeDefinition } from "../types";

export const catppuccin: ThemeDefinition = {
  id: "catppuccin",
  name: "Catppuccin Mocha",
  theme: {
    // Backgrounds
    bg: "#1e1e2e",
    bgAlt: "#181825",
    bgHighlight: "#2a3050",
    bgSelected: "#333d68",

    // Borders
    border: "#313244",
    borderFocused: "#89b4fa",

    // Text
    text: "#cdd6f4",
    textDim: "#6c7086",
    textBright: "#ffffff",
    textMuted: "#45475a",

    // Accent
    accent: "#89b4fa",
    accentAlt: "#cba6f7",

    // Status
    success: "#a6e3a1",
    warning: "#f9e2af",
    error: "#f38ba8",
    info: "#89dceb",

    // Data types
    typeString: "#a6e3a1",
    typeNumber: "#fab387",
    typeBool: "#cba6f7",
    typeNull: "#6c7086",
    typeDate: "#89dceb",
    typeJson: "#f9e2af",

    // Tree
    treeIndent: "#313244",
    treeExpanded: "#89b4fa",
    treeCollapsed: "#6c7086",

    // Grid
    gridHeader: "#89b4fa",
    gridHeaderBg: "#181825",
    gridBorder: "#313244",
    gridRowAlt: "#181825",
    gridCellSelected: "#3a4878",
  },
};
