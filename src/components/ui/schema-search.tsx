import React, { useEffect, useMemo } from "react";
import { useTheme } from "../../theme";
import { useUIStore } from "../../store/ui";
import { useSchemaStore } from "../../store/schema";
import type { SchemaSearchItem } from "../../db/types";
import { DialogSelect, type DialogSelectOption } from "./dialog-select";

function getTypeIcon(type: SchemaSearchItem["type"]): string {
  switch (type) {
    case "schema":
      return "S";
    case "table":
      return "T";
    case "view":
      return "V";
    case "column":
      return "C";
    case "index":
      return "I";
    case "fk":
      return "F";
  }
}

function getGroupLabel(type: SchemaSearchItem["type"]): string {
  switch (type) {
    case "schema":
      return "Schemas";
    case "table":
      return "Tables";
    case "view":
      return "Views";
    case "column":
      return "Columns";
    case "index":
      return "Indexes";
    case "fk":
      return "Foreign Keys";
  }
}

function getTypePriority(type: SchemaSearchItem["type"]): number {
  switch (type) {
    case "table":
      return 120;
    case "view":
      return 110;
    case "schema":
      return 90;
    case "column":
      return 40;
    case "index":
      return 30;
    case "fk":
      return 25;
  }
}

export function SchemaSearch() {
  const theme = useTheme();
  const { closeDialog } = useUIStore();
  const { searchItems, isSearchLoading, loadSearchItems, openItem } = useSchemaStore();

  useEffect(() => {
    void loadSearchItems();
  }, [loadSearchItems]);

  const options = useMemo<DialogSelectOption<SchemaSearchItem>[]>(() => {
    return searchItems.map((item) => {
      const description =
        item.type === "schema"
          ? item.schema
          : item.table
            ? `${item.schema}.${item.table}`
            : item.schema;

      const footer = item.detail || (item.type !== "schema" ? getGroupLabel(item.type) : undefined);

      return {
        id: item.nodeId,
        value: item,
        title: item.label,
        category: getGroupLabel(item.type),
        description,
        footer,
        icon: getTypeIcon(item.type),
        iconColor:
          item.type === "table"
            ? theme.text
            : item.type === "view"
              ? theme.accentAlt
              : item.type === "schema"
                ? theme.accent
                : theme.textDim,
        keywords: [
          item.schema,
          item.table || "",
          item.detail || "",
          item.referencedSchema || "",
          item.referencedTable || "",
        ].filter(Boolean),
        priority: getTypePriority(item.type),
      };
    });
  }, [searchItems, theme.accent, theme.accentAlt, theme.text, theme.textDim]);

  return (
    <DialogSelect
      title="Search Schema"
      placeholder="Search schemas, tables, views, columns, indexes..."
      options={options}
      width={72}
      height={22}
      isLoading={isSearchLoading}
      loadingText="Loading schema catalog..."
      emptyText="No schema matches found"
      flatWhenFiltering={true}
      onClose={closeDialog}
      onSelect={(option) => {
        closeDialog();
        setTimeout(() => {
          void openItem(option.value);
        }, 0);
      }}
    />
  );
}
