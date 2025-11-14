/**
 * Client-safe overlay view builder
 * This module can be imported by client components without pulling in server-side code
 */

import type { RuntimeSnapshot, SessionEvent } from "../types/runtime.js";
import type { OverlayView } from "./types.js";

/**
 * Build an overlay-friendly view from runtime snapshot
 * Pre-computes values that the Panel component needs
 * This is a pure function that only uses RuntimeSnapshot - no server-side imports
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
