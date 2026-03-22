import { create } from "zustand";
import { generateId } from "../utils/format";
import type { PersistedSession } from "../storage/session";

// ─── Types ────────────────────────────────────────────────────

export type WorkspaceKind = "table" | "query";

export interface WorkspaceMeta {
  id: string;
  kind: WorkspaceKind;
  title: string;
  subtitle?: string;
  dirty: boolean;
  lastPanel: "grid" | "query" | "query-results";
  source?: {
    schema?: string;
    table?: string;
    relationType?: "table" | "view";
  };
  createdAt: number;
  lastActiveAt: number;
}

function getTableTabTitle(schema: string, table: string) {
  return schema === "public" ? table : `${schema}.${table}`;
}

interface WorkspaceState {
  workspaces: WorkspaceMeta[];
  activeWorkspaceId: string | null;

  // Actions
  openTableWorkspace: (
    schema: string,
    table: string,
    relationType?: "table" | "view"
  ) => { id: string; created: boolean };
  openQueryWorkspace: (initialTitle?: string, source?: WorkspaceMeta["source"]) => string;
  activateWorkspace: (id: string) => void;
  closeWorkspace: (id: string) => void;
  nextWorkspace: () => void;
  prevWorkspace: () => void;
  updateWorkspaceMeta: (id: string, patch: Partial<WorkspaceMeta>) => void;
  getActiveWorkspace: () => WorkspaceMeta | null;
  restoreFromSession: (session: PersistedSession) => void;
  reset: () => void;
}

export function createWorkspaceStore() {
  return create<WorkspaceState>((set, get) => ({
    workspaces: [],
    activeWorkspaceId: null,

    openTableWorkspace: (schema, table, relationType = "table") => {
      const existing = get().workspaces.find(
        (workspace) =>
          workspace.kind === "table" &&
          workspace.source?.schema === schema &&
          workspace.source?.table === table &&
          workspace.source?.relationType === relationType
      );

      if (existing) {
        get().activateWorkspace(existing.id);
        return { id: existing.id, created: false };
      }

      const id = generateId();
      const now = Date.now();
      const meta: WorkspaceMeta = {
        id,
        kind: "table",
        title: getTableTabTitle(schema, table),
        subtitle: schema !== "public" ? schema : undefined,
        dirty: false,
        lastPanel: "grid",
        source: { schema, table, relationType },
        createdAt: now,
        lastActiveAt: now,
      };
      set((state) => ({
        workspaces: [...state.workspaces, meta],
        activeWorkspaceId: id,
      }));
      return { id, created: true };
    },

    openQueryWorkspace: (initialTitle, source) => {
      const id = generateId();
      const now = Date.now();
      const queryCount = get().workspaces.filter((w) => w.kind === "query").length;
      const meta: WorkspaceMeta = {
        id,
        kind: "query",
        title: initialTitle || `Query ${queryCount + 1}`,
        dirty: false,
        lastPanel: "query",
        source,
        createdAt: now,
        lastActiveAt: now,
      };
      set((state) => ({
        workspaces: [...state.workspaces, meta],
        activeWorkspaceId: id,
      }));
      return id;
    },

    activateWorkspace: (id) => {
      set((state) => ({
        activeWorkspaceId: id,
        workspaces: state.workspaces.map((w) =>
          w.id === id ? { ...w, lastActiveAt: Date.now() } : w
        ),
      }));
    },

    closeWorkspace: (id) => {
      const { workspaces, activeWorkspaceId } = get();
      const idx = workspaces.findIndex((w) => w.id === id);
      if (idx === -1) return;

      const remaining = workspaces.filter((w) => w.id !== id);

      let nextActiveId: string | null = null;
      if (remaining.length > 0) {
        if (id === activeWorkspaceId) {
          const nextIdx = Math.min(idx, remaining.length - 1);
          nextActiveId = remaining[nextIdx].id;
        } else {
          nextActiveId = activeWorkspaceId;
        }
      }

      set({
        workspaces: remaining,
        activeWorkspaceId: nextActiveId,
      });
    },

    nextWorkspace: () => {
      const { workspaces, activeWorkspaceId } = get();
      if (workspaces.length <= 1) return;
      const idx = workspaces.findIndex((w) => w.id === activeWorkspaceId);
      const nextIdx = (idx + 1) % workspaces.length;
      get().activateWorkspace(workspaces[nextIdx].id);
    },

    prevWorkspace: () => {
      const { workspaces, activeWorkspaceId } = get();
      if (workspaces.length <= 1) return;
      const idx = workspaces.findIndex((w) => w.id === activeWorkspaceId);
      const prevIdx = (idx - 1 + workspaces.length) % workspaces.length;
      get().activateWorkspace(workspaces[prevIdx].id);
    },

    updateWorkspaceMeta: (id, patch) => {
      set((state) => ({
        workspaces: state.workspaces.map((w) =>
          w.id === id ? { ...w, ...patch } : w
        ),
      }));
    },

    getActiveWorkspace: () => {
      const { workspaces, activeWorkspaceId } = get();
      return workspaces.find((w) => w.id === activeWorkspaceId) || null;
    },

    restoreFromSession: (session) => {
      const workspaces: WorkspaceMeta[] = session.workspaces.map((persistedWorkspace) => ({
        id: persistedWorkspace.id,
        kind: persistedWorkspace.kind,
        title: persistedWorkspace.title,
        subtitle: persistedWorkspace.subtitle,
        dirty: false,
        lastPanel: persistedWorkspace.lastPanel,
        source: persistedWorkspace.source,
        createdAt: persistedWorkspace.createdAt,
        lastActiveAt: persistedWorkspace.lastActiveAt,
      }));

      set({
        workspaces,
        activeWorkspaceId: session.activeWorkspaceId,
      });
    },

    reset: () => {
      set({
        workspaces: [],
        activeWorkspaceId: null,
      });
    },
  }));
}

export const useWorkspaceStore = createWorkspaceStore();
