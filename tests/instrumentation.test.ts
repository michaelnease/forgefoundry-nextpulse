import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  beginSession,
  endSession,
  recordFetchEvent,
  recordServerActionEvent,
  getRuntimeSnapshot,
  setCurrentRoute,
} from "../src/instrumentation/sessions.js";
import { instrumentFetch, restoreFetch } from "../src/instrumentation/instrumentFetch.js";
import type { FetchEvent, ServerActionEvent } from "../src/types/runtime.js";

describe("instrumentation", () => {
  beforeEach(() => {
    // Reset state before each test
    const snapshot = getRuntimeSnapshot();
    snapshot.sessions.forEach((s) => {
      if (s.finishedAt === null) {
        endSession();
      }
    });
  });

  afterEach(() => {
    // Clean up after each test
    restoreFetch();
  });

  describe("session tracking", () => {
    it("should begin and end sessions", () => {
      const sessionId = beginSession("/test");
      expect(sessionId).toBeDefined();

      const snapshot = getRuntimeSnapshot();
      expect(snapshot.activeSessionId).toBe(sessionId);
      expect(snapshot.sessions.length).toBeGreaterThan(0);

      endSession();
      const snapshotAfter = getRuntimeSnapshot();
      expect(snapshotAfter.activeSessionId).toBeNull();
      const session = snapshotAfter.sessions.find((s) => s.id === sessionId);
      expect(session?.finishedAt).toBeDefined();
    });

    it("should record fetch events", () => {
      beginSession("/test");

      recordFetchEvent({
        url: "https://example.com/api",
        method: "GET",
        route: "/test",
        origin: "client-component",
        statusCode: 200,
        durationMs: 100,
        cacheMode: null,
        cacheResult: "miss",
        startedAt: Date.now() - 100,
        finishedAt: Date.now(),
      });

      const snapshot = getRuntimeSnapshot();
      const activeSession = snapshot.sessions.find((s) => s.id === snapshot.activeSessionId);
      expect(activeSession?.fetches.length).toBe(1);
      expect(activeSession?.fetches[0].url).toBe("https://example.com/api");
    });

    it("should record server action events", () => {
      beginSession("/test");

      recordServerActionEvent({
        name: "testAction",
        file: "app/actions.ts",
        route: "/test",
        executionTimeMs: 50,
        status: "success",
        startedAt: Date.now() - 50,
        finishedAt: Date.now(),
      });

      const snapshot = getRuntimeSnapshot();
      const activeSession = snapshot.sessions.find((s) => s.id === snapshot.activeSessionId);
      expect(activeSession?.actions.length).toBe(1);
      expect(activeSession?.actions[0].name).toBe("testAction");
    });

    it("should handle multiple sessions", () => {
      const session1 = beginSession("/page1");
      recordFetchEvent({
        url: "https://example.com/api1",
        method: "GET",
        route: "/page1",
        origin: "client-component",
        statusCode: 200,
        durationMs: 100,
        cacheMode: null,
        cacheResult: "miss",
        startedAt: Date.now() - 100,
        finishedAt: Date.now(),
      });

      endSession();
      const session2 = beginSession("/page2");
      recordFetchEvent({
        url: "https://example.com/api2",
        method: "GET",
        route: "/page2",
        origin: "client-component",
        statusCode: 200,
        durationMs: 200,
        cacheMode: null,
        cacheResult: "miss",
        startedAt: Date.now() - 200,
        finishedAt: Date.now(),
      });

      const snapshot = getRuntimeSnapshot();
      expect(snapshot.sessions.length).toBeGreaterThanOrEqual(2);
      expect(snapshot.activeSessionId).toBe(session2);
    });
  });

  describe("fetch instrumentation", () => {
    it("should instrument fetch in development", () => {
      // Set NODE_ENV to development for this test
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      try {
        beginSession("/test");
        instrumentFetch();

        // Verify fetch is instrumented
        expect(typeof globalThis.fetch).toBe("function");
      } finally {
        process.env.NODE_ENV = originalEnv;
        restoreFetch();
      }
    });

    it("should not instrument fetch in production", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      try {
        const originalFetch = globalThis.fetch;
        instrumentFetch();
        // Fetch should not be modified in production
        expect(globalThis.fetch).toBe(originalFetch);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe("runtime snapshot", () => {
    it("should return a valid snapshot structure", () => {
      const snapshot = getRuntimeSnapshot();
      expect(snapshot).toHaveProperty("sessions");
      expect(snapshot).toHaveProperty("activeSessionId");
      expect(snapshot).toHaveProperty("lastUpdated");
      expect(Array.isArray(snapshot.sessions)).toBe(true);
    });

    it("should limit session history", () => {
      // Create many sessions
      for (let i = 0; i < 60; i++) {
        beginSession(`/page${i}`);
        endSession();
      }

      const snapshot = getRuntimeSnapshot();
      // Should be limited to MAX_SESSIONS (50)
      expect(snapshot.sessions.length).toBeLessThanOrEqual(50);
    });
  });
});
