import { describe, it, expect } from "vitest";
import { buildOverlayView, buildDiagnosticsSnapshot } from "../src/diagnostics/index.js";
import type { RuntimeSnapshot, SessionEvent } from "../src/types/runtime.js";

describe("diagnostics", () => {
  describe("buildOverlayView", () => {
    it("should return null activeSession when no active session", () => {
      const runtime: RuntimeSnapshot = {
        sessions: [],
        activeSessionId: null,
        lastUpdated: Date.now(),
      };

      const view = buildOverlayView(runtime);

      expect(view.activeSession).toBeNull();
      expect(view.recentFetches).toEqual([]);
      expect(view.recentServerActions).toEqual([]);
      expect(view.slowestRscRender).toBeNull();
      expect(view.suspenseCount).toBe(0);
      expect(view.streamingCount).toBe(0);
      expect(view.statusLevel).toBe("ok");
    });

    it("should find active session and compute metrics", () => {
      const session: SessionEvent = {
        id: "session_1",
        route: "/test",
        startedAt: Date.now() - 1000,
        finishedAt: null,
        fetches: [
          {
            id: "fetch_1",
            url: "/api/test",
            method: "GET",
            route: "/test",
            origin: "server-component",
            statusCode: 200,
            durationMs: 150,
            cacheMode: null,
            cacheResult: "miss",
            startedAt: Date.now() - 500,
            finishedAt: Date.now() - 350,
          },
          {
            id: "fetch_2",
            url: "/api/test2",
            method: "GET",
            route: "/test",
            origin: "server-component",
            statusCode: 200,
            durationMs: 200,
            cacheMode: null,
            cacheResult: "miss",
            startedAt: Date.now() - 300,
            finishedAt: Date.now() - 100,
          },
        ],
        actions: [
          {
            id: "action_1",
            name: "testAction",
            file: "test.ts",
            route: "/test",
            executionTimeMs: 50,
            status: "success",
            startedAt: Date.now() - 200,
            finishedAt: Date.now() - 150,
          },
        ],
        rsc: [
          {
            id: "rsc_1",
            file: "component.tsx",
            componentName: "TestComponent",
            route: "/test",
            durationMs: 100,
            startedAt: Date.now() - 400,
            finishedAt: Date.now() - 300,
            isAsync: false,
          },
        ],
        suspense: [],
        streaming: [],
        timeline: [],
      };

      const runtime: RuntimeSnapshot = {
        sessions: [session],
        activeSessionId: "session_1",
        lastUpdated: Date.now(),
      };

      const view = buildOverlayView(runtime);

      expect(view.activeSession).not.toBeNull();
      expect(view.activeSession?.id).toBe("session_1");
      expect(view.recentFetches).toHaveLength(2);
      expect(view.recentServerActions).toHaveLength(1);
      expect(view.slowestRscRender).not.toBeNull();
      expect(view.slowestRscRender?.componentName).toBe("TestComponent");
      expect(view.statusLevel).toBe("ok");
    });

    it("should detect error status from failed actions", () => {
      const session: SessionEvent = {
        id: "session_1",
        route: "/test",
        startedAt: Date.now() - 1000,
        finishedAt: null,
        fetches: [],
        actions: [
          {
            id: "action_1",
            name: "testAction",
            file: "test.ts",
            route: "/test",
            executionTimeMs: 50,
            status: "error",
            errorMessage: "Test error",
            startedAt: Date.now() - 200,
            finishedAt: Date.now() - 150,
          },
        ],
        rsc: [],
        suspense: [],
        streaming: [],
        timeline: [],
      };

      const runtime: RuntimeSnapshot = {
        sessions: [session],
        activeSessionId: "session_1",
        lastUpdated: Date.now(),
      };

      const view = buildOverlayView(runtime);

      expect(view.statusLevel).toBe("error");
    });

    it("should detect warning status from slow requests", () => {
      const session: SessionEvent = {
        id: "session_1",
        route: "/test",
        startedAt: Date.now() - 1000,
        finishedAt: null,
        fetches: [
          {
            id: "fetch_1",
            url: "/api/test",
            method: "GET",
            route: "/test",
            origin: "server-component",
            statusCode: 200,
            durationMs: 1500, // > 1s
            cacheMode: null,
            cacheResult: "miss",
            startedAt: Date.now() - 500,
            finishedAt: Date.now() - 350,
          },
        ],
        actions: [],
        rsc: [],
        suspense: [],
        streaming: [],
        timeline: [],
      };

      const runtime: RuntimeSnapshot = {
        sessions: [session],
        activeSessionId: "session_1",
        lastUpdated: Date.now(),
      };

      const view = buildOverlayView(runtime);

      expect(view.statusLevel).toBe("warning");
    });

    it("should limit recent fetches to last 5", () => {
      const fetches = Array.from({ length: 10 }, (_, i) => ({
        id: `fetch_${i}`,
        url: `/api/test${i}`,
        method: "GET",
        route: "/test",
        origin: "server-component" as const,
        statusCode: 200,
        durationMs: 100,
        cacheMode: null,
        cacheResult: "miss" as const,
        startedAt: Date.now() - (10 - i) * 100,
        finishedAt: Date.now() - (10 - i) * 100 + 100,
      }));

      const session: SessionEvent = {
        id: "session_1",
        route: "/test",
        startedAt: Date.now() - 1000,
        finishedAt: null,
        fetches,
        actions: [],
        rsc: [],
        suspense: [],
        streaming: [],
        timeline: [],
      };

      const runtime: RuntimeSnapshot = {
        sessions: [session],
        activeSessionId: "session_1",
        lastUpdated: Date.now(),
      };

      const view = buildOverlayView(runtime);

      expect(view.recentFetches).toHaveLength(5);
      // Should be the last 5 (slice(-5) returns last 5 in original order)
      expect(view.recentFetches[0].id).toBe("fetch_5");
      expect(view.recentFetches[4].id).toBe("fetch_9");
    });
  });

  describe("buildDiagnosticsSnapshot", () => {
    it("should build complete diagnostics snapshot", () => {
      const projectRoot = process.cwd();
      const snapshot = buildDiagnosticsSnapshot(projectRoot);

      expect(snapshot).toHaveProperty("runtime");
      expect(snapshot).toHaveProperty("errors");
      expect(snapshot).toHaveProperty("bundles");
      expect(snapshot).toHaveProperty("routes");
      expect(snapshot).toHaveProperty("performance");
      expect(snapshot).toHaveProperty("generatedAt");
      expect(typeof snapshot.generatedAt).toBe("number");

      // Verify runtime snapshot structure
      expect(snapshot.runtime).toHaveProperty("sessions");
      expect(snapshot.runtime).toHaveProperty("activeSessionId");
      expect(snapshot.runtime).toHaveProperty("lastUpdated");

      // Verify performance snapshot structure
      expect(snapshot.performance).toHaveProperty("sessions");
      expect(snapshot.performance).toHaveProperty("activeSessionId");
      expect(snapshot.performance).toHaveProperty("lastUpdated");
    });
  });
});
