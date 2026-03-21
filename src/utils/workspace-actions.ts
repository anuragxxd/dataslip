import { buildSelectAllQuery } from "./sql";
import { useUIStore } from "../store/ui";
import { useQueryStore } from "../store/query";
import { useTableDataStore } from "../store/table-data";
import { useWorkspaceStore } from "../store/workspaces";

export function activateWorkspaceWithUi(workspaceId: string) {
  const workspaceStore = useWorkspaceStore.getState();
  workspaceStore.activateWorkspace(workspaceId);

  const activeWorkspace = workspaceStore.getActiveWorkspace();
  useUIStore.getState().setActivePanel(activeWorkspace?.lastPanel || "sidebar");
}

export function closeWorkspaceWithUi(workspaceId: string) {
  const workspaceStore = useWorkspaceStore.getState();
  const workspace = workspaceStore.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) return;

  workspaceStore.closeWorkspace(workspaceId);

  if (workspace.kind === "query") {
    useQueryStore.getState().removeWorkspace(workspaceId);
  } else {
    useTableDataStore.getState().removeWorkspace(workspaceId);
  }

  const nextWorkspace = workspaceStore.getActiveWorkspace();
  useUIStore.getState().setActivePanel(nextWorkspace?.lastPanel || "sidebar");
}

export function openBlankQueryWorkspace() {
  const workspaceId = useWorkspaceStore.getState().openQueryWorkspace();
  useQueryStore.getState().initWorkspace(workspaceId);
  useUIStore.getState().setActivePanel("query");
  return workspaceId;
}

export function openSeededQueryWorkspace(schema: string, table: string) {
  const workspaceId = useWorkspaceStore.getState().openQueryWorkspace(
    `SQL: ${table}`,
    { schema, table }
  );
  useQueryStore
    .getState()
    .initWorkspace(workspaceId, buildSelectAllQuery(schema, table));
  useUIStore.getState().setActivePanel("query");
  return workspaceId;
}
