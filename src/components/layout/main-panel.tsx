import React from "react";
import { DataGrid } from "../table/data-grid";
import { QueryPanel } from "../query/query-panel";
import { useUIStore } from "../../store/ui";
import { useQueryStore } from "../../store/query";

interface MainPanelProps {
  width: number;
  height: number;
}

export function MainPanel({ width, height }: MainPanelProps) {
  const { activePanel, activeDialog } = useUIStore();
  const { isOpen } = useQueryStore();

  return (
    <box style={{ flexGrow: 1, height }}>
      {isOpen ? (
        <QueryPanel width={width} height={height} />
      ) : (
        <DataGrid
          focused={activePanel === "grid" && activeDialog === "none"}
          width={width}
          height={height}
        />
      )}
    </box>
  );
}
