/**
 * Utilities for generating NextPulse API routes in user's project
 * All React components now live in the nextpulse package under src/runtime/
 */

import { join } from "path";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
  readdirSync,
  rmdirSync,
} from "fs";
import pc from "picocolors";
import { getAppRouterApiTemplates, getPagesRouterApiTemplates } from "./templates.js";

export interface GenerateFilesOptions {
  dryRun?: boolean;
  force?: boolean;
}

export type FileAction = "created" | "updated" | "skipped";

export interface GenerateResult {
  file: string;
  action: FileAction;
}

/**
 * Generate API route files in the user's project
 */
export function generateApiRoutes(
  projectRoot: string,
  routerType: "app" | "pages",
  options?: GenerateFilesOptions
): GenerateResult[] {
  const apiRoutes =
    routerType === "app" ? getAppRouterApiTemplates() : getPagesRouterApiTemplates();
  const results: GenerateResult[] = [];

  // Write API route files
  for (const [filePath, content] of Object.entries(apiRoutes)) {
    const fullPath = join(projectRoot, filePath);
    const action = writeApiRouteFile(fullPath, content, options);
    results.push({ file: filePath, action });

    // Log action
    if (!options?.dryRun) {
      const actionColor =
        action === "created" ? pc.green : action === "updated" ? pc.yellow : pc.dim;
      console.log(actionColor(`[nextpulse] ${action} ${filePath}`));
    } else {
      console.log(pc.dim(`[dry-run] ${action} ${filePath}`));
    }
  }

  return results;
}

/**
 * Write a single API route file
 */
function writeApiRouteFile(
  filePath: string,
  content: string,
  options?: GenerateFilesOptions
): FileAction {
  const exists = existsSync(filePath);

  // If exists and not force, check if content changed
  if (exists && !options?.force) {
    try {
      const existing = readFileSync(filePath, "utf-8");
      if (existing === content) {
        return "skipped";
      }
    } catch {
      // If we can't read, proceed with write
    }
  }

  // Skip write in dry run mode
  if (options?.dryRun) {
    return exists ? "updated" : "created";
  }

  // Ensure parent directory exists
  const dir = filePath.substring(0, filePath.lastIndexOf("/"));
  if (dir && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Write file
  writeFileSync(filePath, content, "utf-8");

  return exists ? "updated" : "created";
}

/**
 * Remove all NextPulse API routes from project (for revert)
 */
export function removeApiRoutes(
  projectRoot: string,
  routerType: "app" | "pages",
  options?: { dryRun?: boolean }
): GenerateResult[] {
  const apiRoutes =
    routerType === "app" ? getAppRouterApiTemplates() : getPagesRouterApiTemplates();
  const results: GenerateResult[] = [];

  // Remove API route files
  for (const filePath of Object.keys(apiRoutes)) {
    const fullPath = join(projectRoot, filePath);
    if (existsSync(fullPath)) {
      if (!options?.dryRun) {
        try {
          unlinkSync(fullPath);
          results.push({ file: filePath, action: "updated" });
          console.log(pc.red(`[nextpulse] removed ${filePath}`));
        } catch (error) {
          console.error(pc.red(`[nextpulse] failed to remove ${filePath}`));
        }
      } else {
        results.push({ file: filePath, action: "updated" });
        console.log(pc.dim(`[dry-run] removed ${filePath}`));
      }
    }

    // Try to remove empty parent directories
    if (!options?.dryRun) {
      const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
      try {
        if (existsSync(dir)) {
          const files = readdirSync(dir);
          if (files.length === 0) {
            rmdirSync(dir);
            // Try to remove grandparent if also empty
            const grandparentDir = dir.substring(0, dir.lastIndexOf("/"));
            if (existsSync(grandparentDir)) {
              const grandparentFiles = readdirSync(grandparentDir);
              if (grandparentFiles.length === 0) {
                rmdirSync(grandparentDir);
              }
            }
          }
        }
      } catch {
        // Ignore errors
      }
    }
  }

  return results;
}
