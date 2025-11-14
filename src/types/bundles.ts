/**
 * Bundle and asset analysis types for NextPulse
 * Tracks Next.js build output: bundles, chunks, assets, and route mappings
 */

export interface BundleAsset {
  name: string; // filename
  path: string; // absolute path
  size: number; // raw bytes
  gzipSize?: number; // optional gzip size
  type: "js" | "css" | "image" | "font" | "other";
  isClient: boolean;
  isServer: boolean;
  isShared: boolean;
}

export interface ChunkInfo {
  name: string;
  files: string[];
  size: number;
  gzipSize?: number;
  isEntry: boolean;
  isDynamic: boolean;
  isShared: boolean;
  routes?: string[];
}

export interface RouteBundleInfo {
  route: string;
  clientChunks: string[];
  serverChunks: string[];
  totalClientSize: number;
  totalServerSize: number;
}

export interface BundlesSnapshot {
  assets: BundleAsset[];
  chunks: ChunkInfo[];
  routeMapping: RouteBundleInfo[];
  totalClientSize: number;
  totalServerSize: number;
  generatedAt: number;
}
