/**
 * Tests for Phase 6: Error and Log Center
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  recordError,
  recordLog,
  getErrorLogSnapshot,
  clearErrorsAndLogs,
} from "../src/instrumentation/errors.js";
import { beginSession, setCurrentRoute } from "../src/instrumentation/sessions.js";
import type { ErrorEvent, LogEvent } from "../src/types/errors.js";

describe("Error and Log Tracking", () => {
  beforeEach(() => {
    // Clear errors and logs before each test
    clearErrorsAndLogs();
    // Reset session state
    setCurrentRoute(null);
  });

  describe("recordError", () => {
    it("should record an error event", () => {
      const error = recordError({
        route: "/test",
        source: "client",
        message: "Test error",
        severity: "error",
      });

      expect(error.id).toBeDefined();
      expect(error.timestamp).toBeGreaterThan(0);
      expect(error.route).toBe("/test");
      expect(error.source).toBe("client");
      expect(error.message).toBe("Test error");
      expect(error.severity).toBe("error");
    });

    it("should attach current session ID if available", () => {
      beginSession("/session-test");
      const error = recordError({
        route: "/session-test",
        source: "fetch",
        message: "Fetch failed",
        severity: "error",
      });

      expect(error.sessionId).toBeDefined();
    });

    it("should use current route if not provided", () => {
      setCurrentRoute("/current-route");
      const error = recordError({
        source: "client",
        message: "Error without route",
        severity: "error",
      });

      expect(error.route).toBe("/current-route");
    });

    it("should limit errors to MAX_ERRORS", () => {
      // Record more than MAX_ERRORS (100)
      for (let i = 0; i < 150; i++) {
        recordError({
          source: "client",
          message: `Error ${i}`,
          severity: "error",
        });
      }

      const snapshot = getErrorLogSnapshot();
      expect(snapshot.errors.length).toBeLessThanOrEqual(100);
    });
  });

  describe("recordLog", () => {
    it("should record a log event", () => {
      const log = recordLog({
        route: "/test",
        level: "info",
        message: "Test log",
      });

      expect(log.id).toBeDefined();
      expect(log.timestamp).toBeGreaterThan(0);
      expect(log.route).toBe("/test");
      expect(log.level).toBe("info");
      expect(log.message).toBe("Test log");
    });

    it("should attach current session ID if available", () => {
      beginSession("/session-test");
      const log = recordLog({
        route: "/session-test",
        level: "warn",
        message: "Warning message",
      });

      expect(log.sessionId).toBeDefined();
    });

    it("should limit logs to MAX_LOGS", () => {
      // Record more than MAX_LOGS (200)
      for (let i = 0; i < 250; i++) {
        recordLog({
          level: "info",
          message: `Log ${i}`,
        });
      }

      const snapshot = getErrorLogSnapshot();
      expect(snapshot.logs.length).toBeLessThanOrEqual(200);
    });
  });

  describe("getErrorLogSnapshot", () => {
    it("should return current snapshot with errors and logs", () => {
      recordError({
        source: "client",
        message: "Test error",
        severity: "error",
      });

      recordLog({
        level: "info",
        message: "Test log",
      });

      const snapshot = getErrorLogSnapshot();
      expect(snapshot.errors.length).toBe(1);
      expect(snapshot.logs.length).toBe(1);
      expect(snapshot.lastUpdated).toBeGreaterThan(0);
    });

    it("should return empty arrays when no errors or logs", () => {
      const snapshot = getErrorLogSnapshot();
      expect(snapshot.errors).toEqual([]);
      expect(snapshot.logs).toEqual([]);
    });
  });

  describe("clearErrorsAndLogs", () => {
    it("should clear all errors and logs", () => {
      recordError({
        source: "client",
        message: "Test error",
        severity: "error",
      });

      recordLog({
        level: "info",
        message: "Test log",
      });

      clearErrorsAndLogs();

      const snapshot = getErrorLogSnapshot();
      expect(snapshot.errors.length).toBe(0);
      expect(snapshot.logs.length).toBe(0);
    });
  });

  describe("Error severity and source", () => {
    it("should support different error severities", () => {
      const error = recordError({
        source: "fetch",
        message: "Warning",
        severity: "warning",
      });

      expect(error.severity).toBe("warning");
    });

    it("should support different error sources", () => {
      const sources: Array<"server-action" | "route-handler" | "rsc-render" | "client" | "fetch"> = [
        "server-action",
        "route-handler",
        "rsc-render",
        "client",
        "fetch",
      ];

      sources.forEach((source) => {
        const error = recordError({
          source,
          message: `Error from ${source}`,
          severity: "error",
        });
        expect(error.source).toBe(source);
      });
    });
  });

  describe("Log levels", () => {
    it("should support different log levels", () => {
      const levels: Array<"debug" | "info" | "warn" | "error"> = ["debug", "info", "warn", "error"];

      levels.forEach((level) => {
        const log = recordLog({
          level,
          message: `${level} message`,
        });
        expect(log.level).toBe(level);
      });
    });
  });
});

