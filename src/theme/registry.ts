import type { ThemeDefinition } from "./types";
import { tokyoNight } from "./themes/tokyo-night";
import { opencode } from "./themes/opencode";
import { vercel } from "./themes/vercel";
import { oneLight } from "./themes/one-light";
import { dracula } from "./themes/dracula";
import { catppuccin } from "./themes/catppuccin";
import { nord } from "./themes/nord";
import { gruvbox } from "./themes/gruvbox";
import { rosePine } from "./themes/rose-pine";

export const DEFAULT_THEME_ID = "opencode";

export const themes: ThemeDefinition[] = [
  opencode,
  tokyoNight,
  vercel,
  oneLight,
  dracula,
  catppuccin,
  nord,
  gruvbox,
  rosePine,
];

export const themeMap: Record<string, ThemeDefinition> = Object.fromEntries(
  themes.map((t) => [t.id, t])
);

export function getThemeById(id: string): ThemeDefinition {
  return themeMap[id] ?? themeMap[DEFAULT_THEME_ID];
}

export function getThemeIds(): string[] {
  return themes.map((t) => t.id);
}

export function getThemeNames(): Array<{ id: string; name: string }> {
  return themes.map((t) => ({ id: t.id, name: t.name }));
}
