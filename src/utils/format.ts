// Format cell values for display in the data grid
export function formatCellValue(value: unknown, maxWidth: number = 30): string {
  if (value === null || value === undefined) {
    return "NULL";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  }

  if (typeof value === "object") {
    const json = JSON.stringify(value);
    return truncate(json, maxWidth);
  }

  const str = String(value);
  // Replace newlines with visible markers
  const cleaned = str.replace(/\n/g, "↵").replace(/\r/g, "").replace(/\t/g, "→");
  return truncate(cleaned, maxWidth);
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + "…";
}

// Get display color for a data type
export function getTypeColor(type: string): string {
  const t = type.toLowerCase();
  if (
    t.includes("int") ||
    t.includes("float") ||
    t.includes("numeric") ||
    t.includes("decimal") ||
    t.includes("real") ||
    t.includes("double") ||
    t === "serial" ||
    t === "bigserial"
  ) {
    return "typeNumber";
  }
  if (t === "bool" || t === "boolean") {
    return "typeBool";
  }
  if (
    t.includes("timestamp") ||
    t.includes("date") ||
    t.includes("time") ||
    t.includes("interval")
  ) {
    return "typeDate";
  }
  if (t === "json" || t === "jsonb") {
    return "typeJson";
  }
  if (
    t.includes("char") ||
    t.includes("text") ||
    t === "varchar" ||
    t === "name" ||
    t === "uuid"
  ) {
    return "typeString";
  }
  return "text";
}

// Format row count for display
export function formatRowCount(count: number): string {
  if (count < 1000) return String(count);
  if (count < 1_000_000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1_000_000).toFixed(1)}M`;
}

// Generate a unique ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
