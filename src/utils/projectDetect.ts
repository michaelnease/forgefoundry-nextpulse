import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { execSync } from "child_process";

export type RouterType = "app" | "pages" | null;

export interface ProjectInfo {
  root: string;
  routerType: RouterType;
  packageJson: {
    name?: string;
    version?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  nextVersion?: string;
  gitBranch?: string;
  gitSha?: string;
  port?: string;
}

/**
 * Find project root by walking up until package.json and .git are found
 */
export function findProjectRoot(startPath: string): string | null {
  let current = startPath;
  const root = "/";

  while (current !== root) {
    const packageJsonPath = join(current, "package.json");
    const gitPath = join(current, ".git");

    if (existsSync(packageJsonPath) && existsSync(gitPath)) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return null;
}

/**
 * Detect router type: App Router or Pages Router
 */
export function detectRouterType(projectRoot: string): RouterType {
  const appLayoutTsx = join(projectRoot, "app", "layout.tsx");
  const appLayoutTs = join(projectRoot, "app", "layout.ts");
  const pagesApp = join(projectRoot, "pages", "_app.tsx");

  if (existsSync(appLayoutTsx) || existsSync(appLayoutTs)) {
    return "app";
  }

  if (existsSync(pagesApp)) {
    return "pages";
  }

  return null;
}

/**
 * Get entry file path for the router type
 */
export function getEntryFile(projectRoot: string, routerType: RouterType): string | null {
  if (routerType === "app") {
    // Prefer TSX, then TS, then JSX, then JS
    const layoutTsx = join(projectRoot, "app", "layout.tsx");
    const layoutTs = join(projectRoot, "app", "layout.ts");
    const layoutJsx = join(projectRoot, "app", "layout.jsx");
    const layoutJs = join(projectRoot, "app", "layout.js");
    if (existsSync(layoutTsx)) return layoutTsx;
    if (existsSync(layoutTs)) return layoutTs;
    if (existsSync(layoutJsx)) return layoutJsx;
    if (existsSync(layoutJs)) return layoutJs;
  } else if (routerType === "pages") {
    // Prefer TSX, then JSX, then TS, then JS
    const appTsx = join(projectRoot, "pages", "_app.tsx");
    const appJsx = join(projectRoot, "pages", "_app.jsx");
    const appTs = join(projectRoot, "pages", "_app.ts");
    const appJs = join(projectRoot, "pages", "_app.js");
    if (existsSync(appTsx)) return appTsx;
    if (existsSync(appJsx)) return appJsx;
    if (existsSync(appTs)) return appTs;
    if (existsSync(appJs)) return appJs;
  }
  return null;
}

/**
 * Read package.json safely
 */
export function readPackageJson(projectRoot: string): ProjectInfo["packageJson"] {
  try {
    const packageJsonPath = join(projectRoot, "package.json");
    const content = readFileSync(packageJsonPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

/**
 * Get Next.js version from package.json
 */
export function getNextVersion(packageJson: ProjectInfo["packageJson"]): string | undefined {
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  return deps?.next || deps?.["next.js"];
}

/**
 * Get git branch safely
 */
export function getGitBranch(projectRoot: string): string | undefined {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: projectRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim();
  } catch {
    return "unknown";
  }
}

/**
 * Get git short SHA safely
 */
export function getGitSha(projectRoot: string): string | undefined {
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: projectRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim();
  } catch {
    return "unknown";
  }
}

/**
 * Get port from environment
 */
export function getPort(): string | undefined {
  return process.env.PORT || process.env.NEXT_PUBLIC_PORT;
}

/**
 * Collect all project info
 */
export function getProjectInfo(projectRoot: string): ProjectInfo {
  const packageJson = readPackageJson(projectRoot);
  const routerType = detectRouterType(projectRoot);

  return {
    root: projectRoot,
    routerType,
    packageJson,
    nextVersion: getNextVersion(packageJson),
    gitBranch: getGitBranch(projectRoot),
    gitSha: getGitSha(projectRoot),
    port: getPort(),
  };
}

/**
 * Find all Next.js apps in a monorepo
 */
export function findMonorepoApps(projectRoot: string): string[] {
  const apps: string[] = [];
  const appsDir = join(projectRoot, "apps");
  const packagesDir = join(projectRoot, "packages");

  if (existsSync(appsDir)) {
    try {
      const entries = require("fs").readdirSync(appsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const appPath = join(appsDir, entry.name);
          if (detectRouterType(appPath)) {
            apps.push(appPath);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  if (existsSync(packagesDir)) {
    try {
      const entries = require("fs").readdirSync(packagesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const appPath = join(packagesDir, entry.name);
          if (detectRouterType(appPath)) {
            apps.push(appPath);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return apps;
}

