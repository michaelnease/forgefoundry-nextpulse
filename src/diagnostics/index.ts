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
function buildPerformanceSnapshot(runtimeSnapshot: RuntimeSnapshot): PerformanceSnapshot {
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

/**
 * Build an overlay-friendly view from runtime snapshot
 * Pre-computes values that the Panel component needs
 */
export function buildOverlayView(runtime: RuntimeSnapshot): OverlayView {
  // Find active session
  const activeSession: SessionEvent | null = runtime.activeSessionId
    ? runtime.sessions.find((s) => s.id === runtime.activeSessionId) || null
    : null;

  // Get recent fetches (last 5)
  const recentFetches = activeSession?.fetches.slice(-5) || [];

  // Get recent server actions (last 5)
  const recentServerActions = activeSession?.actions.slice(-5) || [];

  // Find slowest RSC render
  const slowestRscRender = activeSession?.rsc.length
    ? activeSession.rsc.reduce((slowest, current) =>
        current.durationMs > slowest.durationMs ? current : slowest
      )
    : null;

  // Count suspense and streaming events
  const suspenseCount = activeSession?.suspense.length || 0;
  const streamingCount = activeSession?.streaming.length || 0;

  // Determine status level based on errors and slow requests
  // Check for errors in the active session
  const hasErrorsInSession = activeSession?.actions.some((a) => a.status === "error") || false;

  // Check for slow requests (fetches > 1s or RSC > 500ms)
  const hasSlowRequests =
    activeSession?.fetches.some((f) => f.durationMs > 1000) ||
    activeSession?.rsc.some((r) => r.durationMs > 500) ||
    false;

  // Determine status level
  let statusLevel: "ok" | "warning" | "error" = "ok";
  if (hasErrorsInSession) {
    statusLevel = "error";
  } else if (hasSlowRequests) {
    statusLevel = "warning";
  }

  // Note: hasErrors is determined by the errors snapshot, not just session errors
  // This will be set by the Panel component when it has access to errorsData
  const hasErrors = false; // Will be computed by Panel when errors data is available

  return {
    activeSession,
    recentFetches,
    recentServerActions,
    slowestRscRender,
    suspenseCount,
    streamingCount,
    hasErrors,
    statusLevel,
  };
}
