import { resetConnectionState } from "../db/connection";
import { resetToastState } from "../components/ui/toast-state";
import { closeStorage } from "../storage";
import { resetSessionSaveState } from "../storage/session";
import { useConnectionsStore } from "../store/connections";
import { useQueryStore } from "../store/query";
import { useSchemaStore } from "../store/schema";
import { useTableDataStore } from "../store/table-data";
import { useUIStore } from "../store/ui";
import { useWorkspaceStore } from "../store/workspaces";
import { closeLogger } from "../utils/logger";

export function resetAllStores(): void {
  useConnectionsStore.getState().reset();
  useSchemaStore.getState().reset();
  useTableDataStore.getState().reset();
  useQueryStore.getState().reset();
  useWorkspaceStore.getState().reset();
  useUIStore.getState().reset();
}

export async function resetAppState(): Promise<void> {
  resetSessionSaveState();
  resetToastState();
  resetAllStores();
  await resetConnectionState();
  closeStorage();
  closeLogger();
}
