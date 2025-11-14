/**
 * Tests for Phase 4: Performance & Streaming Diagnostics
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  recordRscRenderEvent,
  recordSuspenseEvent,
  recordStreamingEvent,
  beginSession,
  endSession,
  getRuntimeSnapshot,
  setCurrentRoute,
} from "../src/instrumentation/sessions.js";
import {
  buildTimelineForSession,
  detectWaterfalls,
  calculatePerformanceMetrics,
} from "../src/instrumentation/timeline.js";
import { instrumentRSC, createInstrumentedRSC } from "../src/instrumentation/instrumentRSC.js";
import { instrumentSuspense } from "../src/instrumentation/instrumentSuspense.js";
import {
  instrumentStreaming,
  recordStreamingPhase,
} from "../src/instrumentation/instrumentStreaming.js";
import { recordStreamingEvent } from "../src/instrumentation/sessions.js";
import type {
  RscRenderEvent,
  SuspenseEvent,
  StreamingEvent,
  SessionEvent,
} from "../src/types/runtime.js";

describe("Performance Instrumentation", () => {
  beforeEach(() => {
    // Reset snapshot before each test
    const snapshot = getRuntimeSnapshot();
    snapshot.sessions = [];
    snapshot.activeSessionId = null;
    setCurrentRoute(null);
  });

  describe("RSC Instrumentation", () => {
    it("should record RSC render events", () => {
      setCurrentRoute("/test");
      beginSession("/test");

      recordRscRenderEvent({
        file: "/app/page.tsx",
        componentName: "Page",
        route: "/test",
        durationMs: 50,
        startedAt: Date.now() - 50,
        finishedAt: Date.now(),
        isAsync: false,
      });

      const snapshot = getRuntimeSnapshot();
      expect(snapshot.sessions.length).toBe(1);
      const session = snapshot.sessions[0];
      expect(session.rsc.length).toBe(1);
      expect(session.rsc[0].componentName).toBe("Page");
      expect(session.rsc[0].durationMs).toBe(50);
      expect(session.rsc[0].isAsync).toBe(false);
    });

    it("should wrap async components", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      instrumentRSC();
      setCurrentRoute("/async");
      beginSession("/async");

      const asyncComponent = createInstrumentedRSC(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "result";
      }, "AsyncComponent");

      await asyncComponent();

      // Wait a bit for async recording
      await new Promise((resolve) => setTimeout(resolve, 20));

      const snapshot = getRuntimeSnapshot();
      expect(snapshot.sessions[0].rsc.length).toBeGreaterThan(0);
      const rscEvent = snapshot.sessions[0].rsc[0];
      expect(rscEvent.isAsync).toBe(true);
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("Suspense Instrumentation", () => {
    it("should record Suspense events", () => {
      setCurrentRoute("/suspense");
      beginSession("/suspense");

      recordSuspenseEvent({
        boundaryName: "DataBoundary",
        route: "/suspense",
        startedAt: Date.now() - 100,
        resolvedAt: Date.now(),
        fallbackRenderMs: 50,
        contentResolveMs: 100,
      });

      const snapshot = getRuntimeSnapshot();
      expect(snapshot.sessions[0].suspense.length).toBe(1);
      const suspenseEvent = snapshot.sessions[0].suspense[0];
      expect(suspenseEvent.boundaryName).toBe("DataBoundary");
      expect(suspenseEvent.fallbackRenderMs).toBe(50);
      expect(suspenseEvent.contentResolveMs).toBe(100);
    });

    it("should set up global hooks in development", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      instrumentSuspense();
      expect((globalThis as any).__next_pulse_suspense_patch).toBeDefined();
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("Streaming Instrumentation", () => {
    it("should record streaming events", () => {
      setCurrentRoute("/stream");
      beginSession("/stream");

      recordStreamingEvent({
        route: "/stream",
        phase: "shell",
        timestamp: Date.now(),
      });
      recordStreamingEvent({
        route: "/stream",
        phase: "data",
        timestamp: Date.now() + 10,
      });
      recordStreamingEvent({
        route: "/stream",
        phase: "content",
        timestamp: Date.now() + 20,
      });
      recordStreamingEvent({
        route: "/stream",
        phase: "complete",
        timestamp: Date.now() + 30,
      });

      const snapshot = getRuntimeSnapshot();
      expect(snapshot.sessions[0].streaming.length).toBe(4);
      expect(snapshot.sessions[0].streaming[0].phase).toBe("shell");
      expect(snapshot.sessions[0].streaming[3].phase).toBe("complete");
    });

    it("should set up global hooks in development", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      instrumentStreaming();
      expect((globalThis as any).__next_pulse_streaming_patch).toBeDefined();
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("Timeline Builder", () => {
    it("should build timeline from session events", () => {
      setCurrentRoute("/timeline");
      beginSession("/timeline");

      // Add various events
      recordRscRenderEvent({
        file: "/app/page.tsx",
        componentName: "Page",
        route: "/timeline",
        durationMs: 30,
        startedAt: 1000,
        finishedAt: 1030,
        isAsync: false,
      });

      recordStreamingEvent({
        route: "/timeline",
        phase: "shell",
        timestamp: 2000,
      });

      recordStreamingEvent({
        route: "/timeline",
        phase: "data",
        timestamp: 2100,
      });

      const snapshot = getRuntimeSnapshot();
      const session = snapshot.sessions[0];
      const timeline = buildTimelineForSession(session);

      expect(timeline.length).toBeGreaterThan(0);
      expect(timeline.some((e) => e.type === "rsc")).toBe(true);
      expect(timeline.some((e) => e.type === "streaming")).toBe(true);
    });

    it("should sort timeline entries by timestamp", () => {
      setCurrentRoute("/sorted");
      beginSession("/sorted");

      recordRscRenderEvent({
        file: "/app/page.tsx",
        componentName: "Page",
        route: "/sorted",
        durationMs: 20,
        startedAt: 2000,
        finishedAt: 2020,
        isAsync: false,
      });

      recordRscRenderEvent({
        file: "/app/layout.tsx",
        componentName: "Layout",
        route: "/sorted",
        durationMs: 10,
        startedAt: 1000,
        finishedAt: 1010,
        isAsync: false,
      });

      const snapshot = getRuntimeSnapshot();
      const session = snapshot.sessions[0];
      const timeline = buildTimelineForSession(session);

      const rscEntries = timeline.filter((e) => e.type === "rsc");
      expect(rscEntries[0].timestamp).toBeLessThan(rscEntries[1].timestamp);
    });
  });

  describe("Waterfall Detection", () => {
    it("should detect fetch waterfalls", () => {
      setCurrentRoute("/waterfall");
      beginSession("/waterfall");

      const baseTime = Date.now();

      // Create 3 serial fetches (waterfall)
      recordRscRenderEvent({
        file: null,
        componentName: null,
        route: "/waterfall",
        durationMs: 100,
        startedAt: baseTime,
        finishedAt: baseTime + 100,
        isAsync: true,
      });

      recordRscRenderEvent({
        file: null,
        componentName: null,
        route: "/waterfall",
        durationMs: 100,
        startedAt: baseTime + 100,
        finishedAt: baseTime + 200,
        isAsync: true,
      });

      recordRscRenderEvent({
        file: null,
        componentName: null,
        route: "/waterfall",
        durationMs: 100,
        startedAt: baseTime + 200,
        finishedAt: baseTime + 300,
        isAsync: true,
      });

      const snapshot = getRuntimeSnapshot();
      const session = snapshot.sessions[0];
      const waterfalls = detectWaterfalls(session);

      expect(waterfalls.length).toBeGreaterThan(0);
      expect(waterfalls[0].type).toBe("rsc");
      expect(waterfalls[0].events.length).toBeGreaterThanOrEqual(3);
    });

    it("should not detect parallel operations as waterfalls", () => {
      setCurrentRoute("/parallel");
      beginSession("/parallel");

      const baseTime = Date.now();

      // Create 3 parallel RSC renders
      recordRscRenderEvent({
        file: null,
        componentName: null,
        route: "/parallel",
        durationMs: 100,
        startedAt: baseTime,
        finishedAt: baseTime + 100,
        isAsync: true,
      });

      recordRscRenderEvent({
        file: null,
        componentName: null,
        route: "/parallel",
        durationMs: 100,
        startedAt: baseTime + 10, // Overlaps
        finishedAt: baseTime + 110,
        isAsync: true,
      });

      recordRscRenderEvent({
        file: null,
        componentName: null,
        route: "/parallel",
        durationMs: 100,
        startedAt: baseTime + 20, // Overlaps
        finishedAt: baseTime + 120,
        isAsync: true,
      });

      const snapshot = getRuntimeSnapshot();
      const session = snapshot.sessions[0];
      const waterfalls = detectWaterfalls(session);

      // Should not detect as waterfall since they overlap
      expect(waterfalls.length).toBe(0);
    });
  });

  describe("Performance Metrics", () => {
    it("should calculate performance metrics", () => {
      setCurrentRoute("/metrics");
      beginSession("/metrics");

      const baseTime = Date.now();

      recordRscRenderEvent({
        file: "/app/page.tsx",
        componentName: "Page",
        route: "/metrics",
        durationMs: 50,
        startedAt: baseTime,
        finishedAt: baseTime + 50,
        isAsync: false,
      });

      recordRscRenderEvent({
        file: "/app/slow.tsx",
        componentName: "Slow",
        route: "/metrics",
        durationMs: 200,
        startedAt: baseTime + 100,
        finishedAt: baseTime + 300,
        isAsync: false,
      });

      recordSuspenseEvent({
        boundaryName: "Boundary1",
        route: "/metrics",
        startedAt: baseTime,
        resolvedAt: baseTime + 50,
        fallbackRenderMs: 20,
        contentResolveMs: 50,
      });

      recordStreamingEvent({
        route: "/metrics",
        phase: "shell",
        timestamp: baseTime,
      });

      recordStreamingEvent({
        route: "/metrics",
        phase: "complete",
        timestamp: baseTime + 300,
      });

      const snapshot = getRuntimeSnapshot();
      const session = snapshot.sessions[0];
      const metrics = calculatePerformanceMetrics(session);

      expect(metrics.totalServerRenderTime).toBeGreaterThan(0);
      expect(metrics.totalStreamingTime).toBe(300);
      expect(metrics.slowestRscComponent).not.toBeNull();
      expect(metrics.slowestRscComponent?.componentName).toBe("Slow");
      expect(metrics.suspenseBoundaryCount).toBe(1);
    });
  });
});
