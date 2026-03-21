export interface Theme {
  // Backgrounds
  bg: string;
  bgAlt: string;
  bgHighlight: string;
  bgSelected: string;

  // Borders
  border: string;
  borderFocused: string;

  // Text
  text: string;
  textDim: string;
  textBright: string;
  textMuted: string;

  // Accent
  accent: string;
  accentAlt: string;

  // Status
  success: string;
  warning: string;
  error: string;
  info: string;

  // Data types
  typeString: string;
  typeNumber: string;
  typeBool: string;
  typeNull: string;
  typeDate: string;
  typeJson: string;

  // Tree
  treeIndent: string;
  treeExpanded: string;
  treeCollapsed: string;

  // Grid
  gridHeader: string;
  gridHeaderBg: string;
  gridBorder: string;
  gridRowAlt: string;
  gridCellSelected: string;
}

export interface ThemeDefinition {
  id: string;
  name: string;
  theme: Theme;
}
