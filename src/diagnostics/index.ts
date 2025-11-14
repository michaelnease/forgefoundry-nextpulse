/**
 * Shared diagnostics module for NextPulse
 * Centralizes how we build a complete diagnostics view from low-level instrumentation
 * Used by both the in-app overlay and the local dashboard server
 */

import { getRuntimeSnapshot } from "../instrumentation/sessions.js";
import { getErrorLogSnapshot } from "../instrumentation/errors.js";
import { scanBundles } from "../server/bundleScanner.js";
import { scanAllRoutes } from "../server/routesScanner.js";
import {
  buildTimelineForSession,
  calculatePerformanceMetrics,
  detectWaterfalls,
} from "../instrumentation/timeline.js";
import { loadMetadata } from "../server/loadMetadata.js";
import type { DiagnosticsSnapshot, OverlayView } from "./types.js";
import type { RuntimeSnapshot, SessionEvent } from "../types/runtime.js";
import type { PerformanceSnapshot } from "../types/snapshot.js";

/**
 * Build a complete diagnostics snapshot
 * Combines all diagnostic data from instrumentation and scanners
 */
export function buildDiagnosticsSnapshot(projectRoot: string): DiagnosticsSnapshot {
  // Gather all data sources
  const runtime = getRuntimeSnapshot();
  const errors = getErrorLogSnapshot();
  const bundles = scanBundles(projectRoot);
  const routes = scanAllRoutes(projectRoot);

  // Build performance snapshot with enriched metrics
  const performance = buildPerformanceSnapshot(runtime);

  // Optionally load metadata (may not always be available)
  let metadata;
  try {
    metadata = loadMetadata(projectRoot);
  } catch {
    // Metadata is optional
  }

  return {
    metadata,
    runtime,
    errors,
    bundles,
    routes,
    performance,
    generatedAt: Date.now(),
  };
}

/**
 * Build performance snapshot from runtime snapshot
 * Enriches sessions with timeline, metrics, and waterfalls
 */
export function buildPerformanceSnapshot(runtimeSnapshot: RuntimeSnapshot): PerformanceSnapshot {
  const enrichedSessions = runtimeSnapshot.sessions.map((session) => {
    // Build timeline if not already built
    const timeline =
      session.timeline.length > 0 ? session.timeline : buildTimelineForSession(session);

    const metrics = calculatePerformanceMetrics(session);
    const waterfalls = detectWaterfalls(session);

    return {
      id: session.id,
      route: session.route,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      metrics: {
        totalServerRenderTime: metrics.totalServerRenderTime,
        totalStreamingTime: metrics.totalStreamingTime,
        slowestRscComponent: metrics.slowestRscComponent
          ? {
              componentName: metrics.slowestRscComponent.componentName,
              durationMs: metrics.slowestRscComponent.durationMs,
            }
          : null,
        suspenseBoundaryCount: metrics.suspenseBoundaryCount,
        waterfallCount: metrics.waterfallCount,
      },
      waterfalls: waterfalls.map((w) => ({
        type: w.type,
        events: w.events, // Keep events for context
        totalDuration: w.totalDuration,
      })),
    };
  });

  return {
    sessions: enrichedSessions,
    activeSessionId: runtimeSnapshot.activeSessionId,
    lastUpdated: runtimeSnapshot.lastUpdated,
  };
}

// Re-export buildOverlayView from the client-safe module
export { buildOverlayView } from "./overlayView.js";
