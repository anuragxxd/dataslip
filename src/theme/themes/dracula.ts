import type { ThemeDefinition } from "../types";

export const dracula: ThemeDefinition = {
  id: "dracula",
  name: "Dracula",
  theme: {
    // Backgrounds
    bg: "#282a36",
    bgAlt: "#21222c",
    bgHighlight: "#3b3760",
    bgSelected: "#483e78",

    // Borders
    border: "#44475a",
    borderFocused: "#bd93f9",

    // Text
    text: "#f8f8f2",
    textDim: "#6272a4",
    textBright: "#ffffff",
    textMuted: "#44475a",

    // Accent
    accent: "#bd93f9",
    accentAlt: "#ff79c6",

    // Status
    success: "#50fa7b",
    warning: "#f1fa8c",
    error: "#ff5555",
    info: "#8be9fd",

    // Data types
    typeString: "#f1fa8c",
    typeNumber: "#bd93f9",
    typeBool: "#ff79c6",
    typeNull: "#6272a4",
    typeDate: "#8be9fd",
    typeJson: "#ffb86c",

    // Tree
    treeIndent: "#44475a",
    treeExpanded: "#bd93f9",
    treeCollapsed: "#6272a4",

    // Grid
    gridHeader: "#bd93f9",
    gridHeaderBg: "#21222c",
    gridBorder: "#44475a",
    gridRowAlt: "#21222c",
    gridCellSelected: "#544990",
  },
};
