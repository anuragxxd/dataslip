#!/usr/bin/env bun

import { $ } from "bun";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const SUPPORTED_TARGETS = [
  "bun-linux-x64",
  "bun-darwin-x64",
  "bun-darwin-arm64",
  "bun-windows-x64",
] as const;

type BuildTarget = (typeof SUPPORTED_TARGETS)[number];

function parseArgs(argv: string[]): Map<string, string> {
  const args = new Map<string, string>();

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;

    const [key, inlineValue] = arg.split("=", 2);
    if (inlineValue !== undefined) {
      args.set(key, inlineValue);
      continue;
    }

    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      i += 1;
      continue;
    }

    args.set(key, "true");
  }

  return args;
}

function getCurrentTarget(): BuildTarget {
  const platformMap: Record<string, "linux" | "darwin" | "windows"> = {
    linux: "linux",
    darwin: "darwin",
    win32: "windows",
  };

  const archMap: Record<string, "x64" | "arm64"> = {
    x64: "x64",
    arm64: "arm64",
  };

  const platform = platformMap[process.platform];
  const arch = archMap[process.arch];

  if (!platform || !arch) {
    throw new Error(
      `Unsupported local build platform ${process.platform}/${process.arch}. Supported targets: ${SUPPORTED_TARGETS.join(", ")}`
    );
  }

  const target = `bun-${platform}-${arch}` as BuildTarget;

  if (!SUPPORTED_TARGETS.includes(target)) {
    throw new Error(`Unsupported local build target ${target}. Supported targets: ${SUPPORTED_TARGETS.join(", ")}`);
  }

  return target;
}

function isBuildTarget(value: string): value is BuildTarget {
  return SUPPORTED_TARGETS.includes(value as BuildTarget);
}

function parseTarget(target: BuildTarget) {
  const [, platform, arch] = target.split("-") as ["bun", "linux" | "darwin" | "windows", "x64" | "arm64"];
  return { platform, arch };
}

async function ensureOpenTuiTargetPackage(target: BuildTarget) {
  const { platform, arch } = parseTarget(target);
  const packagePlatform = platform === "windows" ? "win32" : platform;
  const packageName = `@opentui/core-${packagePlatform}-${arch}`;
  const packageDir = path.join("node_modules", "@opentui", `core-${packagePlatform}-${arch}`);
  const packagePath = path.join(packageDir, "index.ts");

  try {
    await fs.access(packagePath);
    return;
  } catch {
    const corePackage = (await Bun.file("node_modules/@opentui/core/package.json").json()) as { version: string };
    console.log(`Installing ${packageName}@${corePackage.version} for ${target}`);
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "dataslip-opentui-"));

    try {
      await $`npm install --prefix ${tempDir} --no-save --force ${`${packageName}@${corePackage.version}`}`;
      try {
        await fs.mkdir(path.dirname(packageDir), { recursive: true });
      } catch {
        // Bun can throw EEXIST here even with recursive enabled.
      }
      await fs.rm(packageDir, { recursive: true, force: true });
      await fs.cp(path.join(tempDir, "node_modules", "@opentui", `core-${packagePlatform}-${arch}`), packageDir, {
        recursive: true,
      });
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
}

const args = parseArgs(process.argv.slice(2));
const requestedTarget = args.get("--target");

if (requestedTarget && !isBuildTarget(requestedTarget)) {
  throw new Error(`Unsupported --target ${requestedTarget}. Supported targets: ${SUPPORTED_TARGETS.join(", ")}`);
}

const target: BuildTarget = requestedTarget && isBuildTarget(requestedTarget) ? requestedTarget : getCurrentTarget();
const packageJson = (await Bun.file("package.json").json()) as { name: string };
const outputRoot = path.resolve(args.get("--outdir") ?? "dist/release");
const { platform, arch } = parseTarget(target);
const artifactName = `${packageJson.name}-${platform}-${arch}`;
const artifactDir = path.join(outputRoot, artifactName);
const binaryName = platform === "windows" ? `${packageJson.name}.exe` : packageJson.name;
const binaryPath = path.join(artifactDir, binaryName);

await fs.rm(artifactDir, { recursive: true, force: true });
await fs.mkdir(artifactDir, { recursive: true });

await ensureOpenTuiTargetPackage(target);

await $`bun build ./src/index.tsx --compile --target=${target} --outfile ${binaryPath} --tsconfig-override ./tsconfig.json`;

await Bun.write(path.join(artifactDir, "README.md"), await Bun.file("README.md").text());
await Bun.write(path.join(artifactDir, "LICENSE"), await Bun.file("LICENSE").text());

console.log(`Built ${artifactName}`);
console.log(`Target: ${target}`);
console.log(`Output: ${binaryPath}`);
