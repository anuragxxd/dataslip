import React from "react";
import { SchemaTree } from "../schema/schema-tree";
import { useUIStore } from "../../store/ui";

interface SidebarProps {
  height: number;
}

export function Sidebar({ height }: SidebarProps) {
  const { activePanel, activeDialog, sidebarWidth } = useUIStore();

  return (
    <box style={{ width: sidebarWidth, height }}>
      <SchemaTree focused={activePanel === "sidebar" && activeDialog === "none"} height={height} />
    </box>
  );
}
