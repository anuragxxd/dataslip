import { create } from "zustand";
import type { ConnectionConfig } from "../db/types";
import * as storage from "../storage/index";
import * as connManager from "../db/connection";
import { generateId } from "../utils/format";
import { getLogPath, logError, logInfo } from "../utils/logger";

export interface ConnectionsStoreDependencies {
  storage: Pick<typeof storage, "getAllConnections" | "saveConnection" | "deleteConnection">;
  connectionManager: Pick<typeof connManager, "connect" | "disconnect" | "testConnection">;
  generateId: typeof generateId;
  now: () => number;
  logInfo: typeof logInfo;
  logError: typeof logError;
  getLogPath: typeof getLogPath;
}

const defaultDependencies: ConnectionsStoreDependencies = {
  storage,
  connectionManager: connManager,
  generateId,
  now: () => Date.now(),
  logInfo,
  logError,
  getLogPath,
};

interface ConnectionsState {
  connections: ConnectionConfig[];
  activeConnectionId: string | null;
  isConnecting: boolean;
  connectError: string | null;
  testResult: { ok: boolean; error?: string; latency?: number } | null;
  isTesting: boolean;
  loadConnections: () => void;
  addConnection: (
    config: Omit<ConnectionConfig, "id" | "createdAt" | "updatedAt">
  ) => ConnectionConfig;
  updateConnection: (id: string, updates: Partial<ConnectionConfig>) => void;
  removeConnection: (id: string) => void;
  connectTo: (id: string) => Promise<boolean>;
  disconnectCurrent: () => Promise<void>;
  testConnectionConfig: (
    config: Omit<ConnectionConfig, "id" | "createdAt" | "updatedAt">
  ) => Promise<void>;
  clearTestResult: () => void;
  reset: () => void;
}

function createDefaultConnectionsState() {
  return {
    connections: [],
    activeConnectionId: null,
    isConnecting: false,
    connectError: null,
    testResult: null,
    isTesting: false,
  };
}

export function createConnectionsStore(
  dependencies: ConnectionsStoreDependencies = defaultDependencies
) {
  return create<ConnectionsState>((set, get) => ({
    ...createDefaultConnectionsState(),

    loadConnections: () => {
      const connections = dependencies.storage.getAllConnections();
      set({ connections });
    },

    addConnection: (config) => {
      const now = dependencies.now();
      const newConn: ConnectionConfig = {
        ...config,
        id: dependencies.generateId(),
        createdAt: now,
        updatedAt: now,
      };
      dependencies.storage.saveConnection(newConn);
      set((state) => ({
        connections: [newConn, ...state.connections],
      }));
      return newConn;
    },

    updateConnection: (id, updates) => {
      const existing = get().connections.find((connection) => connection.id === id);
      if (!existing) return;
      const updated = { ...existing, ...updates, updatedAt: dependencies.now() };
      dependencies.storage.saveConnection(updated);
      set((state) => ({
        connections: state.connections.map((connection) =>
          connection.id === id ? updated : connection
        ),
      }));
    },

    removeConnection: (id) => {
      dependencies.storage.deleteConnection(id);
      set((state) => ({
        connections: state.connections.filter((connection) => connection.id !== id),
      }));
    },

    connectTo: async (id) => {
      const config = get().connections.find((connection) => connection.id === id);
      if (!config) return false;

      dependencies.logInfo("connectTo called", {
        id,
        name: config.name,
        host: config.host,
        port: config.port,
      });
      set({ isConnecting: true, connectError: null });
      try {
        await dependencies.connectionManager.connect(config);
        set({ activeConnectionId: id, isConnecting: false });
        return true;
      } catch (err: any) {
        const msg = err.message || String(err);
        dependencies.logError("connectTo failed", { error: msg });
        set({
          isConnecting: false,
          connectError: `${msg} (see ${dependencies.getLogPath()})`,
        });
        return false;
      }
    },

    disconnectCurrent: async () => {
      await dependencies.connectionManager.disconnect();
      set({ activeConnectionId: null, connectError: null });
    },

    testConnectionConfig: async (config) => {
      dependencies.logInfo("testConnectionConfig called", {
        host: config.host,
        port: config.port,
      });
      set({ isTesting: true, testResult: null });
      const fullConfig: ConnectionConfig = {
        ...config,
        id: "test",
        createdAt: 0,
        updatedAt: 0,
      };
      const result = await dependencies.connectionManager.testConnection(fullConfig);
      if (!result.ok) {
        result.error = `${result.error} (see ${dependencies.getLogPath()})`;
      }
      set({ isTesting: false, testResult: result });
    },

    clearTestResult: () => set({ testResult: null }),

    reset: () => set(createDefaultConnectionsState()),
  }));
}

export const useConnectionsStore = createConnectionsStore();
