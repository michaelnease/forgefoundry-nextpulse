/**
 * Metadata generation utilities
 * Creates and updates .nextpulse/metadata.json
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import pc from "picocolors";

export interface MetadataFile {
  appName: string;
  nextVersion: string;
  gitBranch: string;
  gitSha: string;
  gitDirty: boolean;
  port: string;
}

/**
 * Safely execute a shell command
 */
function safeExec(command: string): string | null {
  try {
    return execSync(command, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Read package.json safely
 */
function readPackageJson(
  projectRoot: string
): { name?: string; dependencies?: Record<string, string> } | null {
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
  const branch = safeExec(`cd "${projectRoot}" && git rev-parse --abbrev-ref HEAD`);
  return branch || "unknown";
}

/**
 * Get git commit SHA (short)
 */
function getGitSha(projectRoot: string): string {
  const sha = safeExec(`cd "${projectRoot}" && git rev-parse --short HEAD`);
  return sha || "unknown";
}

/**
 * Check if git working directory is dirty
 */
function getGitDirty(projectRoot: string): boolean {
  const status = safeExec(`cd "${projectRoot}" && git status --porcelain`);
  return status ? status.length > 0 : false;
}

/**
 * Get port from environment or default
 */
function getPort(): string {
  return process.env.PORT || process.env.NEXT_PUBLIC_PORT || "3000";
}

/**
 * Generate metadata object from project
 */
export function generateMetadata(projectRoot: string): MetadataFile {
  const pkg = readPackageJson(projectRoot);
  const appName = pkg?.name || "Next.js App";
  const nextVersion = getNextVersion(pkg);
  const gitBranch = getGitBranch(projectRoot);
  const gitSha = getGitSha(projectRoot);
  const gitDirty = getGitDirty(projectRoot);
  const port = getPort();

  return {
    appName,
    nextVersion,
    gitBranch,
    gitSha,
    gitDirty,
    port,
  };
}

/**
 * Write metadata.json to .nextpulse directory
 */
export function writeMetadataFile(
  projectRoot: string,
  metadata: MetadataFile,
  options?: { dryRun?: boolean; force?: boolean }
): "created" | "updated" | "skipped" {
  const metadataDir = join(projectRoot, ".nextpulse");
  const metadataPath = join(metadataDir, "metadata.json");

  // Check if file exists
  const exists = existsSync(metadataPath);

  // Skip if exists and not force
  if (exists && !options?.force) {
    // Still update if content changed
    try {
      const existing = JSON.parse(readFileSync(metadataPath, "utf-8"));
      if (JSON.stringify(existing) === JSON.stringify(metadata)) {
        return "skipped";
      }
    } catch {
      // If we can't read, proceed with write
    }
  }

  if (options?.dryRun) {
    return exists ? "updated" : "created";
  }

  // Ensure directory exists
  if (!existsSync(metadataDir)) {
    mkdirSync(metadataDir, { recursive: true });
  }

  // Write file
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + "\n", "utf-8");

  return exists ? "updated" : "created";
}

/**
 * Read existing metadata.json
 */
export function readMetadataFile(projectRoot: string): MetadataFile | null {
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
 * Generate and write metadata.json
 */
export function generateAndWriteMetadata(
  projectRoot: string,
  options?: { dryRun?: boolean; force?: boolean }
): { metadata: MetadataFile; action: "created" | "updated" | "skipped" } {
  const metadata = generateMetadata(projectRoot);
  const action = writeMetadataFile(projectRoot, metadata, options);

  if (!options?.dryRun) {
    const actionColor = action === "created" ? pc.green : action === "updated" ? pc.yellow : pc.dim;
    console.log(actionColor(`[nextpulse] ${action} .nextpulse/metadata.json`));
  }

  return { metadata, action };
}
