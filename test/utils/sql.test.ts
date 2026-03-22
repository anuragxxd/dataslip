import { describe, expect, test } from "bun:test";
import {
  buildSelectAllQuery,
  buildUpdateQuery,
  cellValueToEditString,
  escapeLikePattern,
  formatDisplayValue,
  formatFilterClauseLabel,
  formatFiltersSummary,
  formatValueForSql,
  getFilterOperators,
  isBooleanType,
  isDateLikeType,
  isNumericType,
  isTextLikeType,
  operatorNeedsValue,
  quoteIdentifier,
  quoteValue,
  validateValueForType,
} from "../../src/utils/sql";

describe("sql utils", () => {
  test("quotes identifiers and values safely", () => {
    expect(quoteIdentifier('weird"name')).toBe('"weird""name"');
    expect(quoteValue("O'Hara")).toBe("'O''Hara'");
  });

  test("classifies column types and available operators", () => {
    expect(isBooleanType("BOOLEAN")).toBe(true);
    expect(isNumericType("numeric")).toBe(true);
    expect(isDateLikeType("timestamp with time zone")).toBe(true);
    expect(isTextLikeType("citext")).toBe(true);
    expect(operatorNeedsValue("contains")).toBe(true);
    expect(operatorNeedsValue("is_null")).toBe(false);
    expect(getFilterOperators("text")).toEqual([
      "contains",
      "starts_with",
      "=",
      "!=",
      "is_null",
      "is_not_null",
    ]);
    expect(getFilterOperators("int4")).toEqual([
      "=",
      "!=",
      ">",
      ">=",
      "<",
      "<=",
      "is_null",
      "is_not_null",
    ]);
  });

  test("escapes LIKE patterns and formats filter summaries", () => {
    expect(escapeLikePattern("50%_off\\today")).toBe("50\\%\\_off\\\\today");
    expect(
      formatFilterClauseLabel({
        id: "1",
        column: "name",
        columnType: "text",
        operator: "starts_with",
        value: "Ada",
      })
    ).toBe("name starts with Ada");
    expect(
      formatFiltersSummary([
        {
          id: "1",
          column: "name",
          columnType: "text",
          operator: "starts_with",
          value: "Ada",
        },
        {
          id: "2",
          column: "deleted_at",
          columnType: "timestamp",
          operator: "is_null",
        },
      ])
    ).toBe("name starts with Ada, deleted_at is null");
  });

  test("formats SQL literals by column type", () => {
    expect(formatValueForSql("42", "int4", false)).toBe("42");
    expect(formatValueForSql("3.14", "numeric", false)).toBe("3.14");
    expect(formatValueForSql("yes", "boolean", false)).toBe("TRUE");
    expect(formatValueForSql("no", "boolean", false)).toBe("FALSE");
    expect(formatValueForSql("not-a-number", "int4", false)).toBe("'not-a-number'");
    expect(formatValueForSql("hello", "text", false)).toBe("'hello'");
    expect(formatValueForSql("ignored", "text", true)).toBe("NULL");
  });

  test("validates integers, numerics, money, booleans, json, and uuids", () => {
    expect(validateValueForType("7", "int4", false)).toBeNull();
    expect(validateValueForType("7.2", "int4", false)).toBe('Invalid integer value: "7.2"');
    expect(validateValueForType("7.2", "numeric", false)).toBeNull();
    expect(validateValueForType("abc", "numeric", false)).toBe('Invalid numeric value: "abc"');
    expect(validateValueForType("$12.50", "money", false)).toBeNull();
    expect(validateValueForType("t", "bool", false)).toBeNull();
    expect(validateValueForType("maybe", "bool", false)).toContain("Invalid boolean value");
    expect(validateValueForType('{"ok":true}', "jsonb", false)).toBeNull();
    expect(validateValueForType("{oops", "json", false)).toContain("Invalid JSON");
    expect(validateValueForType("550e8400-e29b-41d4-a716-446655440000", "uuid", false)).toBeNull();
    expect(validateValueForType("bad-uuid", "uuid", false)).toContain("Invalid UUID format");
    expect(validateValueForType("", "text", false)).toBeNull();
    expect(validateValueForType("anything", "text", true)).toBeNull();
  });

  test("formats edit and display values consistently", () => {
    const date = new Date("2024-01-02T03:04:05.000Z");

    expect(cellValueToEditString(null)).toBe("");
    expect(cellValueToEditString(true)).toBe("true");
    expect(cellValueToEditString(date)).toBe("2024-01-02 03:04:05");
    expect(cellValueToEditString({ theme: "nord" })).toBe('{"theme":"nord"}');

    expect(formatDisplayValue(null)).toBe("NULL");
    expect(formatDisplayValue("Ada")).toBe('"Ada"');
    expect(formatDisplayValue(false)).toBe("false");
    expect(formatDisplayValue(date)).toBe("2024-01-02 03:04:05");
    expect(formatDisplayValue({ theme: "nord" })).toBe('{"theme":"nord"}');
  });

  test("builds update and select statements with quoted identifiers", () => {
    const sql = buildUpdateQuery(
      "public",
      "users",
      "name",
      "text",
      "Grace",
      false,
      ["id", "tenant_id", "active"],
      {
        id: 7,
        tenant_id: "tenant-1",
        active: true,
      }
    );

    expect(sql).toBe(
      'UPDATE "public"."users"\n' +
        'SET "name" = \'Grace\'\n' +
        'WHERE "id" = 7 AND "tenant_id" = \'tenant-1\' AND "active" = TRUE;'
    );
    expect(buildSelectAllQuery("public", "users", 25)).toBe(
      'SELECT *\nFROM "public"."users"\nLIMIT 25;'
    );
  });
});
