import { existsSync, readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { execSync } from "child_process";

function safeExec(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim();
  } catch {
    return "unknown";
  }
}

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
export function getEntryFile(root: string, router: RouterType): string | null {
  if (router === "app") {
    for (const c of ["app/layout.tsx", "app/layout.ts"]) {
      if (existsSync(join(root, c))) return join(root, c);
    }
  }
  for (const p of ["pages/_app.tsx", "pages/_app.js"]) {
    if (existsSync(join(root, p))) return join(root, p);
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
 * Get git info safely
 */
export function getGitInfo(root: string): { branch: string; sha: string } {
  const branch = safeExec("git rev-parse --abbrev-ref HEAD", root);
  const sha = safeExec("git rev-parse --short HEAD", root);
  return { branch, sha };
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
  const gitInfo = getGitInfo(projectRoot);

  return {
    root: projectRoot,
    routerType,
    packageJson,
    nextVersion: getNextVersion(packageJson),
    gitBranch: gitInfo.branch,
    gitSha: gitInfo.sha,
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
      const entries = readdirSync(appsDir, { withFileTypes: true });
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
      const entries = readdirSync(packagesDir, { withFileTypes: true });
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

