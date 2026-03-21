import { useConnectionsStore } from "../store/connections";
import { useSchemaStore } from "../store/schema";
import { useTableDataStore } from "../store/table-data";
import { useQueryStore } from "../store/query";
import { useWorkspaceStore } from "../store/workspaces";
import { useUIStore } from "../store/ui";
import { clearSession, flushPendingSave } from "../storage/session";

export async function disconnectCurrentSession() {
  flushPendingSave();
  clearSession();

  await useConnectionsStore.getState().disconnectCurrent();
  useSchemaStore.getState().reset();
  useTableDataStore.getState().reset();
  useQueryStore.getState().reset();
  useWorkspaceStore.getState().reset();

  const ui = useUIStore.getState();
  ui.resetNavigation();
  ui.setScreen("connections");
}

export function quitApp() {
  process.exit(0);
}
