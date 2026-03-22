import { describe, expect, test } from "bun:test";
import type { ConnectionConfig } from "../../src/db/types";
import { createConnectionsStore } from "../../src/store/connections";

function createBaseConfig(overrides: Partial<ConnectionConfig> = {}): ConnectionConfig {
  return {
    id: "conn-1",
    name: "Local DB",
    host: "localhost",
    port: 5432,
    database: "dataslip",
    username: "postgres",
    password: "secret",
    ssl: "disable",
    createdAt: 10,
    updatedAt: 10,
    ...overrides,
  };
}

describe("connections store", () => {
  test("loads, adds, updates, and removes connections through storage", () => {
    const saved: ConnectionConfig[] = [];
    const deleted: string[] = [];
    const store = createConnectionsStore({
      storage: {
        getAllConnections: () => [createBaseConfig()],
        saveConnection: (connection) => {
          saved.push(connection);
        },
        deleteConnection: (id) => {
          deleted.push(id);
        },
      },
      connectionManager: {
        connect: async () => ({}) as any,
        disconnect: async () => undefined,
        testConnection: async () => ({ ok: true }),
      },
      generateId: () => "generated-id",
      now: () => 42,
      logInfo: () => {},
      logError: () => {},
      getLogPath: () => "/tmp/dataslip.log",
    });

    store.getState().loadConnections();
    expect(store.getState().connections).toEqual([createBaseConfig()]);

    const created = store.getState().addConnection({
      name: "Staging",
      host: "staging.internal",
      port: 5433,
      database: "app",
      username: "svc",
      password: "pw",
      ssl: "require",
      color: "blue",
    });
    expect(created).toEqual({
      id: "generated-id",
      name: "Staging",
      host: "staging.internal",
      port: 5433,
      database: "app",
      username: "svc",
      password: "pw",
      ssl: "require",
      color: "blue",
      createdAt: 42,
      updatedAt: 42,
    });
    expect(saved[0]).toEqual(created);

    store.getState().updateConnection("generated-id", { host: "staging-2.internal" });
    expect(saved[1]).toEqual({ ...created, host: "staging-2.internal", updatedAt: 42 });

    store.getState().removeConnection("generated-id");
    expect(deleted).toEqual(["generated-id"]);
    expect(store.getState().connections).toEqual([createBaseConfig()]);
  });

  test("connects successfully and tracks the active connection", async () => {
    const connected: string[] = [];
    const infos: string[] = [];
    const store = createConnectionsStore({
      storage: {
        getAllConnections: () => [],
        saveConnection: () => {},
        deleteConnection: () => {},
      },
      connectionManager: {
        connect: async (config) => {
          connected.push(config.id);
          return {} as any;
        },
        disconnect: async () => undefined,
        testConnection: async () => ({ ok: true }),
      },
      generateId: () => "generated-id",
      now: () => 42,
      logInfo: (message) => {
        infos.push(message);
      },
      logError: () => {},
      getLogPath: () => "/tmp/dataslip.log",
    });

    store.setState({ connections: [createBaseConfig()] });
    const success = await store.getState().connectTo("conn-1");

    expect(success).toBe(true);
    expect(connected).toEqual(["conn-1"]);
    expect(store.getState()).toMatchObject({
      activeConnectionId: "conn-1",
      isConnecting: false,
      connectError: null,
    });
    expect(infos).toEqual(["connectTo called"]);
  });

  test("surfaces connection and test errors with the log path", async () => {
    const errors: string[] = [];
    const store = createConnectionsStore({
      storage: {
        getAllConnections: () => [],
        saveConnection: () => {},
        deleteConnection: () => {},
      },
      connectionManager: {
        connect: async () => {
          throw new Error("authentication failed");
        },
        disconnect: async () => undefined,
        testConnection: async () => ({ ok: false, error: "timeout" }),
      },
      generateId: () => "generated-id",
      now: () => 42,
      logInfo: () => {},
      logError: (message) => {
        errors.push(message);
      },
      getLogPath: () => "/tmp/dataslip.log",
    });

    store.setState({ connections: [createBaseConfig()] });
    const connected = await store.getState().connectTo("conn-1");
    await store.getState().testConnectionConfig({
      name: "Local DB",
      host: "localhost",
      port: 5432,
      database: "dataslip",
      username: "postgres",
      password: "secret",
      ssl: "disable",
    });

    expect(connected).toBe(false);
    expect(store.getState().connectError).toBe("authentication failed (see /tmp/dataslip.log)");
    expect(store.getState().testResult).toEqual({
      ok: false,
      error: "timeout (see /tmp/dataslip.log)",
    });
    expect(store.getState().isTesting).toBe(false);
    expect(errors).toEqual(["connectTo failed"]);
  });

  test("disconnects, clears test results, and resets state", async () => {
    let disconnects = 0;
    const store = createConnectionsStore({
      storage: {
        getAllConnections: () => [],
        saveConnection: () => {},
        deleteConnection: () => {},
      },
      connectionManager: {
        connect: async () => ({}) as any,
        disconnect: async () => {
          disconnects += 1;
        },
        testConnection: async () => ({ ok: true, latency: 12 }),
      },
      generateId: () => "generated-id",
      now: () => 42,
      logInfo: () => {},
      logError: () => {},
      getLogPath: () => "/tmp/dataslip.log",
    });

    store.setState({
      connections: [createBaseConfig()],
      activeConnectionId: "conn-1",
      connectError: "boom",
      testResult: { ok: true, latency: 12 },
    });

    await store.getState().disconnectCurrent();
    store.getState().clearTestResult();
    store.getState().reset();

    expect(disconnects).toBe(1);
    expect(store.getState()).toMatchObject({
      connections: [],
      activeConnectionId: null,
      connectError: null,
      testResult: null,
      isConnecting: false,
      isTesting: false,
    });
  });
});
