import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InputRenderable, ScrollBoxRenderable } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useTheme } from "../../theme";
import { Dialog } from "./dialog";
import { KeybindBar } from "./keybind-bar";
import { truncate } from "../../utils/format";

export interface DialogSelectOption<T> {
  id: string;
  value: T;
  title: string;
  category?: string;
  description?: string;
  footer?: string;
  icon?: string;
  iconColor?: string;
  keywords?: string[];
  priority?: number;
  disabled?: boolean;
  onSelect?: (value: T) => void;
}

interface DialogSelectProps<T> {
  title: string;
  placeholder?: string;
  options: DialogSelectOption<T>[];
  width?: number;
  height?: number;
  onClose?: () => void;
  isLoading?: boolean;
  loadingText?: string;
  emptyText?: string;
  flatWhenFiltering?: boolean;
  onSelect?: (option: DialogSelectOption<T>) => void;
}

interface RankedOption<T> {
  option: DialogSelectOption<T>;
  score: number;
}

interface OptionGroup<T> {
  category: string;
  items: DialogSelectOption<T>[];
}

function scoreText(query: string, text: string | undefined): number {
  if (!text) return Number.NEGATIVE_INFINITY;

  const needle = query.trim().toLowerCase();
  if (!needle) return 0;

  const haystack = text.toLowerCase();
  if (haystack === needle) return 1200 - Math.max(0, haystack.length - needle.length);
  if (haystack.startsWith(needle)) return 1000 - Math.max(0, haystack.length - needle.length);

  const containsIndex = haystack.indexOf(needle);
  if (containsIndex >= 0) {
    return 800 - containsIndex * 8 - Math.max(0, haystack.length - needle.length);
  }

  let qi = 0;
  let gaps = 0;
  let lastMatch = -1;
  for (let i = 0; i < haystack.length && qi < needle.length; i++) {
    if (haystack[i] === needle[qi]) {
      if (lastMatch >= 0) gaps += i - lastMatch - 1;
      lastMatch = i;
      qi++;
    }
  }

  if (qi === needle.length) {
    return 450 - gaps * 6 - Math.max(0, haystack.length - needle.length);
  }

  return Number.NEGATIVE_INFINITY;
}

function rankOptions<T>(query: string, options: DialogSelectOption<T>[]): DialogSelectOption<T>[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return options.filter((option) => !option.disabled);

  const ranked: RankedOption<T>[] = [];
  for (const option of options) {
    if (option.disabled) continue;

    const titleScore = scoreText(needle, option.title);
    const categoryScore = scoreText(needle, option.category);
    const descriptionScore = scoreText(needle, option.description);
    const footerScore = scoreText(needle, option.footer);
    const keywordScore = Math.max(
      ...[option.title, ...(option.keywords || [])].map((value) => scoreText(needle, value))
    );

    const matched = [titleScore, categoryScore, descriptionScore, footerScore, keywordScore].some(
      (score) => score !== Number.NEGATIVE_INFINITY
    );
    if (!matched) continue;

    const score =
      (titleScore === Number.NEGATIVE_INFINITY ? 0 : titleScore * 4) +
      (keywordScore === Number.NEGATIVE_INFINITY ? 0 : keywordScore * 2.5) +
      (descriptionScore === Number.NEGATIVE_INFINITY ? 0 : descriptionScore * 1.5) +
      (footerScore === Number.NEGATIVE_INFINITY ? 0 : footerScore) +
      (categoryScore === Number.NEGATIVE_INFINITY ? 0 : categoryScore * 0.75) +
      (option.priority || 0);

    ranked.push({ option, score });
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.option.title.localeCompare(b.option.title);
  });

  return ranked.map((entry) => entry.option);
}

function buildGroups<T>(
  options: DialogSelectOption<T>[],
  flatten: boolean
): OptionGroup<T>[] {
  if (flatten) {
    return [{ category: "", items: options }];
  }

  const grouped = new Map<string, DialogSelectOption<T>[]>();
  for (const option of options) {
    const category = option.category || "Results";
    const existing = grouped.get(category) || [];
    existing.push(option);
    grouped.set(category, existing);
  }

  return Array.from(grouped.entries()).map(([category, items]) => ({
    category,
    items,
  }));
}

export function DialogSelect<T>({
  title,
  placeholder,
  options,
  width = 72,
  height = 22,
  onClose,
  isLoading = false,
  loadingText = "Loading...",
  emptyText = "No results found",
  flatWhenFiltering = false,
  onSelect,
}: DialogSelectProps<T>) {
  const theme = useTheme();
  const inputRef = useRef<InputRenderable | null>(null);
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);

  const [filter, setFilter] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [inputMode, setInputMode] = useState<"keyboard" | "mouse">("keyboard");

  const filteredOptions = useMemo(
    () => rankOptions(filter, options),
    [filter, options]
  );

  const flatten = flatWhenFiltering && filter.trim().length > 0;
  const groups = useMemo(
    () => buildGroups(filteredOptions, flatten),
    [filteredOptions, flatten]
  );
  const flatOptions = useMemo(
    () => groups.flatMap((group) => group.items),
    [groups]
  );
  const optionIndexById = useMemo(() => {
    const map = new Map<string, number>();
    flatOptions.forEach((option, index) => map.set(option.id, index));
    return map;
  }, [flatOptions]);
  const optionsSignature = useMemo(
    () => flatOptions.map((option) => option.id).join("\0"),
    [flatOptions]
  );

  const moveTo = useCallback(
    (next: number) => {
      if (flatOptions.length === 0) return;
      const index = Math.max(0, Math.min(flatOptions.length - 1, next));
      setSelectedIndex(index);
    },
    [flatOptions.length]
  );

  const moveBy = useCallback(
    (delta: number) => {
      if (flatOptions.length === 0) return;
      let next = selectedIndex + delta;
      if (next < 0) next = flatOptions.length - 1;
      if (next >= flatOptions.length) next = 0;
      moveTo(next);
    },
    [flatOptions.length, moveTo, selectedIndex]
  );

  const handleSelect = useCallback(
    (option: DialogSelectOption<T> | undefined) => {
      if (!option || option.disabled) return;
      option.onSelect?.(option.value);
      onSelect?.(option);
    },
    [onSelect]
  );

  useEffect(() => {
    setTimeout(() => {
      const input = inputRef.current;
      if (!input || input.isDestroyed) return;
      input.focus();
    }, 1);
  }, []);

  useEffect(() => {
    setInputMode("keyboard");
  }, [optionsSignature]);

  useEffect(() => {
    if (flatOptions.length === 0) {
      setSelectedIndex(0);
      return;
    }

    setSelectedIndex((current) => {
      if (filter.trim().length > 0) return 0;
      return Math.min(current, flatOptions.length - 1);
    });
  }, [filter, flatOptions.length, optionsSignature]);

  useEffect(() => {
    const selected = flatOptions[selectedIndex];
    if (!selected) return;
    setTimeout(() => {
      const scroll = scrollRef.current;
      if (!scroll || scroll.isDestroyed) return;
      scroll.scrollChildIntoView(selected.id);
    }, 0);
  }, [flatOptions, selectedIndex]);

  useKeyboard((key) => {
    if (key.name === "escape") {
      onClose?.();
      key.stopPropagation();
      return;
    }

    if (key.name === "up" || (key.ctrl && key.name === "p")) {
      setInputMode("keyboard");
      moveBy(-1);
      key.stopPropagation();
      return;
    }

    if (key.name === "down" || (key.ctrl && key.name === "n")) {
      setInputMode("keyboard");
      moveBy(1);
      key.stopPropagation();
      return;
    }

    if (key.name === "pageup") {
      setInputMode("keyboard");
      moveBy(-10);
      key.stopPropagation();
      return;
    }

    if (key.name === "pagedown") {
      setInputMode("keyboard");
      moveBy(10);
      key.stopPropagation();
      return;
    }

    if (key.name === "home") {
      setInputMode("keyboard");
      moveTo(0);
      key.stopPropagation();
      return;
    }

    if (key.name === "end") {
      setInputMode("keyboard");
      moveTo(flatOptions.length - 1);
      key.stopPropagation();
      return;
    }

    if (key.name === "return") {
      setInputMode("keyboard");
      handleSelect(flatOptions[selectedIndex]);
      key.stopPropagation();
    }
  });

  return (
    <Dialog title={title} width={width} height={height}>
      <box style={{ flexDirection: "column", gap: 1, flexGrow: 1 }}>
        <input
          ref={(value) => {
            inputRef.current = value;
          }}
          value={filter}
          placeholder={placeholder || "Search"}
          onInput={(value: string) => setFilter(value)}
          focusedBackgroundColor={theme.bgHighlight}
          textColor={theme.textBright}
          focusedTextColor={theme.textBright}
          cursorColor={theme.accent}
        />

        {flatOptions.length === 0 ? (
          <box style={{ paddingTop: 1 }}>
            <text fg={theme.textDim}>{isLoading ? loadingText : emptyText}</text>
          </box>
        ) : (
          <scrollbox
            ref={(value) => {
              scrollRef.current = value;
            }}
            viewportCulling={true}
            scrollbarOptions={{ visible: false }}
            style={{ flexGrow: 1 }}
          >
            {groups.map((group, groupIndex) => (
              <box key={`group-${group.category}-${groupIndex}`} style={{ flexDirection: "column" }}>
                {!flatten && group.category ? (
                  <box style={{ paddingLeft: 2, paddingTop: groupIndex > 0 ? 1 : 0 }}>
                    <text fg={theme.accent}>{group.category}</text>
                  </box>
                ) : null}

                {group.items.map((option) => {
                  const index = optionIndexById.get(option.id) ?? -1;
                  const isSelected = index === selectedIndex;
                  const context = flatten
                    ? option.category || option.description || option.footer || ""
                    : option.description || option.footer || "";
                  const rowWidth = Math.max(12, width - 8);
                  const titleWidth = Math.max(10, rowWidth - context.length - 8);
                  const title = truncate(option.title, titleWidth);
                  const detail = context
                    ? truncate(context, Math.max(8, rowWidth - title.length - 8))
                    : "";

                  return (
                    <box
                      key={option.id}
                      id={option.id}
                      style={{
                        flexDirection: "row",
                        width: "100%",
                        paddingX: 1,
                        backgroundColor: isSelected ? theme.bgSelected : "transparent",
                      }}
                      onMouseMove={() => setInputMode("mouse")}
                      onMouseOver={() => {
                        if (inputMode !== "mouse") return;
                        moveTo(index);
                      }}
                      onMouseDown={() => moveTo(index)}
                      onMouseUp={() => handleSelect(option)}
                    >
                      <text fg={isSelected ? theme.accent : theme.textDim}>
                        {isSelected ? ">" : " "}{" "}
                      </text>
                      {option.icon ? (
                        <text fg={option.iconColor || theme.textDim}>{option.icon}</text>
                      ) : null}
                      {option.icon ? <text fg={theme.text}> </text> : null}
                      <text fg={isSelected ? theme.textBright : theme.text}>{title}</text>
                      {detail ? <text fg={theme.textMuted}> {detail}</text> : null}
                    </box>
                  );
                })}
              </box>
            ))}
          </scrollbox>
        )}

        <KeybindBar
          bindings={[
            { key: "↑↓", label: "Move" },
            { key: "Enter", label: "Open" },
            { key: "Esc", label: "Close" },
          ]}
        />
      </box>
    </Dialog>
  );
}
