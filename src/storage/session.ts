/**
 * Session persistence — saves and restores workspace state across restarts.
 *
 * Stored as a single JSON blob in the `settings` table under the key
 * `workspaceSession.v1`. We persist only lightweight metadata and
 * user-entered text (query SQL). Live query results, loading states,
 * and edit state are NOT persisted.
 */

import { getJsonSetting, setJsonSetting, deleteSetting } from "./index";
import { logInfo, logWarn, logDebug } from "../utils/logger";

// ─── Types ────────────────────────────────────────────────────

export interface PersistedTableState {
  schema: string;
  table: string;
  relationType: "table" | "view";
  page: number;
  pageSize: number;
  orderBy: string | null;
  orderDir: "ASC" | "DESC";
  selectedRow: number;
  selectedCol: number;
  scrollOffsetX: number;
}

export interface PersistedQueryState {
  queryText: string;
}

export interface PersistedWorkspace {
  id: string;
  kind: "table" | "query";
  title: string;
  subtitle?: string;
  lastPanel: "grid" | "query" | "query-results";
  source?: {
    schema?: string;
    table?: string;
    relationType?: "table" | "view";
  };
  createdAt: number;
  lastActiveAt: number;
}

export interface PersistedSession {
  version: 1;
  connectionId: string | null;
  activeWorkspaceId: string | null;
  workspaces: PersistedWorkspace[];
  tableStateByWorkspaceId: Record<string, PersistedTableState>;
  queryStateByWorkspaceId: Record<string, PersistedQueryState>;
  tree?: {
    selectedNodeId: string | null;
    expandedNodeIds: string[];
  };
}

const SESSION_KEY = "workspaceSession.v1";

// ─── Save ─────────────────────────────────────────────────────

export function saveSession(session: PersistedSession): void {
  try {
    setJsonSetting(SESSION_KEY, session);
    logDebug("Session saved", {
      workspaces: session.workspaces.length,
      connectionId: session.connectionId,
    });
  } catch (err: any) {
    logWarn("Failed to save session", { error: err.message });
  }
}

export function clearSession(): void {
  try {
    deleteSetting(SESSION_KEY);
    logDebug("Session cleared");
  } catch (err: any) {
    logWarn("Failed to clear session", { error: err.message });
  }
}

// ─── Load ─────────────────────────────────────────────────────

export function loadSession(): PersistedSession | null {
  try {
    const data = getJsonSetting<PersistedSession>(SESSION_KEY);
    if (!data) return null;
    if (data.version !== 1) {
      logWarn("Unknown session version, ignoring", { version: (data as any).version });
      return null;
    }
    logInfo("Session loaded", {
      workspaces: data.workspaces.length,
      connectionId: data.connectionId,
    });
    return data;
  } catch (err: any) {
    logWarn("Failed to load session", { error: err.message });
    return null;
  }
}

// ─── Debounced save ───────────────────────────────────────────

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function hasPendingSessionSave(): boolean {
  return saveTimer !== null;
}

/**
 * Schedule a session save. Debounces to avoid writing on every keystroke
 * in the query editor. Fires after 2 seconds of inactivity.
 */
export function debouncedSaveSession(session: PersistedSession): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveSession(session);
    saveTimer = null;
  }, 2000);
}

/**
 * Flush any pending debounced save immediately (call on disconnect/exit).
 */
export function flushPendingSave(session?: PersistedSession): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (session) {
    saveSession(session);
  }
}

export function resetSessionSaveState(): void {
  if (!saveTimer) return;
  clearTimeout(saveTimer);
  saveTimer = null;
}
