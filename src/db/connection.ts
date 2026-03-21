import postgres, { type Sql } from "postgres";
import type { ConnectionConfig } from "./types";
import { logInfo, logError, logDebug, logWarn } from "../utils/logger";

let activeSql: Sql | null = null;
let activeConfig: ConnectionConfig | null = null;

export function buildConnectionOptions(config: ConnectionConfig) {
  const opts = {
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: config.password,
    ssl:
      config.ssl === "disable"
        ? false
        : config.ssl === "require"
          ? { rejectUnauthorized: false }
          : config.ssl === "prefer"
            ? ("prefer" as const)
            : false,
    max: 5,
    idle_timeout: 30,
    connect_timeout: 10,
  };
  return opts;
}

export async function connect(config: ConnectionConfig): Promise<Sql> {
  if (activeSql) {
    logInfo("Disconnecting existing connection before reconnect");
    await disconnect();
  }

  const opts = buildConnectionOptions(config);
  logInfo("Connecting to database", {
    host: opts.host,
    port: opts.port,
    database: opts.database,
    username: opts.username,
    ssl: typeof opts.ssl === "object" ? "custom" : String(opts.ssl),
    connect_timeout: opts.connect_timeout,
  });

  try {
    const sql = postgres(opts);
    logDebug("postgres.js instance created, running SELECT 1...");
    const start = Date.now();
    await sql`SELECT 1`;
    logInfo("Connection successful", { latency: Date.now() - start });

    activeSql = sql;
    activeConfig = config;
    return sql;
  } catch (err: any) {
    logError("Connection failed", {
      error: err.message,
      code: err.code,
      errno: err.errno,
      stack: err.stack?.split("\n").slice(0, 3).join(" | "),
    });
    throw err;
  }
}

export async function testConnection(
  config: ConnectionConfig
): Promise<{ ok: boolean; error?: string; latency?: number }> {
  const opts = {
    ...buildConnectionOptions(config),
    max: 1,
    connect_timeout: 5,
  };

  logInfo("Testing connection", {
    host: opts.host,
    port: opts.port,
    database: opts.database,
    username: opts.username,
    ssl: typeof opts.ssl === "object" ? "custom" : String(opts.ssl),
    connect_timeout: opts.connect_timeout,
  });

  const start = Date.now();
  let sql: Sql | null = null;
  try {
    sql = postgres(opts);
    logDebug("Test: postgres.js instance created, running SELECT 1...");
    await sql`SELECT 1`;
    const latency = Date.now() - start;
    logInfo("Test connection successful", { latency });
    return { ok: true, latency };
  } catch (err: any) {
    const elapsed = Date.now() - start;
    logError("Test connection failed", {
      error: err.message,
      code: err.code,
      errno: err.errno,
      elapsed,
      stack: err.stack?.split("\n").slice(0, 5).join(" | "),
    });
    return { ok: false, error: err.message || String(err) };
  } finally {
    if (sql) {
      logDebug("Test: closing connection");
      try {
        await sql.end({ timeout: 2 });
        logDebug("Test: connection closed");
      } catch (endErr: any) {
        logWarn("Test: error closing connection", { error: endErr.message });
      }
    }
  }
}

export async function disconnect(): Promise<void> {
  if (activeSql) {
    logInfo("Disconnecting");
    try {
      await activeSql.end({ timeout: 5 });
      logInfo("Disconnected");
    } catch (err: any) {
      logWarn("Error during disconnect", { error: err.message });
    }
    activeSql = null;
    activeConfig = null;
  }
}

export function getActiveSql(): Sql | null {
  return activeSql;
}

export function getActiveConfig(): ConnectionConfig | null {
  return activeConfig;
}

export function isConnected(): boolean {
  return activeSql !== null;
}
