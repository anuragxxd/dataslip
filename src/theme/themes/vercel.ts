import type { ThemeDefinition } from "../types";

export const vercel: ThemeDefinition = {
  id: "vercel",
  name: "Vercel",
  theme: {
    // Backgrounds
    bg: "#000000",
    bgAlt: "#0a0a0a",
    bgHighlight: "#0d1a2e",
    bgSelected: "#0f2240",

    // Borders
    border: "#292929",
    borderFocused: "#0070F3",

    // Text
    text: "#ededed",
    textDim: "#878787",
    textBright: "#ffffff",
    textMuted: "#454545",

    // Accent
    accent: "#0070F3",
    accentAlt: "#8E4EC6",

    // Status
    success: "#46A758",
    warning: "#FFB224",
    error: "#E5484D",
    info: "#52A8FF",

    // Data types
    typeString: "#63C46D",
    typeNumber: "#F2A700",
    typeBool: "#BF7AF0",
    typeNull: "#878787",
    typeDate: "#0AC7AC",
    typeJson: "#FFB224",

    // Tree
    treeIndent: "#292929",
    treeExpanded: "#0070F3",
    treeCollapsed: "#878787",

    // Grid
    gridHeader: "#0070F3",
    gridHeaderBg: "#0a0a0a",
    gridBorder: "#292929",
    gridRowAlt: "#0a0a0a",
    gridCellSelected: "#132a50",
  },
};
