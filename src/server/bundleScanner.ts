/**
 * Bundle scanner for Next.js build output
 * Scans .next/ directory to extract bundle, chunk, and asset information
 */

import { existsSync, readdirSync, statSync, readFileSync } from "fs";
import { join, extname, basename, dirname } from "path";
import { gzipSync } from "zlib";
import type { BundleAsset, ChunkInfo, RouteBundleInfo, BundlesSnapshot } from "../types/bundles.js";
import { scanAllRoutes } from "./routesScanner.js";
import type { RouteInfo } from "../types/routes.js";

const NEXT_DIR = ".next";

/**
 * Detect asset type from file extension
 */
function getAssetType(filename: string): BundleAsset["type"] {
  const ext = extname(filename).toLowerCase();

  if (ext === ".js" || ext === ".mjs" || ext === ".cjs") return "js";
  if (ext === ".css") return "css";
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".avif"].includes(ext))
    return "image";
  if ([".woff", ".woff2", ".ttf", ".otf", ".eot"].includes(ext)) return "font";
  return "other";
}

/**
 * Check if path indicates client bundle
 */
function isClientPath(path: string): boolean {
  return path.includes("/static/") || path.includes("\\static\\");
}

/**
 * Check if path indicates server bundle
 */
function isServerPath(path: string): boolean {
  return path.includes("/server/") || path.includes("\\server\\");
}

/**
 * Extract base chunk name from hashed filename
 * e.g., "main-abc123.js" -> "main"
 */
function extractChunkBaseName(filename: string): string {
  const name = basename(filename, extname(filename));
  // Remove hash (typically 5-8 hex chars before extension)
  const match = name.match(/^(.+?)-[a-f0-9]{5,8}$/i);
  return match ? match[1] : name;
}

/**
 * Check if chunk is an entry chunk
 */
function isEntryChunk(name: string): boolean {
  return (
    name === "main" ||
    name === "pages/_app" ||
    name === "pages/_document" ||
    name.startsWith("app/")
  );
}

/**
 * Check if chunk is dynamic (loaded on demand)
 */
function isDynamicChunk(name: string): boolean {
  return name.includes("chunk") || name.includes("dynamic") || /^\d+$/.test(name);
}

/**
 * Scan directory recursively for files
 */
function scanDirectory(dirPath: string, assets: BundleAsset[], projectRoot: string): void {
  if (!existsSync(dirPath)) {
    return;
  }

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        scanDirectory(fullPath, assets, projectRoot);
      } else if (entry.isFile()) {
        try {
          const stats = statSync(fullPath);
          const size = stats.size;

          // Calculate gzip size
          let gzipSize: number | undefined;
          try {
            const content = readFileSync(fullPath);
            // Only gzip text-based files
            const type = getAssetType(entry.name);
            if (type === "js" || type === "css") {
              gzipSize = gzipSync(content).length;
            }
          } catch {
            // Ignore gzip calculation errors
          }

          const isClient = isClientPath(fullPath);
          const isServer = isServerPath(fullPath);

          // Determine if shared (used by multiple routes)
          // This is a heuristic: chunks in /static/chunks/ that aren't route-specific
          const isShared = isClient && !fullPath.includes("/pages/") && !fullPath.includes("/app/");

          assets.push({
            name: entry.name,
            path: fullPath,
            size,
            gzipSize,
            type: getAssetType(entry.name),
            isClient,
            isServer,
            isShared,
          });
        } catch {
          // Skip files that can't be read
        }
      }
    }
  } catch {
    // Skip directories that can't be read
  }
}

/**
 * Group assets into chunks
 */
function buildChunks(assets: BundleAsset[]): ChunkInfo[] {
  const chunkMap = new Map<string, BundleAsset[]>();

  // Group assets by base chunk name
  for (const asset of assets) {
    if (asset.type === "js" || asset.type === "css") {
      const baseName = extractChunkBaseName(asset.name);
      if (!chunkMap.has(baseName)) {
        chunkMap.set(baseName, []);
      }
      chunkMap.get(baseName)!.push(asset);
    }
  }

  const chunks: ChunkInfo[] = [];

  for (const [name, chunkAssets] of chunkMap.entries()) {
    const files = chunkAssets.map((a) => a.name);
    const size = chunkAssets.reduce((sum, a) => sum + a.size, 0);
    const gzipSize = chunkAssets.reduce((sum, a) => {
      return sum + (a.gzipSize || 0);
    }, 0);

    chunks.push({
      name,
      files,
      size,
      gzipSize: gzipSize > 0 ? gzipSize : undefined,
      isEntry: isEntryChunk(name),
      isDynamic: isDynamicChunk(name),
      isShared: chunkAssets.some((a) => a.isShared),
    });
  }

  return chunks;
}

/**
 * Map routes to bundles
 */
function buildRouteMapping(
  routes: RouteInfo[],
  assets: BundleAsset[],
  chunks: ChunkInfo[]
): RouteBundleInfo[] {
  const routeMapping: RouteBundleInfo[] = [];

  for (const route of routes) {
    const clientChunks: string[] = [];
    const serverChunks: string[] = [];
    let totalClientSize = 0;
    let totalServerSize = 0;

    // Find server bundles for this route
    const routePath =
      route.path === "/" ? "index" : route.path.replace(/^\//, "").replace(/\//g, "-");

    for (const asset of assets) {
      if (asset.isServer && asset.path.includes(routePath)) {
        serverChunks.push(asset.name);
        totalServerSize += asset.size;
      }
    }

    // Find client chunks for this route
    // App Router: look for app/... chunks
    // Pages Router: look for pages/... chunks
    const routeSegment =
      route.router === "app"
        ? route.path.replace(/^\//, "").replace(/\//g, "-")
        : route.path.replace(/^\//, "").replace(/\//g, "-");

    for (const chunk of chunks) {
      if (chunk.name.includes(routeSegment) || chunk.name.includes(routePath)) {
        if (!clientChunks.includes(chunk.name)) {
          clientChunks.push(chunk.name);
          totalClientSize += chunk.size;
        }
      }
    }

    // Also include shared chunks for client
    for (const chunk of chunks) {
      if (chunk.isShared && !clientChunks.includes(chunk.name)) {
        clientChunks.push(chunk.name);
        totalClientSize += chunk.size;
      }
    }

    routeMapping.push({
      route: route.path,
      clientChunks,
      serverChunks,
      totalClientSize,
      totalServerSize,
    });
  }

  return routeMapping;
}

/**
 * Scan Next.js build output and generate bundle snapshot
 */
export function scanBundles(projectRoot: string): BundlesSnapshot | null {
  const nextDir = join(projectRoot, NEXT_DIR);

  // Check if .next directory exists
  if (!existsSync(nextDir)) {
    return null;
  }

  const assets: BundleAsset[] = [];

  // Scan key directories
  const directoriesToScan = [
    join(nextDir, "static", "chunks"),
    join(nextDir, "static"),
    join(nextDir, "server", "app"),
    join(nextDir, "server", "chunks"),
    join(nextDir, "server", "pages"),
  ];

  for (const dir of directoriesToScan) {
    scanDirectory(dir, assets, projectRoot);
  }

  // Build chunks from assets
  const chunks = buildChunks(assets);

  // Get routes for mapping
  const routes = scanAllRoutes(projectRoot);
  const routeMapping = buildRouteMapping(
    routes.appRoutes.concat(routes.pagesRoutes),
    assets,
    chunks
  );

  // Calculate totals
  const totalClientSize = assets.filter((a) => a.isClient).reduce((sum, a) => sum + a.size, 0);

  const totalServerSize = assets.filter((a) => a.isServer).reduce((sum, a) => sum + a.size, 0);

  return {
    assets,
    chunks,
    routeMapping,
    totalClientSize,
    totalServerSize,
    generatedAt: Date.now(),
  };
}
