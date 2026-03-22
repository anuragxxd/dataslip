import { afterEach, describe, expect, test } from "bun:test";
import { resolveTheme, getCurrentTheme } from "../../src/theme";
import { DEFAULT_THEME_ID, getThemeById } from "../../src/theme/registry";
import { useUIStore } from "../../src/store/ui";

const originalThemeId = useUIStore.getState().themeId;

afterEach(() => {
  useUIStore.setState({ themeId: originalThemeId });
});

describe("theme index", () => {
  test("resolves theme ids and falls back to the default theme", () => {
    expect(resolveTheme("dracula")).toBe(getThemeById("dracula").theme);
    expect(resolveTheme("missing-theme")).toBe(getThemeById(DEFAULT_THEME_ID).theme);
  });

  test("reads the current theme directly from the UI store", () => {
    useUIStore.setState({ themeId: "nord" });
    expect(getCurrentTheme()).toBe(getThemeById("nord").theme);

    useUIStore.setState({ themeId: "missing-theme" });
    expect(getCurrentTheme()).toBe(getThemeById(DEFAULT_THEME_ID).theme);
  });
});
