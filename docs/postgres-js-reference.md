# postgres.js Reference for TUI Database Editor

> Library: [`postgres`](https://github.com/porsager/postgres) (npm: `postgres`)
> Runtimes: Node.js, Deno, Bun, Cloudflare Workers

---

## 1. Connection

### Install

```bash
npm install postgres   # or
bun add postgres
```

### Connection String

```ts
import postgres from 'postgres'

const sql = postgres('postgres://username:password@host:port/database')
```

### Options Object

```ts
const sql = postgres({
  host:            'localhost',
  port:            5432,
  database:        'mydb',
  username:        'user',
  password:        'secret',
  ssl:             false,          // true | 'prefer' | 'require' | tls options
  max:             10,             // max pool connections
  idle_timeout:    20,             // seconds before closing idle conn
  max_lifetime:    60 * 30,        // max conn lifetime in seconds
  connect_timeout: 30,             // connection timeout in seconds
  prepare:         true,           // auto prepared statements
  fetch_types:     true,           // auto-fetch pg array types
  onnotice:        () => {},       // silence NOTICE messages
  debug:           (conn, query, params, types) => {
    console.log(query, params)
  },
  connection: {
    application_name: 'dataslip',
  },
  transform: postgres.camel,      // optional: snake_case <-> camelCase
})
```

### Environment Variables (zero-config)

```ts
// Falls back to PGHOST, PGPORT, PGDATABASE, PGUSER/PGUSERNAME, PGPASSWORD
const sql = postgres()
```

### Dynamic Password (rotating tokens, IAM)

```ts
const sql = postgres({
  host: 'rds.amazonaws.com',
  password: async () => await getIAMToken(),
})
```

---

## 2. Queries

### Basic Parameterized Query (safe by default)

```ts
const age = 25
const users = await sql`
  SELECT id, name, age
  FROM users
  WHERE age > ${age}
`
// Result: [{ id: 1, name: 'Alice', age: 30 }, ...]
```

Parameters are sent separately via the PG protocol — **SQL injection is impossible** with tagged templates.

### Insert with Returning

```ts
const [user] = await sql`
  INSERT INTO users (name, age)
  VALUES (${'Alice'}, ${30})
  RETURNING *
`
```

### Dynamic Inserts (from objects)

```ts
const user = { name: 'Alice', age: 30 }
await sql`INSERT INTO users ${sql(user, 'name', 'age')}`
// -> INSERT INTO users ("name", "age") VALUES ($1, $2)

// Bulk insert
const users = [
  { name: 'Alice', age: 30 },
  { name: 'Bob',   age: 25 },
]
await sql`INSERT INTO users ${sql(users, 'name', 'age')}`
// -> INSERT INTO users ("name","age") VALUES ($1,$2),($3,$4)
```

### Dynamic Updates

```ts
const changes = { name: 'Alice Updated', age: 31 }
await sql`
  UPDATE users SET ${sql(changes, 'name', 'age')}
  WHERE id = ${1}
`
```

### Dynamic Column Selection

```ts
const columns = ['id', 'name', 'email']
const rows = await sql`SELECT ${sql(columns)} FROM users`
```

### Dynamic Table/Identifier Names

```ts
const table = 'users'
const column = 'id'
await sql`SELECT ${sql(column)} FROM ${sql(table)}`
// -> SELECT "id" FROM "users"
```

### WHERE IN

```ts
const ids = [1, 2, 3]
const rows = await sql`SELECT * FROM users WHERE id IN ${sql(ids)}`
```

### Conditional / Dynamic Fragments

```ts
const search = 'alice'
const minAge = 18

const rows = await sql`
  SELECT * FROM users
  WHERE true
  ${search ? sql`AND name ILIKE ${'%' + search + '%'}` : sql``}
  ${minAge ? sql`AND age >= ${minAge}` : sql``}
  ORDER BY id
`
```

### Raw / Unsafe Queries (for DDL, dynamic SQL)

```ts
// ⚠️ Only use when you control the input — no injection protection
const result = await sql.unsafe(
  'SELECT * FROM users WHERE id = $1',
  [42]
)

// Fully dynamic (dangerous if user-controlled)
await sql.unsafe(`DROP TABLE IF EXISTS ${tableName}`)
```

You can also nest `sql.unsafe` inside safe templates:

```ts
const eventType = 'INSERT' // controlled value
await sql`
  CREATE TRIGGER my_trigger
  AFTER ${sql.unsafe(eventType)} ON users
  FOR EACH ROW EXECUTE FUNCTION my_fn()
`
```

### TypeScript Typed Queries

```ts
interface User {
  id: number
  name: string
  email: string
}

const users = await sql<User[]>`SELECT * FROM users`
users[0].name // string
```

---

## 3. Schema Introspection Queries

These are standard PostgreSQL catalog queries executed via postgres.js.

### List Databases

```ts
const databases = await sql`
  SELECT datname AS name,
         pg_catalog.pg_get_userbyid(datdba) AS owner,
         pg_encoding_to_char(encoding) AS encoding,
         datcollate AS collation
  FROM pg_database
  WHERE datistemplate = false
  ORDER BY datname
`
```

### List Schemas

```ts
const schemas = await sql`
  SELECT schema_name AS name,
         schema_owner AS owner
  FROM information_schema.schemata
  WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
  ORDER BY schema_name
`
```

### List Tables in a Schema

```ts
async function listTables(schema = 'public') {
  return await sql`
    SELECT table_name AS name,
           table_type AS type,
           (
             SELECT obj_description(c.oid)
             FROM pg_class c
             JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE c.relname = t.table_name
               AND n.nspname = t.table_schema
           ) AS comment
    FROM information_schema.tables t
    WHERE table_schema = ${schema}
    ORDER BY table_name
  `
}
```

### List Columns of a Table (types, nullable, defaults, constraints)

```ts
async function listColumns(schema: string, table: string) {
  return await sql`
    SELECT
      c.column_name          AS name,
      c.ordinal_position     AS position,
      c.data_type            AS data_type,
      c.udt_name             AS udt_name,
      c.character_maximum_length AS max_length,
      c.numeric_precision,
      c.numeric_scale,
      c.is_nullable = 'YES'  AS nullable,
      c.column_default       AS default_value,
      c.is_identity = 'YES'  AS is_identity,
      (
        SELECT true
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = c.table_schema
          AND tc.table_name = c.table_name
          AND kcu.column_name = c.column_name
        LIMIT 1
      ) AS is_primary_key,
      col_description(
        (quote_ident(c.table_schema) || '.' || quote_ident(c.table_name))::regclass,
        c.ordinal_position
      ) AS comment
    FROM information_schema.columns c
    WHERE c.table_schema = ${schema}
      AND c.table_name = ${table}
    ORDER BY c.ordinal_position
  `
}
```

### List Indexes

```ts
async function listIndexes(schema: string, table: string) {
  return await sql`
    SELECT
      i.relname            AS index_name,
      ix.indisunique       AS is_unique,
      ix.indisprimary      AS is_primary,
      am.amname            AS index_type,
      ARRAY_AGG(a.attname ORDER BY array_position(ix.indkey, a.attnum))
                           AS columns,
      pg_get_indexdef(ix.indexrelid) AS definition
    FROM pg_index ix
    JOIN pg_class t  ON t.oid = ix.indrelid
    JOIN pg_class i  ON i.oid = ix.indexrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_am am    ON am.oid = i.relam
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
    WHERE n.nspname = ${schema}
      AND t.relname = ${table}
    GROUP BY i.relname, ix.indisunique, ix.indisprimary, am.amname, ix.indexrelid
    ORDER BY i.relname
  `
}
```

### List Foreign Keys

```ts
async function listForeignKeys(schema: string, table: string) {
  return await sql`
    SELECT
      tc.constraint_name,
      kcu.column_name        AS column,
      ccu.table_schema       AS foreign_schema,
      ccu.table_name         AS foreign_table,
      ccu.column_name        AS foreign_column,
      rc.update_rule,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
     AND rc.constraint_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = ${schema}
      AND tc.table_name = ${table}
    ORDER BY tc.constraint_name, kcu.ordinal_position
  `
}
```

### List All Constraints (PK, FK, Unique, Check)

```ts
async function listConstraints(schema: string, table: string) {
  return await sql`
    SELECT
      tc.constraint_name,
      tc.constraint_type,
      ARRAY_AGG(kcu.column_name ORDER BY kcu.ordinal_position) AS columns
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = ${schema}
      AND tc.table_name = ${table}
    GROUP BY tc.constraint_name, tc.constraint_type
    ORDER BY tc.constraint_type, tc.constraint_name
  `
}
```

---

## 4. Row Counts

### Exact Count (slow on large tables)

```ts
const [{ count }] = await sql`
  SELECT count(*)::int AS count
  FROM ${sql(schema + '.' + table)}
`
```

### Fast Estimated Count (from pg_class stats — instant)

```ts
async function estimatedRowCount(schema: string, table: string) {
  const [row] = await sql`
    SELECT reltuples::bigint AS estimate
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = ${schema}
      AND c.relname = ${table}
  `
  return row.estimate
}
```

### Table Sizes

```ts
async function tableSize(schema: string, table: string) {
  const qualifiedName = `${schema}.${table}`
  const [row] = await sql`
    SELECT
      pg_size_pretty(pg_total_relation_size(${qualifiedName}::regclass)) AS total_size,
      pg_size_pretty(pg_relation_size(${qualifiedName}::regclass))       AS data_size,
      pg_size_pretty(pg_indexes_size(${qualifiedName}::regclass))        AS index_size
  `
  return row
}
```

---

## 5. Pagination (LIMIT / OFFSET)

### Basic LIMIT/OFFSET

```ts
async function paginatedQuery(
  schema: string,
  table: string,
  { page = 1, pageSize = 50, orderBy = 'id', direction = 'asc' }: {
    page?: number
    pageSize?: number
    orderBy?: string
    direction?: 'asc' | 'desc'
  }
) {
  const offset = (page - 1) * pageSize

  const rows = await sql`
    SELECT *
    FROM ${sql(schema + '.' + table)}
    ORDER BY ${sql(orderBy)} ${direction === 'desc' ? sql`DESC` : sql`ASC`}
    LIMIT ${pageSize}
    OFFSET ${offset}
  `
  return rows
}
```

### Keyset Pagination (more efficient for large tables)

```ts
async function keysetPaginate(
  schema: string,
  table: string,
  lastId: number | null,
  pageSize = 50,
) {
  if (lastId === null) {
    return await sql`
      SELECT * FROM ${sql(schema + '.' + table)}
      ORDER BY id ASC
      LIMIT ${pageSize}
    `
  }
  return await sql`
    SELECT * FROM ${sql(schema + '.' + table)}
    WHERE id > ${lastId}
    ORDER BY id ASC
    LIMIT ${pageSize}
  `
}
```

### Cursor-Based Streaming (for large exports)

```ts
const cursor = sql`
  SELECT * FROM large_table ORDER BY id
`.cursor(100) // 100 rows per batch

for await (const rows of cursor) {
  for (const row of rows) {
    process.stdout.write(JSON.stringify(row) + '\n')
  }
}
```

---

## 6. Connection Pooling

postgres.js has **built-in connection pooling**. No external pooler needed.

```ts
const sql = postgres({
  host:            'localhost',
  database:        'mydb',
  max:             20,            // max connections in the pool (default: 10)
  idle_timeout:    20,            // close idle connections after 20s (default: 0 = never)
  max_lifetime:    60 * 30,       // max connection lifetime 30min
  connect_timeout: 30,            // timeout for new connections
})
```

### Key behaviors

- **Lazy**: No connections open until the first query.
- **Auto-scaling**: Opens connections as needed up to `max`.
- **Auto-return**: Connections return to pool after query completes.
- **Transaction isolation**: `sql.begin()` reserves a dedicated connection.
- **Auto-reconnect**: Failed connections are replaced transparently on next query.
- **Lifetime jitter**: Default `max_lifetime` is randomized between 30-60 min to avoid thundering herd.

### Reserving a Dedicated Connection

```ts
const reserved = await sql.reserve()
try {
  await reserved`SELECT * FROM users`
  await reserved`SELECT * FROM orders`
} finally {
  await reserved.release()
}
```

### Using with PgBouncer

```ts
// PgBouncer in transaction mode requires disabling prepared statements
const sql = postgres({
  prepare: false,
})
```

### Graceful Shutdown

```ts
process.on('SIGTERM', async () => {
  await sql.end({ timeout: 5 }) // wait up to 5s for pending queries
  process.exit(0)
})
```

---

## 7. SSL / TLS Connections

### Simple SSL (trust server cert)

```ts
const sql = postgres({
  host: 'db.example.com',
  ssl: true,
})
```

### SSL Modes

```ts
// 'require' — encrypt, don't verify cert
const sql = postgres({ ssl: 'require' })

// 'prefer' — try SSL, fall back to plaintext
const sql = postgres({ ssl: 'prefer' })
```

### SSL with Certificate Verification

```ts
import { readFileSync } from 'fs'

const sql = postgres({
  host: 'db.example.com',
  ssl: {
    rejectUnauthorized: true,
    ca:   readFileSync('/path/to/ca-cert.pem'),
    key:  readFileSync('/path/to/client-key.pem'),   // optional: mTLS
    cert: readFileSync('/path/to/client-cert.pem'),   // optional: mTLS
  },
})
```

### Cloud Provider Shortcuts

```ts
// Heroku, Render, etc. (self-signed certs)
const sql = postgres({
  ssl: { rejectUnauthorized: false },
})

// Supabase, Neon (use connection string with sslmode)
const sql = postgres('postgres://user:pass@host:5432/db?sslmode=require')
```

### Direct SSL Negotiation (Postgres 17+)

```ts
const sql = postgres({
  ssl: true,
  sslnegotiation: 'direct', // skip the SSLRequest roundtrip
})
```

---

## 8. Safely Handling User-Provided SQL

### Rule 1: Always use tagged templates for values

```ts
// SAFE — parameters sent separately via PG protocol
const userInput = "Robert'; DROP TABLE users;--"
const rows = await sql`SELECT * FROM users WHERE name = ${userInput}`
// Executes: SELECT * FROM users WHERE name = $1  with params ['Robert...']
```

### Rule 2: Use sql() helper for dynamic identifiers

```ts
// SAFE — identifiers are quoted
const tableName = 'users'   // from user selection in TUI
const columnName = 'email'
await sql`SELECT ${sql(columnName)} FROM ${sql(tableName)}`
// -> SELECT "email" FROM "users"
```

### Rule 3: Validate identifiers against catalog before use

```ts
async function safeTableQuery(schema: string, table: string) {
  // Verify the table actually exists in pg_catalog
  const [exists] = await sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = ${schema}
        AND table_name = ${table}
    ) AS valid
  `
  if (!exists.valid) {
    throw new Error(`Table ${schema}.${table} does not exist`)
  }

  // Now safe to use as an identifier
  return await sql`SELECT * FROM ${sql(schema + '.' + table)} LIMIT 100`
}
```

### Rule 4: Use sql.unsafe() ONLY with fully controlled input

```ts
// For editor "run arbitrary SQL" feature — user explicitly wants this
async function executeUserSQL(rawQuery: string) {
  // This is intentionally unsafe — the user typed this SQL
  return await sql.unsafe(rawQuery)
}
```

### Rule 5: Use fragments for safe dynamic WHERE clauses

```ts
function buildWhereClause(filters: Record<string, unknown>) {
  const conditions = Object.entries(filters).map(
    ([col, val]) => sql`${sql(col)} = ${val}`
  )
  if (conditions.length === 0) return sql``

  return conditions.reduce(
    (acc, cond) => sql`${acc} AND ${cond}`
  )
}

const filters = { name: 'Alice', age: 30 }
const rows = await sql`
  SELECT * FROM users
  WHERE ${buildWhereClause(filters)}
`
```

---

## 9. Bun Compatibility

**Yes, postgres.js works with Bun.** The GitHub repo description explicitly states:

> "The Fastest full featured PostgreSQL client for Node.js, Deno, **Bun** and CloudFlare"

### Usage with Bun

```ts
// Identical API — no changes needed
import postgres from 'postgres'

const sql = postgres('postgres://user:pass@localhost:5432/mydb')
const rows = await sql`SELECT * FROM users`
console.log(rows)
await sql.end()
```

```bash
bun add postgres
bun run index.ts
```

### Known Issues

- Bun v1.1.35–1.1.37 had a bug where postgres.js queries would hang when
  using SSL connections. This was fixed in subsequent Bun releases. Use
  **Bun ≥ 1.2** for best compatibility.
- Bun 1.2+ also ships its own built-in `Bun.sql` Postgres client with an API
  *inspired by* postgres.js. You can use either — `postgres` from npm is more
  mature and battle-tested, while `Bun.sql` avoids an npm dependency.

### Bun.sql Alternative (built-in, Bun ≥ 1.2 only)

```ts
import { sql } from 'bun'

// Same tagged template API — inspired by postgres.js
const users = await sql`SELECT * FROM users WHERE active = ${true}`
```

---

## 10. Transactions

```ts
const [user, account] = await sql.begin(async (sql) => {
  const [user] = await sql`
    INSERT INTO users (name) VALUES ('Alice') RETURNING *
  `
  const [account] = await sql`
    INSERT INTO accounts (user_id) VALUES (${user.id}) RETURNING *
  `
  return [user, account]
})
// Auto COMMIT on success, auto ROLLBACK on throw
```

### Savepoints

```ts
await sql.begin(async (sql) => {
  await sql`INSERT INTO users (name) VALUES ('Alice')`

  await sql.savepoint(async (sql) => {
    await sql`INSERT INTO accounts (user_id) VALUES (999)` // may fail
  }).catch(() => {
    // savepoint rolled back, outer transaction continues
  })
})
```

---

## 11. Result Metadata

```ts
const result = await sql`UPDATE users SET age = 31 WHERE name = 'Alice'`

result.count    // number of affected rows (e.g., 1)
result.command  // 'UPDATE'
result.columns  // [{ name: 'id', type: 23 }, ...] (if SELECT)

// Access the generated SQL string
const desc = await sql`SELECT * FROM users WHERE id = ${1}`.describe()
desc.string     // 'SELECT * FROM users WHERE id = $1'
desc.types      // parameter oids
desc.columns    // column info
```

---

## 12. Full Working Example: Schema Explorer Module

```ts
import postgres from 'postgres'

export function createConnection(connectionString: string) {
  return postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    connection: {
      application_name: 'dataslip',
    },
    onnotice: () => {},  // silence notices
  })
}

export type SQL = ReturnType<typeof postgres>

export const queries = {
  databases: (sql: SQL) => sql`
    SELECT datname AS name
    FROM pg_database
    WHERE datistemplate = false
    ORDER BY datname
  `,

  schemas: (sql: SQL) => sql`
    SELECT schema_name AS name
    FROM information_schema.schemata
    WHERE schema_name NOT LIKE 'pg_%'
      AND schema_name != 'information_schema'
    ORDER BY schema_name
  `,

  tables: (sql: SQL, schema: string) => sql`
    SELECT table_name AS name, table_type AS type
    FROM information_schema.tables
    WHERE table_schema = ${schema}
    ORDER BY table_name
  `,

  columns: (sql: SQL, schema: string, table: string) => sql`
    SELECT
      c.column_name        AS name,
      c.udt_name           AS type,
      c.is_nullable = 'YES' AS nullable,
      c.column_default     AS "default",
      c.ordinal_position   AS position
    FROM information_schema.columns c
    WHERE c.table_schema = ${schema}
      AND c.table_name = ${table}
    ORDER BY c.ordinal_position
  `,

  indexes: (sql: SQL, schema: string, table: string) => sql`
    SELECT i.relname AS name,
           ix.indisunique AS is_unique,
           ix.indisprimary AS is_primary,
           pg_get_indexdef(ix.indexrelid) AS definition
    FROM pg_index ix
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = ${schema} AND t.relname = ${table}
  `,

  foreignKeys: (sql: SQL, schema: string, table: string) => sql`
    SELECT
      tc.constraint_name,
      kcu.column_name          AS column,
      ccu.table_name           AS foreign_table,
      ccu.column_name          AS foreign_column,
      rc.delete_rule,
      rc.update_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = ${schema}
      AND tc.table_name = ${table}
  `,

  rowCount: (sql: SQL, schema: string, table: string) => sql`
    SELECT reltuples::bigint AS estimate
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = ${schema} AND c.relname = ${table}
  `,

  paginate: (
    sql: SQL,
    schema: string,
    table: string,
    limit: number,
    offset: number,
  ) => sql`
    SELECT * FROM ${sql(schema + '.' + table)}
    LIMIT ${limit} OFFSET ${offset}
  `,
}
```

---

## Quick Reference: Interpolation Cheat Sheet

| Syntax | Purpose | Example |
|---|---|---|
| `${value}` | Safe parameter binding | `` sql`WHERE id = ${42}` `` |
| `${sql('name')}` | Safe identifier (column/table) | `` sql`SELECT ${sql('col')} FROM ${sql('tbl')}` `` |
| `${sql(obj, ...cols)}` | Dynamic insert/update helper | `` sql`INSERT INTO t ${sql(obj, 'a', 'b')}` `` |
| `${sql(array)}` | WHERE IN values | `` sql`WHERE id IN ${sql([1,2,3])}` `` |
| `` ${sql`fragment`} `` | Composable SQL fragment | `` sql`SELECT * ${cond ? sql`WHERE x=1` : sql``}` `` |
| `sql.unsafe(str)` | Raw SQL string (no protection) | `sql.unsafe('DROP TABLE t')` |
