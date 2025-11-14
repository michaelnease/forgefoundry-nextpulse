/**
 * Shared metadata loading logic
 * Used by both the dashboard server and (future) client-side runtime
 * Priority: env → metadata.json → package.json → git → defaults
 */

import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { Metadata } from "../runtime/Panel.js";

/**
 * Safely execute a shell command
 */
function safeExec(command: string, cwd: string): string | null {
  try {
    return execSync(command, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
      cwd,
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Read package.json safely
 */
function readPackageJson(projectRoot: string): { name?: string; dependencies?: Record<string, string> } | null {
  try {
    const pkgPath = join(projectRoot, "package.json");
    if (!existsSync(pkgPath)) return null;
    const content = readFileSync(pkgPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Extract Next.js version from package.json
 */
function getNextVersion(pkg: { dependencies?: Record<string, string> } | null): string {
  if (!pkg?.dependencies?.next) return "unknown";
  // Remove version prefixes like ^, ~, >=
  return pkg.dependencies.next.replace(/[^0-9.]/g, "") || "unknown";
}

/**
 * Get git branch name
 */
function getGitBranch(projectRoot: string): string {
  const branch = safeExec(`git rev-parse --abbrev-ref HEAD`, projectRoot);
  return branch || "unknown";
}

/**
 * Get git commit SHA (short)
 */
function getGitSha(projectRoot: string): string {
  const sha = safeExec(`git rev-parse --short HEAD`, projectRoot);
  return sha || "unknown";
}

/**
 * Check if git working directory is dirty
 */
function getGitDirty(projectRoot: string): boolean {
  const status = safeExec(`git status --porcelain`, projectRoot);
  return status ? status.length > 0 : false;
}

/**
 * Get port from environment or default
 */
function getPort(): string {
  return process.env.PORT || process.env.NEXT_PUBLIC_PORT || "3000";
}

/**
 * Read existing metadata.json
 */
function readMetadataFile(projectRoot: string): Partial<Metadata> | null {
  try {
    const metadataPath = join(projectRoot, ".nextpulse/metadata.json");
    if (!existsSync(metadataPath)) return null;
    const content = readFileSync(metadataPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Load metadata with priority: env → metadata.json → package.json → git → defaults
 */
export function loadMetadata(projectRoot: string): Metadata {
  // Priority 1: Environment variables
  const envMetadata: Partial<Metadata> = {};
  if (process.env.NEXTPULSE_APP_NAME) envMetadata.appName = process.env.NEXTPULSE_APP_NAME;
  if (process.env.NEXTPULSE_NEXT_VERSION) envMetadata.nextVersion = process.env.NEXTPULSE_NEXT_VERSION;
  if (process.env.NEXTPULSE_GIT_BRANCH) envMetadata.gitBranch = process.env.NEXTPULSE_GIT_BRANCH;
  if (process.env.NEXTPULSE_GIT_SHA) envMetadata.gitSha = process.env.NEXTPULSE_GIT_SHA;
  if (process.env.NEXTPULSE_GIT_DIRTY !== undefined) {
    envMetadata.gitDirty = process.env.NEXTPULSE_GIT_DIRTY === "true" || process.env.NEXTPULSE_GIT_DIRTY === "1";
  }
  if (process.env.PORT || process.env.NEXT_PUBLIC_PORT) {
    envMetadata.port = getPort();
  }

  // Priority 2: metadata.json file
  const fileMetadata = readMetadataFile(projectRoot) || {};

  // Priority 3: package.json
  const pkg = readPackageJson(projectRoot);
  const pkgMetadata: Partial<Metadata> = {};
  if (pkg?.name) {
    pkgMetadata.appName = pkg.name;
  }
  pkgMetadata.nextVersion = getNextVersion(pkg);

  // Priority 4: git (only if not already set)
  const gitMetadata: Partial<Metadata> = {};
  if (!envMetadata.gitBranch && !fileMetadata.gitBranch) {
    const branch = getGitBranch(projectRoot);
    if (branch !== "unknown") {
      gitMetadata.gitBranch = branch;
    }
  }
  if (!envMetadata.gitSha && !fileMetadata.gitSha) {
    const sha = getGitSha(projectRoot);
    if (sha !== "unknown") {
      gitMetadata.gitSha = sha;
    }
  }
  if (envMetadata.gitDirty === undefined && fileMetadata.gitDirty === undefined) {
    gitMetadata.gitDirty = getGitDirty(projectRoot);
  }

  // Priority 5: defaults
  const defaults: Metadata = {
    appName: "Next.js App",
    nextVersion: "unknown",
    gitBranch: "unknown",
    gitSha: "unknown",
    gitDirty: false,
    port: getPort(),
  };

  // Merge with priority (later sources override earlier ones)
  // Only include properties that are not undefined
  const metadata: Metadata = {
    ...defaults,
    ...Object.fromEntries(Object.entries(gitMetadata).filter(([_, v]) => v !== undefined)),
    ...Object.fromEntries(Object.entries(pkgMetadata).filter(([_, v]) => v !== undefined)),
    ...Object.fromEntries(Object.entries(fileMetadata).filter(([_, v]) => v !== undefined)),
    ...Object.fromEntries(Object.entries(envMetadata).filter(([_, v]) => v !== undefined)),
  };

  return metadata;
}

