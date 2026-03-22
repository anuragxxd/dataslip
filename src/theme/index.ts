import { useUIStore } from "../store/ui";
import { getThemeById, DEFAULT_THEME_ID } from "./registry";
import type { Theme } from "./types";

export type { Theme, ThemeDefinition } from "./types";
export { themes, themeMap, getThemeById, getThemeIds, getThemeNames, DEFAULT_THEME_ID } from "./registry";

export function resolveTheme(themeId: string): Theme {
  return getThemeById(themeId).theme;
}

/**
 * React hook to get the current active theme.
 * Components using this will re-render when the theme changes.
 */
export function useTheme(): Theme {
  const themeId = useUIStore((s) => s.themeId);
  return resolveTheme(themeId);
}

/**
 * Get the current theme without a hook (for use outside React components).
 * This reads directly from the store — useful in utility functions.
 */
export function getCurrentTheme(): Theme {
  const themeId = useUIStore.getState().themeId;
  return resolveTheme(themeId);
}
