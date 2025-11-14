/**
 * Doctor command - health checks for NextPulse installation
 */

import path from "path";
import { existsSync, readFileSync } from "fs";
import pc from "picocolors";
import { detectRouterType, findEntryFile } from "../utils/ast.js";
import { readConfig, normalizeConfig, CONFIG_FILENAME } from "../utils/config.js";
import { hasPackageImport, hasComponent } from "../utils/injectionLocal.js";
import { getAppRouterApiTemplates, getPagesRouterApiTemplates } from "../utils/templates.js";

export interface DoctorCheckResult {
  status: "ok" | "warn" | "error";
  message: string;
}

export interface DoctorSummary {
  passed: number;
  warnings: number;
  errors: number;
  results: DoctorCheckResult[];
}

/**
 * Check config file
 */
function checkConfig(projectRoot: string): DoctorCheckResult {
  const configPath = path.join(projectRoot, CONFIG_FILENAME);

  if (!existsSync(configPath)) {
    return {
      status: "warn",
      message: `${CONFIG_FILENAME} not found. Run "npx nextpulse init" to create it.`,
    };
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const json = JSON.parse(content);
    normalizeConfig(json);
    return {
      status: "ok",
      message: `${CONFIG_FILENAME} found and valid`,
    };
  } catch (error: any) {
    if (error instanceof SyntaxError) {
      return {
        status: "error",
        message: `${CONFIG_FILENAME} is invalid. Try deleting it and re-running "npx nextpulse init".`,
      };
    }
    return {
      status: "error",
      message: `Could not read ${CONFIG_FILENAME}: ${error?.message || "Unknown error"}. Try re-running "npx nextpulse init".`,
    };
  }
}

/**
 * Check metadata file
 */
function checkMetadata(projectRoot: string): DoctorCheckResult {
  const metadataPath = path.join(projectRoot, ".nextpulse/metadata.json");

  if (!existsSync(metadataPath)) {
    return {
      status: "warn",
      message: `.nextpulse/metadata.json not found. Run "npx nextpulse init" to generate it.`,
    };
  }

  try {
    const content = readFileSync(metadataPath, "utf-8");
    JSON.parse(content);
    return {
      status: "ok",
      message: `.nextpulse/metadata.json found`,
    };
  } catch (error: any) {
    return {
      status: "error",
      message: `Could not read .nextpulse/metadata.json. Try re-running "npx nextpulse init".`,
    };
  }
}

/**
 * Check NextPulse injection
 */
async function checkInjection(
  projectRoot: string,
  routerType: "app" | "pages" | null
): Promise<DoctorCheckResult> {
  if (!routerType) {
    return {
      status: "error",
      message: `Could not detect router type. Pass "--app" to "nextpulse init" to specify your app directory.`,
    };
  }

  const entryFile = await findEntryFile(projectRoot, routerType);
  if (!entryFile) {
    const expectedFile = routerType === "app" ? "layout.tsx" : "_app.tsx";
    return {
      status: "error",
      message: `Could not find a ${expectedFile} for injection. Pass "--app" to "nextpulse init" to specify your app directory.`,
    };
  }

  if (!existsSync(entryFile)) {
    return {
      status: "error",
      message: `Entry file ${entryFile} not found. Run "npx nextpulse init" to set up NextPulse.`,
    };
  }

  try {
    const content = readFileSync(entryFile, "utf-8");
    const hasImport = hasPackageImport(content);
    const hasComp = hasComponent(content);

    if (hasImport && hasComp) {
      const entryName = routerType === "app" ? "layout" : "_app";
      return {
        status: "ok",
        message: `NextPulse is injected into ${entryName}`,
      };
    } else {
      return {
        status: "warn",
        message: `NextPulse is not injected into your app entry. Run "npx nextpulse init" or add it manually.`,
      };
    }
  } catch (error: any) {
    return {
      status: "error",
      message: `Could not read entry file ${entryFile}: ${error?.message || "Unknown error"}.`,
    };
  }
}

/**
 * Check API routes
 */
function checkApiRoutes(
  projectRoot: string,
  routerType: "app" | "pages" | null
): DoctorCheckResult {
  if (!routerType) {
    return {
      status: "error",
      message: `Could not detect router type. Cannot check API routes.`,
    };
  }

  const apiRoutes =
    routerType === "app" ? getAppRouterApiTemplates() : getPagesRouterApiTemplates();

  const expectedRoutes = Object.keys(apiRoutes);
  const missingRoutes: string[] = [];
  const existingRoutes: string[] = [];

  for (const routePath of expectedRoutes) {
    const fullPath = path.join(projectRoot, routePath);
    if (existsSync(fullPath)) {
      existingRoutes.push(routePath);
    } else {
      missingRoutes.push(routePath);
    }
  }

  if (missingRoutes.length === 0) {
    return {
      status: "ok",
      message: `All NextPulse API routes are present`,
    };
  } else if (existingRoutes.length === 0) {
    return {
      status: "error",
      message: `No NextPulse API routes found. Run "npx nextpulse init" to generate them.`,
    };
  } else {
    return {
      status: "warn",
      message: `Some NextPulse API routes are missing (${missingRoutes.length} of ${expectedRoutes.length}). Re-run "npx nextpulse init" with "--force" or create the missing routes manually.`,
    };
  }
}

/**
 * Lightweight diagnostics check
 */
async function checkDiagnostics(projectRoot: string): Promise<DoctorCheckResult> {
  try {
    // Try to import the diagnostics module (lightweight check)
    // We don't actually call buildDiagnosticsSnapshot as it may require a build
    // This is a compile-time check - if the module exists, it's available
    const diagnosticsModule = await import("../diagnostics/index.js");
    if (diagnosticsModule && typeof diagnosticsModule.buildDiagnosticsSnapshot === "function") {
      return {
        status: "ok",
        message: `Diagnostics module is available`,
      };
    }
    return {
      status: "warn",
      message: `Diagnostics module may not be properly installed`,
    };
  } catch (error: any) {
    // In development/build context, this might fail if not built yet
    // That's okay - it's a non-critical check
    return {
      status: "warn",
      message: `Could not verify diagnostics module. Make sure your project builds and that NextPulse is correctly installed.`,
    };
  }
}

/**
 * Run all health checks
 */
export async function runDoctor(projectRoot: string): Promise<DoctorSummary> {
  const results: DoctorCheckResult[] = [];

  // Detect router type
  const routerType = await detectRouterType(projectRoot);

  // Run checks
  results.push(checkConfig(projectRoot));
  results.push(checkMetadata(projectRoot));
  results.push(await checkInjection(projectRoot, routerType));
  results.push(checkApiRoutes(projectRoot, routerType));
  results.push(await checkDiagnostics(projectRoot));

  // Count results
  const passed = results.filter((r) => r.status === "ok").length;
  const warnings = results.filter((r) => r.status === "warn").length;
  const errors = results.filter((r) => r.status === "error").length;

  return {
    passed,
    warnings,
    errors,
    results,
  };
}

/**
 * Print check results
 */
function printCheckResult(result: DoctorCheckResult): void {
  const prefix =
    result.status === "ok"
      ? pc.green("ok")
      : result.status === "warn"
        ? pc.yellow("warn")
        : pc.red("error");
  console.log(pc.dim(`[nextpulse] ${prefix}:`), result.message);
}

/**
 * Print summary
 */
export function printSummary(summary: DoctorSummary): void {
  console.log(); // Empty line

  if (summary.errors === 0 && summary.warnings === 0) {
    console.log(
      pc.green(`[nextpulse] doctor summary: All checks passed. NextPulse should be ready to use.`)
    );
  } else if (summary.errors === 0) {
    console.log(
      pc.yellow(
        `[nextpulse] doctor summary: Some non-critical issues detected. See warnings above for suggestions.`
      )
    );
  } else {
    console.log(
      pc.red(
        `[nextpulse] doctor summary: One or more critical issues detected. Please fix the errors above and re-run "nextpulse doctor".`
      )
    );
  }
}

/**
 * Doctor command entry point
 */
export async function doctorCommand(options: { app?: string }): Promise<number> {
  const projectRoot = path.resolve(options.app || ".");

  console.log(pc.cyan("[nextpulse] Running health checks...\n"));

  const summary = await runDoctor(projectRoot);

  // Print all results
  summary.results.forEach(printCheckResult);

  // Print summary
  printSummary(summary);

  // Exit code: 0 if no errors, 1 if errors
  return summary.errors > 0 ? 1 : 0;
}
