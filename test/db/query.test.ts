import { describe, expect, test } from "bun:test";
import {
  buildTableQuerySql,
  executeRawQuery,
  executeUpdate,
  getPrimaryKeyColumns,
  getTableRowCount,
  queryTable,
} from "../../src/db/query";
import type { TableFilterClause } from "../../src/db/types";

function createSqlMock(options: {
  onTag?: (text: string, values: unknown[]) => Promise<unknown[]> | unknown[];
  onUnsafe?: (queryText: string) => Promise<any> | any;
}) {
  const tagCalls: Array<{ text: string; values: unknown[] }> = [];
  const unsafeCalls: string[] = [];
  const identifiers: string[] = [];

  const sql = ((first: TemplateStringsArray | string, ...values: unknown[]) => {
    if (Array.isArray(first) && "raw" in first) {
      const text = first.reduce(
        (acc, part, index) => acc + part + (index < values.length ? `$${index + 1}` : ""),
        ""
      );
      tagCalls.push({ text, values });
      return Promise.resolve(options.onTag ? options.onTag(text, values) : []);
    }

    identifiers.push(String(first));
    return { __identifier: first };
  }) as any;

  sql.unsafe = async (queryText: string) => {
    unsafeCalls.push(queryText);
    return options.onUnsafe ? options.onUnsafe(queryText) : [];
  };

  return { sql, tagCalls, unsafeCalls, identifiers };
}

describe("db query helpers", () => {
  test("buildTableQuerySql renders search, filters, sorting, and pagination", () => {
    const filters: TableFilterClause[] = [
      {
        id: "1",
        column: "status",
        columnType: "text",
        operator: "contains",
        value: "pro_%",
      },
      {
        id: "2",
        column: "age",
        columnType: "int4",
        operator: ">=",
        value: "18",
      },
      {
        id: "3",
        column: "deleted_at",
        columnType: "timestamp",
        operator: "is_null",
      },
    ];

    const sql = buildTableQuerySql(
      "public",
      "users",
      [
        { name: "name", type: "text" },
        { name: "email", type: "citext" },
        { name: "age", type: "int4" },
      ],
      {
        page: 3,
        pageSize: 25,
        orderBy: "created_at",
        orderDir: "DESC",
        quickSearch: "Ada",
        filters,
      }
    );

    expect(sql).toContain('FROM "public"."users"');
    expect(sql).toContain('"name" ILIKE \'%Ada%\' ESCAPE \'\\\'');
    expect(sql).toContain('"email" ILIKE \'%Ada%\' ESCAPE \'\\\'');
    expect(sql).toContain('"status" ILIKE \'%pro\\_\\%%\' ESCAPE \'\\\'');
    expect(sql).toContain('"age" >= 18');
    expect(sql).toContain('"deleted_at" IS NULL');
    expect(sql).toContain('ORDER BY "created_at" DESC');
    expect(sql).toContain("LIMIT 25 OFFSET 50");
  });

  test("queryTable fetches metadata first and executes the generated query", async () => {
    const { sql, tagCalls, unsafeCalls } = createSqlMock({
      onTag: async (text) => {
        if (text.includes("information_schema.columns")) {
          return [
            { column_name: "id", data_type: "integer", udt_name: "int4" },
            { column_name: "name", data_type: "text", udt_name: "text" },
          ];
        }
        return [];
      },
      onUnsafe: async () => [{ id: 1, name: "Ada" }],
    });

    const result = await queryTable(sql, "public", "users", {
      page: 2,
      pageSize: 10,
      orderBy: "name",
      orderDir: "ASC",
    });

    expect(tagCalls).toHaveLength(1);
    expect(unsafeCalls[0]).toContain('ORDER BY "name" ASC');
    expect(unsafeCalls[0]).toContain("LIMIT 10 OFFSET 10");
    expect(result).toEqual({
      columns: [
        { name: "id", type: "int4" },
        { name: "name", type: "text" },
      ],
      rows: [{ id: 1, name: "Ada" }],
      rowCount: 1,
      duration: expect.any(Number),
    });
  });

  test("getTableRowCount uses the estimated count path and falls back to exact when needed", async () => {
    const { sql, tagCalls, identifiers } = createSqlMock({
      onTag: async (text) => {
        if (text.includes("pg_catalog.pg_class")) {
          return [{ count: 0 }];
        }
        if (text.includes("SELECT count(*)::int as count")) {
          return [{ count: 12 }];
        }
        return [];
      },
    });

    const count = await getTableRowCount(sql, "public", "users");

    expect(count).toBe(12);
    expect(tagCalls).toHaveLength(2);
    expect(identifiers).toEqual(["public", "users"]);
  });

  test("getTableRowCount uses a constrained unsafe query when filters or search are present", async () => {
    const { sql, unsafeCalls } = createSqlMock({
      onTag: async () => [
        { column_name: "name", data_type: "text", udt_name: "text" },
        { column_name: "age", data_type: "integer", udt_name: "int4" },
      ],
      onUnsafe: async () => [{ count: 7 }],
    });

    const count = await getTableRowCount(sql, "public", "users", {
      quickSearch: "Ada",
      filters: [
        {
          id: "1",
          column: "age",
          columnType: "int4",
          operator: ">",
          value: "21",
        },
      ],
    });

    expect(count).toBe(7);
    expect(unsafeCalls[0]).toContain('FROM "public"."users" WHERE');
    expect(unsafeCalls[0]).toContain('"name" ILIKE \'%Ada%\' ESCAPE \'\\\'');
    expect(unsafeCalls[0]).toContain('"age" > 21');
  });

  test("gets primary key columns and executes raw update/raw queries", async () => {
    const { sql, tagCalls, unsafeCalls } = createSqlMock({
      onTag: async (text) => {
        if (text.includes("constraint_type = 'PRIMARY KEY'")) {
          return [{ column_name: "id" }, { column_name: "tenant_id" }];
        }
        return [];
      },
      onUnsafe: async (queryText) => {
        if (queryText.startsWith("UPDATE")) {
          return { count: 3 };
        }
        return [{ id: 1, name: "Ada" }];
      },
    });

    const pkColumns = await getPrimaryKeyColumns(sql, "public", "users");
    const update = await executeUpdate(sql, "UPDATE users SET name = 'Ada'");
    const raw = await executeRawQuery(sql, "SELECT id, name FROM users");

    expect(tagCalls).toHaveLength(1);
    expect(pkColumns).toEqual(["id", "tenant_id"]);
    expect(update).toEqual({ rowsAffected: 3, duration: expect.any(Number) });
    expect(unsafeCalls).toEqual([
      "UPDATE users SET name = 'Ada'",
      "SELECT id, name FROM users",
    ]);
    expect(raw).toEqual({
      columns: [
        { name: "id", type: "unknown" },
        { name: "name", type: "unknown" },
      ],
      rows: [{ id: 1, name: "Ada" }],
      rowCount: 1,
      duration: expect.any(Number),
    });
  });
});
