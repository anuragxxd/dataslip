import { describe, expect, test } from "bun:test";
import {
  formatCellValue,
  formatRowCount,
  generateId,
  getTypeColor,
  truncate,
} from "../../src/utils/format";

describe("format utils", () => {
  test("formats nulls, booleans, numbers, dates, objects, and cleaned strings", () => {
    const date = new Date("2024-02-03T04:05:06.000Z");

    expect(formatCellValue(null)).toBe("NULL");
    expect(formatCellValue(undefined)).toBe("NULL");
    expect(formatCellValue(true)).toBe("true");
    expect(formatCellValue(42.5)).toBe("42.5");
    expect(formatCellValue(date)).toBe("2024-02-03 04:05:06");
    expect(formatCellValue({ theme: "nord" }, 50)).toBe('{"theme":"nord"}');
    expect(formatCellValue("hello\nworld\t!", 20)).toBe("hello↵world→!");
  });

  test("truncates long strings and object displays to the requested width", () => {
    expect(truncate("short", 10)).toBe("short");
    expect(truncate("truncate-me", 5)).toBe("trun…");
    expect(formatCellValue({ long: "abcdefghijklmnopqrstuvwxyz" }, 12)).toBe('{"long":"ab…');
  });

  test("maps database types to semantic theme tokens", () => {
    expect(getTypeColor("int4")).toBe("typeNumber");
    expect(getTypeColor("boolean")).toBe("typeBool");
    expect(getTypeColor("timestamp with time zone")).toBe("typeDate");
    expect(getTypeColor("jsonb")).toBe("typeJson");
    expect(getTypeColor("uuid")).toBe("typeString");
    expect(getTypeColor("bytea")).toBe("text");
  });

  test("formats row counts and generates ids", () => {
    expect(formatRowCount(12)).toBe("12");
    expect(formatRowCount(1530)).toBe("1.5K");
    expect(formatRowCount(2_500_000)).toBe("2.5M");

    const first = generateId();
    const second = generateId();

    expect(first).toMatch(/^[a-z0-9]+$/);
    expect(second).toMatch(/^[a-z0-9]+$/);
    expect(first).not.toBe(second);
  });
});
