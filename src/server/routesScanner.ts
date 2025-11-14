/**
 * Route scanner for Next.js App Router and Pages Router
 * Discovers all routes in a Next.js project
 */

import { existsSync, readdirSync, statSync } from "fs";
import { join, relative, sep } from "path";
import type {
  RouterKind,
  RouteKind,
  SegmentType,
  RouteInfo,
  AppRouteTreeNode,
  RoutesSnapshot,
} from "../types/routes.js";

const APP_DIR = "app";
const PAGES_DIR = "pages";

// File extensions to scan
const FILE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

// Special App Router files
const APP_ROUTER_FILES = {
  page: ["page.ts", "page.tsx", "page.js", "page.jsx"],
  layout: ["layout.ts", "layout.tsx", "layout.js", "layout.jsx"],
  loading: ["loading.ts", "loading.tsx", "loading.js", "loading.jsx"],
  error: ["error.ts", "error.tsx", "error.js", "error.jsx"],
  routeHandler: ["route.ts", "route.js"],
};

// Directories to ignore
const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".vercel",
  ".turbo",
  "dist",
  "build",
]);

/**
 * Detect router kind in project
 */
export function detectRouterKind(
  projectRoot: string,
  appDir: string = APP_DIR
): "app" | "pages" | "mixed" | "none" {
  const appPath = join(projectRoot, appDir);
  const pagesPath = join(projectRoot, PAGES_DIR);

  const hasApp = existsSync(appPath);
  const hasPages = existsSync(pagesPath);

  if (hasApp && hasPages) return "mixed";
  if (hasApp) return "app";
  if (hasPages) return "pages";
  return "none";
}

/**
 * Determine segment type from folder name
 */
function getSegmentType(segment: string): SegmentType {
  if (segment.startsWith("(") && segment.endsWith(")")) {
    return "routeGroup";
  }
  if (segment.startsWith("@")) {
    return "parallelRoute";
  }
  if (segment.startsWith("[[...") && segment.endsWith("]]")) {
    return "optionalCatchAll";
  }
  if (segment.startsWith("[...") && segment.endsWith("]")) {
    return "catchAll";
  }
  if (segment.startsWith("[") && segment.endsWith("]")) {
    return "dynamic";
  }
  return "static";
}

/**
 * Extract segment name (remove brackets, groups, etc.)
 */
function extractSegmentName(segment: string): string {
  // Route groups: (marketing) -> marketing
  if (segment.startsWith("(") && segment.endsWith(")")) {
    return segment.slice(1, -1);
  }
  // Parallel routes: @modal -> modal
  if (segment.startsWith("@")) {
    return segment.slice(1);
  }
  // Dynamic: [slug] -> [slug]
  // Catch-all: [...slug] -> [...slug]
  // Optional catch-all: [[...slug]] -> [[...slug]]
  return segment;
}

/**
 * Build public path from segments (ignoring route groups and parallel routes)
 */
function buildPath(segments: string[]): string {
  const pathSegments = segments
    .filter((seg) => {
      const type = getSegmentType(seg);
      return type !== "routeGroup" && type !== "parallelRoute";
    })
    .map((seg) => extractSegmentName(seg));

  if (pathSegments.length === 0) return "/";
  return "/" + pathSegments.join("/");
}

/**
 * Check if file is a special App Router file
 */
function getAppRouterFileKind(filename: string): RouteKind | null {
  for (const [kind, files] of Object.entries(APP_ROUTER_FILES)) {
    if (files.includes(filename)) {
      if (kind === "routeHandler") return "routeHandler";
      return kind as RouteKind;
    }
  }
  return null;
}

/**
 * Scan App Router directory recursively
 */
function scanAppRouterDirectory(
  projectRoot: string,
  dirPath: string,
  segments: string[],
  treeNode: AppRouteTreeNode
): RouteInfo[] {
  const routes: RouteInfo[] = [];
  const parallelRoutes: string[] = [];

  if (!existsSync(dirPath)) {
    return routes;
  }

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      // Skip ignored directories
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name)) continue;

        const segmentType = getSegmentType(entry.name);
        const isParallelRoute = segmentType === "parallelRoute";
        const isRouteGroup = segmentType === "routeGroup";

        if (isParallelRoute) {
          parallelRoutes.push(entry.name);
        }

        // Create child node
        const childSegments = isRouteGroup ? segments : [...segments, entry.name];
        const childPath = buildPath(childSegments);
        const childNode: AppRouteTreeNode = {
          segment: entry.name,
          path: childPath,
          children: [],
          hasPage: false,
          hasLayout: false,
          hasLoading: false,
          hasError: false,
          hasRouteHandler: false,
        };

        // Recursively scan child directory
        const childRoutes = scanAppRouterDirectory(
          projectRoot,
          fullPath,
          childSegments,
          childNode
        );

        routes.push(...childRoutes);
        treeNode.children.push(childNode);
      } else if (entry.isFile()) {
        // Check if it's a special App Router file
        const fileKind = getAppRouterFileKind(entry.name);
        if (fileKind) {
          const filePath = relative(projectRoot, fullPath).replace(/\\/g, "/");
          const routePath = buildPath(segments);

          // Update tree node
          if (fileKind === "page") treeNode.hasPage = true;
          if (fileKind === "layout") treeNode.hasLayout = true;
          if (fileKind === "loading") treeNode.hasLoading = true;
          if (fileKind === "error") treeNode.hasError = true;
          if (fileKind === "routeHandler") treeNode.hasRouteHandler = true;

          // Determine segment type from current segment
          const currentSegment = segments[segments.length - 1] || "";
          const segmentType = getSegmentType(currentSegment);

          routes.push({
            router: "app",
            path: routePath,
            file: filePath,
            kind: fileKind,
            segmentType,
            hasLayout: fileKind === "layout" || treeNode.hasLayout,
          });
        }
      }
    }

    // Set parallel routes if any
    if (parallelRoutes.length > 0) {
      treeNode.parallelRoutes = parallelRoutes;
    }
  } catch (error) {
    // Silently fail if directory can't be read
  }

  return routes;
}

/**
 * Scan App Router
 */
export function scanAppRouter(
  projectRoot: string,
  appDir: string = APP_DIR
): { tree?: AppRouteTreeNode; routes: RouteInfo[] } {
  const appPath = join(projectRoot, appDir);

  if (!existsSync(appPath)) {
    return { routes: [] };
  }

  // Create root node
  const rootNode: AppRouteTreeNode = {
    segment: "",
    path: "/",
    children: [],
    hasPage: false,
    hasLayout: false,
    hasLoading: false,
    hasError: false,
    hasRouteHandler: false,
  };

  // Check for root layout
  const rootLayout = APP_ROUTER_FILES.layout.find((f) =>
    existsSync(join(appPath, f))
  );
  if (rootLayout) {
    rootNode.hasLayout = true;
    const filePath = relative(projectRoot, join(appPath, rootLayout)).replace(
      /\\/g,
      "/"
    );
    rootNode.hasLayout = true;
  }

  // Check for root page
  const rootPage = APP_ROUTER_FILES.page.find((f) =>
    existsSync(join(appPath, f))
  );
  if (rootPage) {
    rootNode.hasPage = true;
    const filePath = relative(projectRoot, join(appPath, rootPage)).replace(
      /\\/g,
      "/"
    );
    rootNode.hasPage = true;
  }

  // Scan recursively
  const routes = scanAppRouterDirectory(projectRoot, appPath, [], rootNode);

  // Add root routes if they exist
  if (rootNode.hasLayout) {
    const layoutFile = APP_ROUTER_FILES.layout.find((f) =>
      existsSync(join(appPath, f))
    );
    if (layoutFile) {
      routes.unshift({
        router: "app",
        path: "/",
        file: relative(projectRoot, join(appPath, layoutFile)).replace(/\\/g, "/"),
        kind: "layout",
        segmentType: "static",
        hasLayout: true,
      });
    }
  }

  if (rootNode.hasPage) {
    const pageFile = APP_ROUTER_FILES.page.find((f) =>
      existsSync(join(appPath, f))
    );
    if (pageFile) {
      routes.unshift({
        router: "app",
        path: "/",
        file: relative(projectRoot, join(appPath, pageFile)).replace(/\\/g, "/"),
        kind: "page",
        segmentType: "static",
        hasLayout: rootNode.hasLayout,
      });
    }
  }

  return { tree: rootNode, routes };
}

/**
 * Convert Pages Router file path to route path
 */
function pagesPathToRoute(filePath: string, projectRoot: string): {
  path: string;
  kind: RouteKind;
  segmentType: SegmentType;
} {
  // Remove project root and pages/ prefix
  let relativePath = relative(join(projectRoot, PAGES_DIR), filePath)
    .replace(/\\/g, "/");

  // Remove extension
  relativePath = relativePath.replace(/\.(ts|tsx|js|jsx)$/, "");

  // Handle index files
  if (relativePath === "index" || relativePath === "") {
    return { path: "/", kind: "page", segmentType: "static" };
  }

  // Handle nested index files (e.g., blog/index.tsx -> /blog)
  if (relativePath.endsWith("/index")) {
    relativePath = relativePath.slice(0, -6); // Remove "/index"
    if (relativePath === "") {
      return { path: "/", kind: "page", segmentType: "static" };
    }
  }

  // Handle API routes
  if (relativePath.startsWith("api/")) {
    const apiPath = "/" + relativePath;
    const segments = apiPath.split("/");
    const lastSegment = segments[segments.length - 1] || "";
    let segmentType: SegmentType = "static";
    if (lastSegment.startsWith("[[")) segmentType = "optionalCatchAll";
    else if (lastSegment.startsWith("[...")) segmentType = "catchAll";
    else if (lastSegment.startsWith("[")) segmentType = "dynamic";
    return { path: apiPath, kind: "apiRoute", segmentType };
  }

  // Convert to route path
  const path = "/" + relativePath;
  const segments = path.split("/");
  const lastSegment = segments[segments.length - 1] || "";
  let segmentType: SegmentType = "static";
  if (lastSegment.startsWith("[[")) segmentType = "optionalCatchAll";
  else if (lastSegment.startsWith("[...")) segmentType = "catchAll";
  else if (lastSegment.startsWith("[")) segmentType = "dynamic";

  return { path, kind: "page", segmentType };
}

/**
 * Scan Pages Router directory recursively
 */
function scanPagesRouterDirectory(
  projectRoot: string,
  dirPath: string
): RouteInfo[] {
  const routes: RouteInfo[] = [];

  if (!existsSync(dirPath)) {
    return routes;
  }

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      // Skip ignored files and directories
      if (IGNORE_DIRS.has(entry.name)) continue;

      // Skip special Next.js files
      if (
        entry.name.startsWith("_app") ||
        entry.name.startsWith("_document") ||
        entry.name.startsWith("_error")
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subRoutes = scanPagesRouterDirectory(projectRoot, fullPath);
        routes.push(...subRoutes);
      } else if (entry.isFile()) {
        // Check if it's a valid page file
        const ext = entry.name.substring(entry.name.lastIndexOf("."));
        if (FILE_EXTENSIONS.includes(ext)) {
          const { path, kind, segmentType } = pagesPathToRoute(
            fullPath,
            projectRoot
          );
          const filePath = relative(projectRoot, fullPath).replace(/\\/g, "/");

          routes.push({
            router: "pages",
            path,
            file: filePath,
            kind,
            segmentType,
          });
        }
      }
    }
  } catch (error) {
    // Silently fail if directory can't be read
  }

  return routes;
}

/**
 * Scan Pages Router
 */
export function scanPagesRouter(
  projectRoot: string,
  pagesDir: string = PAGES_DIR
): RouteInfo[] {
  const pagesPath = join(projectRoot, pagesDir);

  if (!existsSync(pagesPath)) {
    return [];
  }

  return scanPagesRouterDirectory(projectRoot, pagesPath);
}

/**
 * Scan all routes in a Next.js project
 */
export function scanAllRoutes(
  projectRoot: string,
  appDir: string = APP_DIR
): RoutesSnapshot {
  if (!existsSync(projectRoot)) {
    return { appRoutes: [], pagesRoutes: [] };
  }

  const appResult = scanAppRouter(projectRoot, appDir);
  const pagesRoutes = scanPagesRouter(projectRoot);

  return {
    appRouterTree: appResult.tree,
    appRoutes: appResult.routes,
    pagesRoutes,
  };
}

