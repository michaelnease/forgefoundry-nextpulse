/**
 * Types for the shared diagnostics module
 */

import type {
  RuntimeSnapshot,
  SessionEvent,
  FetchEvent,
  ServerActionEvent,
  RscRenderEvent,
} from "../types/runtime.js";
import type { ErrorLogSnapshot } from "../types/errors.js";
import type { BundlesSnapshot } from "../types/bundles.js";
import type { RoutesSnapshot } from "../types/routes.js";
import type { Metadata } from "../runtime/Panel.js";
import type { PerformanceSnapshot } from "../types/snapshot.js";

/**
 * Complete diagnostics snapshot
 * Combines all diagnostic data from instrumentation and scanners
 */
export interface DiagnosticsSnapshot {
  metadata?: Metadata;
  runtime: RuntimeSnapshot;
  errors: ErrorLogSnapshot;
  bundles: BundlesSnapshot | null;
  routes: RoutesSnapshot;
  performance: PerformanceSnapshot;
  generatedAt: number;
}

/**
 * Overlay-friendly view of runtime data
 * Pre-computed values for the Panel component
 */
export interface OverlayView {
  activeSession: SessionEvent | null;
  recentFetches: FetchEvent[];
  recentServerActions: ServerActionEvent[];
  slowestRscRender: RscRenderEvent | null;
  suspenseCount: number;
  streamingCount: number;
  hasErrors: boolean;
  statusLevel: "ok" | "warning" | "error";
}
