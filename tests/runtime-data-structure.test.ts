import { describe, it, expect } from "vitest";
import type {
  RuntimeSnapshot,
  SessionEvent,
  FetchEvent,
  ServerActionEvent,
  RscRenderEvent,
  SuspenseEvent,
  StreamingEvent,
  PerformanceTimelineEntry,
} from "../src/types/runtime.js";

describe("Runtime Data Structures", () => {
  describe("SessionEvent structure", () => {
    it("should have all required fields with correct names", () => {
      const session: SessionEvent = {
        id: "session_test",
        route: "/test",
        startedAt: Date.now() - 5000,
        finishedAt: null,
        fetches: [],
        actions: [],
        rsc: [],
        suspense: [], // NOT suspenseBoundaries
        streaming: [], // NOT streamingEvents
        timeline: [],
      };

      // Validate field existence
      expect(session).toHaveProperty("id");
      expect(session).toHaveProperty("route");
      expect(session).toHaveProperty("startedAt");
      expect(session).toHaveProperty("finishedAt");
      expect(session).toHaveProperty("fetches");
      expect(session).toHaveProperty("actions");
      expect(session).toHaveProperty("rsc");
      expect(session).toHaveProperty("suspense");
      expect(session).toHaveProperty("streaming");
      expect(session).toHaveProperty("timeline");

      // Validate types
      expect(Array.isArray(session.fetches)).toBe(true);
      expect(Array.isArray(session.actions)).toBe(true);
      expect(Array.isArray(session.rsc)).toBe(true);
      expect(Array.isArray(session.suspense)).toBe(true);
      expect(Array.isArray(session.streaming)).toBe(true);
      expect(Array.isArray(session.timeline)).toBe(true);
    });

    it("should have suspense field (not suspenseBoundaries)", () => {
      const session: SessionEvent = {
        id: "session_test",
        route: "/test",
        startedAt: Date.now(),
        finishedAt: null,
        fetches: [],
        actions: [],
        rsc: [],
        suspense: [
          {
            id: "suspense_1",
            boundaryName: "DataBoundary",
            route: "/test",
            startedAt: Date.now() - 1000,
            resolvedAt: Date.now() - 300,
            fallbackRenderMs: 15,
            contentResolveMs: 700,
          },
        ],
        streaming: [],
        timeline: [],
      };

      expect(session).toHaveProperty("suspense");
      expect(session.suspense).toHaveLength(1);
      expect(session.suspense[0]).toHaveProperty("boundaryName");
      expect(session.suspense[0]).toHaveProperty("fallbackRenderMs");
      expect(session.suspense[0]).toHaveProperty("contentResolveMs");
    });

    it("should have streaming field (not streamingEvents)", () => {
      const session: SessionEvent = {
        id: "session_test",
        route: "/test",
        startedAt: Date.now(),
        finishedAt: null,
        fetches: [],
        actions: [],
        rsc: [],
        suspense: [],
        streaming: [
          {
            id: "stream_1",
            route: "/test",
            phase: "shell",
            timestamp: Date.now() - 1000,
          },
          {
            id: "stream_2",
            route: "/test",
            phase: "content",
            timestamp: Date.now() - 500,
          },
          {
            id: "stream_3",
            route: "/test",
            phase: "complete",
            timestamp: Date.now(),
          },
        ],
        timeline: [],
      };

      expect(session).toHaveProperty("streaming");
      expect(session.streaming).toHaveLength(3);
      expect(session.streaming[0]).toHaveProperty("phase");
      expect(session.streaming[0].phase).toBe("shell");
      expect(session.streaming[2].phase).toBe("complete");
    });
  });

  describe("FetchEvent structure", () => {
    it("should have all required fields", () => {
      const fetch: FetchEvent = {
        id: "fetch_1",
        url: "https://api.example.com/data",
        method: "GET",
        route: "/test",
        origin: "server-component",
        statusCode: 200,
        durationMs: 120,
        cacheMode: "force-cache",
        cacheResult: "miss",
        startedAt: Date.now() - 120,
        finishedAt: Date.now(),
      };

      expect(fetch).toHaveProperty("id");
      expect(fetch).toHaveProperty("url");
      expect(fetch).toHaveProperty("method");
      expect(fetch).toHaveProperty("route");
      expect(fetch).toHaveProperty("origin");
      expect(fetch).toHaveProperty("statusCode");
      expect(fetch).toHaveProperty("durationMs");
      expect(fetch).toHaveProperty("cacheMode");
      expect(fetch).toHaveProperty("cacheResult");
      expect(fetch).toHaveProperty("startedAt");
      expect(fetch).toHaveProperty("finishedAt");
    });
  });

  describe("RscRenderEvent structure", () => {
    it("should have all required fields", () => {
      const rsc: RscRenderEvent = {
        id: "rsc_1",
        file: "/app/page.tsx",
        componentName: "HomePage",
        route: "/",
        durationMs: 245,
        startedAt: Date.now() - 245,
        finishedAt: Date.now(),
        isAsync: true,
      };

      expect(rsc).toHaveProperty("id");
      expect(rsc).toHaveProperty("file");
      expect(rsc).toHaveProperty("componentName");
      expect(rsc).toHaveProperty("route");
      expect(rsc).toHaveProperty("durationMs");
      expect(rsc).toHaveProperty("startedAt");
      expect(rsc).toHaveProperty("finishedAt");
      expect(rsc).toHaveProperty("isAsync");
    });
  });

  describe("SuspenseEvent structure", () => {
    it("should have all required fields", () => {
      const suspense: SuspenseEvent = {
        id: "suspense_1",
        boundaryName: "DataBoundary",
        route: "/test",
        startedAt: Date.now() - 1000,
        resolvedAt: Date.now() - 300,
        fallbackRenderMs: 15,
        contentResolveMs: 700,
      };

      expect(suspense).toHaveProperty("id");
      expect(suspense).toHaveProperty("boundaryName");
      expect(suspense).toHaveProperty("route");
      expect(suspense).toHaveProperty("startedAt");
      expect(suspense).toHaveProperty("resolvedAt");
      expect(suspense).toHaveProperty("fallbackRenderMs");
      expect(suspense).toHaveProperty("contentResolveMs");
    });
  });

  describe("StreamingEvent structure", () => {
    it("should have all required fields", () => {
      const streaming: StreamingEvent = {
        id: "stream_1",
        route: "/test",
        phase: "shell",
        timestamp: Date.now(),
      };

      expect(streaming).toHaveProperty("id");
      expect(streaming).toHaveProperty("route");
      expect(streaming).toHaveProperty("phase");
      expect(streaming).toHaveProperty("timestamp");
    });

    it("should support all valid phase values", () => {
      const phases: Array<StreamingEvent["phase"]> = ["shell", "data", "content", "complete"];

      phases.forEach((phase) => {
        const streaming: StreamingEvent = {
          id: `stream_${phase}`,
          route: "/test",
          phase,
          timestamp: Date.now(),
        };

        expect(streaming.phase).toBe(phase);
      });
    });
  });

  describe("PerformanceTimelineEntry structure", () => {
    it("should have all required fields", () => {
      const timeline: PerformanceTimelineEntry = {
        type: "fetch",
        timestamp: Date.now(),
        durationMs: 100,
        refId: "fetch_1",
      };

      expect(timeline).toHaveProperty("type");
      expect(timeline).toHaveProperty("timestamp");
      expect(timeline).toHaveProperty("durationMs");
      expect(timeline).toHaveProperty("refId");
    });

    it("should support all valid type values", () => {
      const types: Array<PerformanceTimelineEntry["type"]> = [
        "rsc",
        "suspense",
        "streaming",
        "fetch",
        "action",
      ];

      types.forEach((type) => {
        const timeline: PerformanceTimelineEntry = {
          type,
          timestamp: Date.now(),
        };

        expect(timeline.type).toBe(type);
      });
    });
  });

  describe("RuntimeSnapshot structure", () => {
    it("should have all required fields", () => {
      const snapshot: RuntimeSnapshot = {
        sessions: [],
        activeSessionId: null,
        lastUpdated: Date.now(),
      };

      expect(snapshot).toHaveProperty("sessions");
      expect(snapshot).toHaveProperty("activeSessionId");
      expect(snapshot).toHaveProperty("lastUpdated");
      expect(Array.isArray(snapshot.sessions)).toBe(true);
    });

    it("should support complete session data", () => {
      const snapshot: RuntimeSnapshot = {
        sessions: [
          {
            id: "session_1",
            route: "/test",
            startedAt: Date.now() - 5000,
            finishedAt: null,
            fetches: [
              {
                id: "fetch_1",
                url: "https://api.example.com/data",
                method: "GET",
                route: "/test",
                origin: "server-component",
                statusCode: 200,
                durationMs: 120,
                cacheMode: "force-cache",
                cacheResult: "miss",
                startedAt: Date.now() - 4000,
                finishedAt: Date.now() - 3880,
              },
            ],
            actions: [],
            rsc: [
              {
                id: "rsc_1",
                file: "/app/page.tsx",
                componentName: "HomePage",
                route: "/test",
                durationMs: 245,
                startedAt: Date.now() - 4500,
                finishedAt: Date.now() - 4255,
                isAsync: true,
              },
            ],
            suspense: [
              {
                id: "suspense_1",
                boundaryName: "DataBoundary",
                route: "/test",
                startedAt: Date.now() - 3900,
                resolvedAt: Date.now() - 3200,
                fallbackRenderMs: 15,
                contentResolveMs: 700,
              },
            ],
            streaming: [
              {
                id: "stream_1",
                route: "/test",
                phase: "shell",
                timestamp: Date.now() - 4800,
              },
            ],
            timeline: [],
          },
        ],
        activeSessionId: "session_1",
        lastUpdated: Date.now(),
      };

      expect(snapshot.sessions).toHaveLength(1);
      expect(snapshot.sessions[0]).toHaveProperty("suspense");
      expect(snapshot.sessions[0]).toHaveProperty("streaming");
      expect(snapshot.sessions[0].suspense).toHaveLength(1);
      expect(snapshot.sessions[0].streaming).toHaveLength(1);
    });
  });
});
