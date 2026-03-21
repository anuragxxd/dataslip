import type { ThemeDefinition } from "../types";

export const gruvbox: ThemeDefinition = {
  id: "gruvbox",
  name: "Gruvbox Dark",
  theme: {
    // Backgrounds
    bg: "#282828",
    bgAlt: "#3c3836",
    bgHighlight: "#3c4a3f",
    bgSelected: "#455c50",

    // Borders
    border: "#504945",
    borderFocused: "#83a598",

    // Text
    text: "#ebdbb2",
    textDim: "#928374",
    textBright: "#fbf1c7",
    textMuted: "#504945",

    // Accent
    accent: "#83a598",
    accentAlt: "#d3869b",

    // Status
    success: "#b8bb26",
    warning: "#fabd2f",
    error: "#fb4934",
    info: "#83a598",

    // Data types
    typeString: "#b8bb26",
    typeNumber: "#d3869b",
    typeBool: "#d3869b",
    typeNull: "#928374",
    typeDate: "#83a598",
    typeJson: "#fabd2f",

    // Tree
    treeIndent: "#504945",
    treeExpanded: "#83a598",
    treeCollapsed: "#928374",

    // Grid
    gridHeader: "#83a598",
    gridHeaderBg: "#3c3836",
    gridBorder: "#504945",
    gridRowAlt: "#3c3836",
    gridCellSelected: "#4e6a58",
  },
};
