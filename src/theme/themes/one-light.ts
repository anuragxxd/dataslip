import type { ThemeDefinition } from "../types";

export const oneLight: ThemeDefinition = {
  id: "one-light",
  name: "One Light",
  theme: {
    // Backgrounds
    bg: "#fafafa",
    bgAlt: "#f0f0f0",
    bgHighlight: "#d4ddf7",
    bgSelected: "#c0ccf0",

    // Borders
    border: "#d0d0d0",
    borderFocused: "#4078f2",

    // Text
    text: "#383a42",
    textDim: "#a0a1a7",
    textBright: "#1a1a1a",
    textMuted: "#c8c8c8",

    // Accent
    accent: "#4078f2",
    accentAlt: "#a626a4",

    // Status
    success: "#50a14f",
    warning: "#c18401",
    error: "#e45649",
    info: "#0184bc",

    // Data types
    typeString: "#50a14f",
    typeNumber: "#986801",
    typeBool: "#a626a4",
    typeNull: "#a0a1a7",
    typeDate: "#0184bc",
    typeJson: "#c18401",

    // Tree
    treeIndent: "#d0d0d0",
    treeExpanded: "#4078f2",
    treeCollapsed: "#a0a1a7",

    // Grid
    gridHeader: "#4078f2",
    gridHeaderBg: "#f0f0f0",
    gridBorder: "#d0d0d0",
    gridRowAlt: "#f0f0f0",
    gridCellSelected: "#b3c2ec",
  },
};
