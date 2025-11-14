/**
 * Tests for client-side error hooks
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  initializeClientErrorHooks,
  restoreClientErrorHooks,
} from "../src/instrumentation/clientErrorHooks.js";
import {
  recordError,
  recordLog,
  getErrorLogSnapshot,
  clearErrorsAndLogs,
} from "../src/instrumentation/errors.js";
import { setCurrentRoute, beginSession } from "../src/instrumentation/sessions.js";

// Mock window object for testing
const mockWindow = {
  onerror: null as any,
  onunhandledrejection: null as any,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

const originalWindow = global.window;
const originalConsole = global.console;

describe("Client Error Hooks", () => {
  beforeEach(() => {
    // Setup mock window
    (global as any).window = { ...mockWindow };
    (global as any).console = {
      ...originalConsole,
      error: vi.fn(),
    };
    clearErrorsAndLogs();
    setCurrentRoute(null);
  });

  afterEach(() => {
    restoreClientErrorHooks();
    (global as any).window = originalWindow;
    (global as any).console = originalConsole;
    vi.clearAllMocks();
  });

  it("should not instrument in production mode", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    initializeClientErrorHooks();

    expect((global as any).window.onerror).toBeNull();
    expect((global as any).window.onunhandledrejection).toBeNull();

    process.env.NODE_ENV = originalEnv;
  });

  it("should not instrument if window is undefined", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    delete (global as any).window;

    initializeClientErrorHooks();

    // Should not throw
    expect(true).toBe(true);

    (global as any).window = { ...mockWindow };
    process.env.NODE_ENV = originalEnv;
  });

  it("should patch window.onerror in development", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    initializeClientErrorHooks();
    setCurrentRoute("/test-route");
    beginSession("/test-route");

    const errorHandler = (global as any).window.onerror;
    expect(errorHandler).toBeDefined();
    expect(typeof errorHandler).toBe("function");

    // Call the handler
    const result = errorHandler("Test error", "test.js", 1, 1, new Error("Test"));

    const snapshot = getErrorLogSnapshot();
    expect(snapshot.errors.length).toBe(1);
    expect(snapshot.errors[0].message).toBe("Test error");
    expect(snapshot.errors[0].route).toBe("/test-route");
    expect(snapshot.errors[0].source).toBe("client");

    process.env.NODE_ENV = originalEnv;
  });

  it("should patch window.onunhandledrejection in development", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    initializeClientErrorHooks();
    setCurrentRoute("/test-route");
    beginSession("/test-route");

    const rejectionHandler = (global as any).window.onunhandledrejection;
    expect(rejectionHandler).toBeDefined();
    expect(typeof rejectionHandler).toBe("function");

    // Create a mock rejection event
    const mockEvent = {
      reason: new Error("Unhandled rejection"),
    } as PromiseRejectionEvent;

    rejectionHandler(mockEvent);

    const snapshot = getErrorLogSnapshot();
    expect(snapshot.errors.length).toBe(1);
    expect(snapshot.errors[0].message).toContain("Unhandled promise rejection");
    expect(snapshot.errors[0].route).toBe("/test-route");
    expect(snapshot.errors[0].source).toBe("client");

    process.env.NODE_ENV = originalEnv;
  });

  it("should wrap console.error in development", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    initializeClientErrorHooks();
    setCurrentRoute("/test-route");
    beginSession("/test-route");

    const consoleError = (global as any).console.error;
    expect(consoleError).toBeDefined();

    // Call console.error with an Error
    consoleError(new Error("Console error"));

    const snapshot = getErrorLogSnapshot();
    // Should record a log (not an error, since console.error logs)
    expect(snapshot.logs.length).toBeGreaterThan(0);

    process.env.NODE_ENV = originalEnv;
  });

  it("should preserve original handlers", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const originalOnError = vi.fn();
    const originalOnRejection = vi.fn();
    const originalConsoleError = vi.fn();

    (global as any).window.onerror = originalOnError;
    (global as any).window.onunhandledrejection = originalOnRejection;
    (global as any).console.error = originalConsoleError;

    initializeClientErrorHooks();

    // Call handlers
    (global as any).window.onerror("test", "file.js", 1, 1);
    (global as any).window.onunhandledrejection({ reason: "test" } as any);
    (global as any).console.error("test");

    // Original handlers should be called
    expect(originalOnError).toHaveBeenCalled();
    expect(originalOnRejection).toHaveBeenCalled();
    expect(originalConsoleError).toHaveBeenCalled();

    process.env.NODE_ENV = originalEnv;
  });

  it("should restore original handlers", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const originalOnError = vi.fn();
    const originalOnRejection = vi.fn();
    const originalConsoleError = vi.fn();

    (global as any).window.onerror = originalOnError;
    (global as any).window.onunhandledrejection = originalOnRejection;
    (global as any).console.error = originalConsoleError;

    initializeClientErrorHooks();
    restoreClientErrorHooks();

    expect((global as any).window.onerror).toBe(originalOnError);
    expect((global as any).window.onunhandledrejection).toBe(originalOnRejection);
    expect((global as any).console.error).toBe(originalConsoleError);

    process.env.NODE_ENV = originalEnv;
  });

  it("should not double-instrument", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    initializeClientErrorHooks();
    const firstHandler = (global as any).window.onerror;

    initializeClientErrorHooks();
    const secondHandler = (global as any).window.onerror;

    // Should be the same handler (not re-instrumented)
    expect(firstHandler).toBe(secondHandler);

    process.env.NODE_ENV = originalEnv;
  });
});
