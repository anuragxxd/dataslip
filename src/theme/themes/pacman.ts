import type { ThemeDefinition } from "../types";

export const pacman: ThemeDefinition = {
  id: "pacman",
  name: "Pac-Man",
  theme: {
    // Backgrounds
    bg: "#05070d",
    bgAlt: "#0b1020",
    bgHighlight: "#121c3e",
    bgSelected: "#1b2c62",

    // Borders
    border: "#24315f",
    borderFocused: "#2f5fff",

    // Text
    text: "#eef4ff",
    textDim: "#6b79ab",
    textBright: "#fffde8",
    textMuted: "#223055",

    // Accent
    accent: "#ffe45c",
    accentAlt: "#ff9de2",

    // Status
    success: "#72ff5d",
    warning: "#ffb852",
    error: "#ff5a5a",
    info: "#53f7ff",

    // Data types
    typeString: "#72ff5d",
    typeNumber: "#ffb852",
    typeBool: "#ff9de2",
    typeNull: "#6b79ab",
    typeDate: "#53f7ff",
    typeJson: "#ffe45c",

    // Tree
    treeIndent: "#24315f",
    treeExpanded: "#2f5fff",
    treeCollapsed: "#6b79ab",

    // Grid
    gridHeader: "#2f5fff",
    gridHeaderBg: "#0b1020",
    gridBorder: "#24315f",
    gridRowAlt: "#09101f",
    gridCellSelected: "#20397b",
  },
};
