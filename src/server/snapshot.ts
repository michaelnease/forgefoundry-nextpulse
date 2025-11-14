/**
 * Diagnostic snapshot generator for NextPulse
 * Combines all diagnostic data into a single AI-readable snapshot
 *
 * This module now uses the shared diagnostics module for core snapshot building
 * and adds environment-specific metadata for the full diagnostic snapshot
 */

import { buildDiagnosticsSnapshot } from "../diagnostics/index.js";
import { loadMetadata } from "./loadMetadata.js";
import { readConfig } from "../utils/config.js";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import type { DiagnosticSnapshot, EnvironmentInfo } from "../types/snapshot.js";

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
 * Get git information
 */
function getGitInfo(projectRoot: string): EnvironmentInfo["git"] {
  const branch = safeExec("git rev-parse --abbrev-ref HEAD", projectRoot) || "unknown";
  const sha = safeExec("git rev-parse HEAD", projectRoot) || "unknown";
  const status = safeExec("git status --porcelain", projectRoot);
  const dirty = status !== null && status.length > 0;

  return {
    branch,
    sha: sha.substring(0, 7), // Short SHA
    dirty,
  };
}

/**
 * Get Next.js version from project
 */
function getNextJsVersion(projectRoot: string): string | null {
  try {
    const packageJsonPath = join(projectRoot, "package.json");
    if (!existsSync(packageJsonPath)) {
      return null;
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    const nextVersion =
      packageJson.dependencies?.next ||
      packageJson.devDependencies?.next ||
      packageJson.peerDependencies?.next;

    return nextVersion || null;
  } catch {
    return null;
  }
}

/**
 * Get NextPulse version
 */
function getNextPulseVersion(): string {
  // Try reading from package.json in various locations
  const possiblePaths = [
    // When running from dist
    join(process.cwd(), "node_modules", "@forgefoundry", "nextpulse", "package.json"),
    // When running from source
    join(process.cwd(), "package.json"),
  ];

  for (const packageJsonPath of possiblePaths) {
    try {
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
        if (packageJson.name === "@forgefoundry/nextpulse") {
          return packageJson.version || "unknown";
        }
      }
    } catch {
      // Continue to next path
    }
  }

  return "unknown";
}

/**
 * Get environment information
 */
function getEnvironmentInfo(projectRoot: string): EnvironmentInfo {
  return {
    node: process.versions.node,
    platform: process.platform,
    nextpulseVersion: getNextPulseVersion(),
    nextJsVersion: getNextJsVersion(projectRoot),
    git: getGitInfo(projectRoot),
  };
}

/**
 * Generate a complete diagnostic snapshot
 * Combines all diagnostic data from all phases
 * Uses the shared diagnostics module and adds environment-specific metadata
 */
export async function generateDiagnosticSnapshot(projectRoot: string): Promise<DiagnosticSnapshot> {
  // Use shared diagnostics module to build core snapshot
  const diagnosticsSnapshot = buildDiagnosticsSnapshot(projectRoot);

  // Add environment-specific metadata
  const config = readConfig(projectRoot);
  const environment = getEnvironmentInfo(projectRoot);

  // Build complete snapshot (includes metadata from diagnosticsSnapshot if available)
  const snapshot: DiagnosticSnapshot = {
    timestamp: diagnosticsSnapshot.generatedAt,
    metadata: diagnosticsSnapshot.metadata || loadMetadata(projectRoot),
    config,
    routes: diagnosticsSnapshot.routes,
    bundles: diagnosticsSnapshot.bundles,
    runtime: diagnosticsSnapshot.runtime,
    performance: diagnosticsSnapshot.performance,
    errors: diagnosticsSnapshot.errors,
    environment,
  };

  return snapshot;
}
