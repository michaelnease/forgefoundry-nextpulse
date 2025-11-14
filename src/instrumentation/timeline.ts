/**
 * Performance timeline builder for NextPulse
 * Converts raw events into timeline entries and detects waterfalls
 */

import type {
  PerformanceTimelineEntry,
  FetchEvent,
  ServerActionEvent,
  RscRenderEvent,
  SuspenseEvent,
  StreamingEvent,
  SessionEvent,
} from "../types/runtime.js";
import { addTimelineEntries } from "./sessions.js";

/**
 * Build timeline entries from session events
 * Should be called after events are recorded
 */
export function buildTimelineForSession(session: SessionEvent): PerformanceTimelineEntry[] {
  const entries: PerformanceTimelineEntry[] = [];

  // Add fetch events to timeline
  session.fetches.forEach((fetch) => {
    entries.push({
      type: "fetch",
      timestamp: fetch.startedAt,
      durationMs: fetch.durationMs,
      refId: fetch.id,
    });
  });

  // Add action events to timeline
  session.actions.forEach((action) => {
    entries.push({
      type: "action",
      timestamp: action.startedAt,
      durationMs: action.executionTimeMs,
      refId: action.id,
    });
  });

  // Add RSC render events to timeline
  session.rsc.forEach((rsc) => {
    entries.push({
      type: "rsc",
      timestamp: rsc.startedAt,
      durationMs: rsc.durationMs,
      refId: rsc.id,
    });
  });

  // Add Suspense events to timeline
  session.suspense.forEach((suspense) => {
    entries.push({
      type: "suspense",
      timestamp: suspense.startedAt,
      durationMs: suspense.contentResolveMs,
      refId: suspense.id,
    });
  });

  // Add streaming events to timeline (no duration, just markers)
  session.streaming.forEach((streaming) => {
    entries.push({
      type: "streaming",
      timestamp: streaming.timestamp,
      refId: streaming.id,
    });
  });

  // Sort by timestamp
  entries.sort((a, b) => a.timestamp - b.timestamp);

  return entries;
}

/**
 * Update timeline for active session
 */
export function updateTimelineForActiveSession(): void {
  // This will be called after events are recorded
  // For now, we'll build timeline on-demand when fetching snapshot
}

/**
 * Detect waterfalls in a session
 * A waterfall is 3+ serial async operations (fetches or async RSC)
 */
export function detectWaterfalls(session: SessionEvent): Array<{
  type: "fetch" | "rsc";
  events: Array<FetchEvent | RscRenderEvent>;
  startTime: number;
  endTime: number;
  totalDuration: number;
}> {
  const waterfalls: Array<{
    type: "fetch" | "rsc";
    events: Array<FetchEvent | RscRenderEvent>;
    startTime: number;
    endTime: number;
    totalDuration: number;
  }> = [];

  // Check for fetch waterfalls (serial fetch calls)
  const sortedFetches = [...session.fetches].sort((a, b) => a.startedAt - b.startedAt);
  let currentWaterfall: FetchEvent[] = [];

  for (let i = 0; i < sortedFetches.length; i++) {
    const current = sortedFetches[i];
    const previous = sortedFetches[i - 1];

    if (previous && current.startedAt >= previous.finishedAt) {
      // Serial fetch (starts after previous ends)
      if (currentWaterfall.length === 0) {
        currentWaterfall.push(previous);
      }
      currentWaterfall.push(current);
    } else {
      // Parallel or overlapping fetch
      if (currentWaterfall.length >= 3) {
        waterfalls.push({
          type: "fetch",
          events: [...currentWaterfall],
          startTime: currentWaterfall[0].startedAt,
          endTime: currentWaterfall[currentWaterfall.length - 1].finishedAt,
          totalDuration:
            currentWaterfall[currentWaterfall.length - 1].finishedAt - currentWaterfall[0].startedAt,
        });
      }
      currentWaterfall = [];
    }
  }

  // Check final waterfall
  if (currentWaterfall.length >= 3) {
    waterfalls.push({
      type: "fetch",
      events: [...currentWaterfall],
      startTime: currentWaterfall[0].startedAt,
      endTime: currentWaterfall[currentWaterfall.length - 1].finishedAt,
      totalDuration:
        currentWaterfall[currentWaterfall.length - 1].finishedAt - currentWaterfall[0].startedAt,
    });
  }

  // Check for RSC waterfalls (serial async RSC components)
  const asyncRsc = session.rsc.filter((r) => r.isAsync);
  const sortedRsc = [...asyncRsc].sort((a, b) => a.startedAt - b.startedAt);
  let currentRscWaterfall: RscRenderEvent[] = [];

  for (let i = 0; i < sortedRsc.length; i++) {
    const current = sortedRsc[i];
    const previous = sortedRsc[i - 1];

    if (previous && current.startedAt >= previous.finishedAt) {
      // Serial RSC (starts after previous ends)
      if (currentRscWaterfall.length === 0) {
        currentRscWaterfall.push(previous);
      }
      currentRscWaterfall.push(current);
    } else {
      // Parallel or overlapping RSC
      if (currentRscWaterfall.length >= 3) {
        waterfalls.push({
          type: "rsc",
          events: [...currentRscWaterfall],
          startTime: currentRscWaterfall[0].startedAt,
          endTime: currentRscWaterfall[currentRscWaterfall.length - 1].finishedAt,
          totalDuration:
            currentRscWaterfall[currentRscWaterfall.length - 1].finishedAt -
            currentRscWaterfall[0].startedAt,
        });
      }
      currentRscWaterfall = [];
    }
  }

  // Check final RSC waterfall
  if (currentRscWaterfall.length >= 3) {
    waterfalls.push({
      type: "rsc",
      events: [...currentRscWaterfall],
      startTime: currentRscWaterfall[0].startedAt,
      endTime: currentRscWaterfall[currentRscWaterfall.length - 1].finishedAt,
      totalDuration:
        currentRscWaterfall[currentRscWaterfall.length - 1].finishedAt -
        currentRscWaterfall[0].startedAt,
    });
  }

  return waterfalls;
}

/**
 * Calculate performance metrics for a session
 */
export function calculatePerformanceMetrics(session: SessionEvent): {
  totalServerRenderTime: number;
  totalStreamingTime: number;
  slowestRscComponent: RscRenderEvent | null;
  suspenseBoundaryCount: number;
  waterfallCount: number;
} {
  const waterfalls = detectWaterfalls(session);

  // Calculate total server render time (from first RSC to last)
  let totalServerRenderTime = 0;
  if (session.rsc.length > 0) {
    const sortedRsc = [...session.rsc].sort((a, b) => a.startedAt - b.startedAt);
    const firstRsc = sortedRsc[0];
    const lastRsc = sortedRsc[sortedRsc.length - 1];
    totalServerRenderTime = lastRsc.finishedAt - firstRsc.startedAt;
  }

  // Calculate total streaming time (from first to last streaming event)
  let totalStreamingTime = 0;
  if (session.streaming.length > 0) {
    const sortedStreaming = [...session.streaming].sort((a, b) => a.timestamp - b.timestamp);
    const firstStreaming = sortedStreaming[0];
    const lastStreaming = sortedStreaming[sortedStreaming.length - 1];
    totalStreamingTime = lastStreaming.timestamp - firstStreaming.timestamp;
  }

  // Find slowest RSC component
  const slowestRsc =
    session.rsc.length > 0
      ? session.rsc.reduce((slowest, current) =>
          current.durationMs > slowest.durationMs ? current : slowest
        )
      : null;

  return {
    totalServerRenderTime,
    totalStreamingTime,
    slowestRscComponent: slowestRsc,
    suspenseBoundaryCount: session.suspense.length,
    waterfallCount: waterfalls.length,
  };
}

