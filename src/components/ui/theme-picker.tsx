import React, { useState, useCallback, useEffect } from "react";
import { useKeyboard } from "@opentui/react";
import { useTheme } from "../../theme";
import { themes } from "../../theme/registry";
import { useUIStore } from "../../store/ui";
import { setSetting } from "../../storage";
import { Dialog } from "./dialog";
import { showToast } from "./toast";

export function ThemePicker() {
  const theme = useTheme();
  const { closeDialog, themeId, setThemeId } = useUIStore();
  const [cursorIndex, setCursorIndex] = useState(() =>
    Math.max(0, themes.findIndex((t) => t.id === themeId))
  );
  const [originalThemeId] = useState(themeId);

  // Live preview: apply the hovered theme immediately
  useEffect(() => {
    const hoveredTheme = themes[cursorIndex];
    if (hoveredTheme && hoveredTheme.id !== themeId) {
      setThemeId(hoveredTheme.id);
    }
  }, [cursorIndex]);

  const handleConfirm = useCallback(() => {
    const selected = themes[cursorIndex];
    if (selected) {
      setThemeId(selected.id);
      setSetting("themeId", selected.id);
      showToast(`Theme: ${selected.name}`, "success");
    }
    closeDialog();
  }, [cursorIndex, closeDialog, setThemeId]);

  const handleCancel = useCallback(() => {
    // Revert to original theme
    setThemeId(originalThemeId);
    closeDialog();
  }, [originalThemeId, closeDialog, setThemeId]);

  useKeyboard((key) => {
    if (key.name === "escape" || key.name === "q") {
      handleCancel();
    } else if (key.name === "return") {
      handleConfirm();
    } else if (key.name === "up" || key.name === "k") {
      setCursorIndex((prev) => Math.max(0, prev - 1));
    } else if (key.name === "down" || key.name === "j") {
      setCursorIndex((prev) => Math.min(themes.length - 1, prev + 1));
    }
    key.stopPropagation();
  });

  const dialogHeight = themes.length + 5;

  return (
    <Dialog title="Select Theme" width={40} height={dialogHeight}>
      <box style={{ flexDirection: "column" }}>
        {themes.map((t, idx) => {
          const isCursor = idx === cursorIndex;
          const isActive = t.id === originalThemeId;

          return (
            <box
              key={t.id}
              style={{
                flexDirection: "row",
                backgroundColor: isCursor ? theme.bgSelected : "transparent",
                paddingX: 1,
                width: "100%",
              }}
            >
              <text fg={isCursor ? theme.accent : theme.textDim}>
                {isCursor ? ">" : " "}{" "}
              </text>
              <text fg={isCursor ? theme.textBright : theme.text}>
                {t.name}
              </text>
              {isActive && (
                <text fg={theme.success}> (current)</text>
              )}
            </box>
          );
        })}
      </box>

      <box style={{ paddingTop: 1, flexDirection: "row", gap: 2 }}>
        <text fg={theme.accent}>[Enter]</text>
        <text fg={theme.textDim}>Select</text>
        <text fg={theme.accent}>[Esc]</text>
        <text fg={theme.textDim}>Cancel</text>
      </box>
    </Dialog>
  );
}
