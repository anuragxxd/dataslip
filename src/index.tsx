#!/usr/bin/env bun
import { createCliRenderer } from "@opentui/core";
import { createRoot, useRenderer } from "@opentui/react";
import React, { useEffect } from "react";
import { App } from "./app";
import { enableLogging, getLogPath, logInfo } from "./utils/logger";
import { getSetting } from "./storage";
import { useUIStore } from "./store/ui";
import { getThemeById, DEFAULT_THEME_ID } from "./theme/registry";

// Always enable logging so users can debug
enableLogging();

function Root() {
  const renderer = useRenderer();

  useEffect(() => {
    renderer.setTerminalTitle("DataSlip");
  }, []);

  return <App />;
}

async function main() {
  logInfo("Initializing renderer");

  // Load persisted theme before rendering
  try {
    const savedThemeId = getSetting("themeId");
    if (savedThemeId) {
      // Validate that the saved theme still exists
      const themeDef = getThemeById(savedThemeId);
      if (themeDef) {
        useUIStore.getState().setThemeId(savedThemeId);
        logInfo(`Loaded saved theme: ${savedThemeId}`);
      }
    }
  } catch {
    // Ignore errors loading theme — will use default
  }

  const renderer = await createCliRenderer();
  logInfo("Renderer created, mounting React tree");
  createRoot(renderer).render(<Root />);
}

main().catch((err) => {
  console.error("DataSlip failed to start:", err);
  process.exit(1);
});
