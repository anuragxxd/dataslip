import React, { useEffect, useRef } from "react";
import type { KeyBinding, TextareaRenderable } from "@opentui/core";
import { useTheme } from "../../theme";
import { useQueryStore } from "../../store/query";

interface QueryEditorProps {
  workspaceId: string;
  focused: boolean;
  width: number;
  height: number;
}

const queryKeyBindings: KeyBinding[] = [
  { name: "return", action: "newline" },
  { name: "r", ctrl: true, action: "submit" },
  { name: "return", ctrl: true, action: "submit" },
];

export function QueryEditor({ workspaceId, focused, width, height }: QueryEditorProps) {
  const theme = useTheme();
  const editorRef = useRef<TextareaRenderable | null>(null);
  const store = useQueryStore();
  const { queryText, isExecuting } = store.getWorkspaceState(workspaceId);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    if (editor.plainText !== queryText) {
      editor.setText(queryText);
      editor.gotoBufferEnd();
    }
  }, [queryText]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    if (focused) editor.focus();
    else editor.blur();
  }, [focused]);

  return (
    <textarea
      ref={(instance) => {
        editorRef.current = instance;
      }}
      focused={focused}
      width={width}
      height={height}
      initialValue={queryText}
      placeholder="Write SQL here... Press Ctrl+R to run"
      placeholderColor={theme.textMuted}
      textColor={theme.text}
      focusedTextColor={theme.textBright}
      backgroundColor={theme.bg}
      focusedBackgroundColor={theme.bg}
      cursorColor={theme.accent}
      selectionBg={theme.bgSelected}
      selectionFg={theme.textBright}
      wrapMode="none"
      keyBindings={queryKeyBindings}
      onContentChange={() => {
        store.setQueryText(workspaceId, editorRef.current?.plainText ?? "");
      }}
      onSubmit={() => {
        if (!isExecuting) {
          void store.executeQuery(workspaceId);
        }
      }}
    />
  );
}
