import { describe, expect, test } from "bun:test";
import {
  DEFAULT_THEME_ID,
  getThemeById,
  getThemeIds,
  getThemeNames,
  themeMap,
  themes,
} from "../../src/theme/registry";

describe("theme registry", () => {
  test("exposes stable ids and names for every registered theme", () => {
    expect(themes.length).toBeGreaterThan(0);
    expect(getThemeIds()).toEqual(themes.map((theme) => theme.id));
    expect(getThemeNames()).toEqual(themes.map((theme) => ({ id: theme.id, name: theme.name })));
  });

  test("looks themes up by id and falls back to the default theme", () => {
    expect(themeMap[DEFAULT_THEME_ID]).toBeDefined();
    expect(getThemeById("nord")).toBe(themeMap["nord"]);
    expect(getThemeById("missing-theme")).toBe(themeMap[DEFAULT_THEME_ID]);
  });
});
