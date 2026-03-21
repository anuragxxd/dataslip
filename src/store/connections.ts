import { create } from "zustand";
import type { ConnectionConfig } from "../db/types";
import * as storage from "../storage/index";
import * as connManager from "../db/connection";
import { generateId } from "../utils/format";
import { logInfo, logError } from "../utils/logger";
import { getLogPath } from "../utils/logger";

interface ConnectionsState {
  // Data
  connections: ConnectionConfig[];
  activeConnectionId: string | null;

  // Status
  isConnecting: boolean;
  connectError: string | null;
  testResult: { ok: boolean; error?: string; latency?: number } | null;
  isTesting: boolean;

  // Actions
  loadConnections: () => void;
  addConnection: (
    config: Omit<ConnectionConfig, "id" | "createdAt" | "updatedAt">
  ) => ConnectionConfig;
  updateConnection: (
    id: string,
    updates: Partial<ConnectionConfig>
  ) => void;
  removeConnection: (id: string) => void;
  connectTo: (id: string) => Promise<boolean>;
  disconnectCurrent: () => Promise<void>;
  testConnectionConfig: (
    config: Omit<ConnectionConfig, "id" | "createdAt" | "updatedAt">
  ) => Promise<void>;
  clearTestResult: () => void;
}

export const useConnectionsStore = create<ConnectionsState>((set, get) => ({
  connections: [],
  activeConnectionId: null,
  isConnecting: false,
  connectError: null,
  testResult: null,
  isTesting: false,

  loadConnections: () => {
    const connections = storage.getAllConnections();
    set({ connections });
  },

  addConnection: (config) => {
    const now = Date.now();
    const newConn: ConnectionConfig = {
      ...config,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    storage.saveConnection(newConn);
    set((state) => ({
      connections: [newConn, ...state.connections],
    }));
    return newConn;
  },

  updateConnection: (id, updates) => {
    const existing = get().connections.find((c) => c.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates, updatedAt: Date.now() };
    storage.saveConnection(updated);
    set((state) => ({
      connections: state.connections.map((c) => (c.id === id ? updated : c)),
    }));
  },

  removeConnection: (id) => {
    storage.deleteConnection(id);
    set((state) => ({
      connections: state.connections.filter((c) => c.id !== id),
    }));
  },

  connectTo: async (id) => {
    const config = get().connections.find((c) => c.id === id);
    if (!config) return false;

    logInfo("connectTo called", { id, name: config.name, host: config.host, port: config.port });
    set({ isConnecting: true, connectError: null });
    try {
      await connManager.connect(config);
      set({ activeConnectionId: id, isConnecting: false });
      return true;
    } catch (err: any) {
      const msg = err.message || String(err);
      logError("connectTo failed", { error: msg });
      set({
        isConnecting: false,
        connectError: `${msg} (see ${getLogPath()})`,
      });
      return false;
    }
  },

  disconnectCurrent: async () => {
    await connManager.disconnect();
    set({ activeConnectionId: null, connectError: null });
  },

  testConnectionConfig: async (config) => {
    logInfo("testConnectionConfig called", { host: config.host, port: config.port });
    set({ isTesting: true, testResult: null });
    const fullConfig: ConnectionConfig = {
      ...config,
      id: "test",
      createdAt: 0,
      updatedAt: 0,
    };
    const result = await connManager.testConnection(fullConfig);
    if (!result.ok) {
      result.error = `${result.error} (see ${getLogPath()})`;
    }
    set({ isTesting: false, testResult: result });
  },

  clearTestResult: () => set({ testResult: null }),
}));
