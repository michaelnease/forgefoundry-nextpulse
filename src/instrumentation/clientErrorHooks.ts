/**
 * Client-side error hooks for NextPulse
 * Patches window.onerror, window.onunhandledrejection, and console.error
 */

import { recordError, recordLog } from "./errors.js";
import { getCurrentRoute } from "./sessions.js";

let isInstrumented = false;
let originalOnError: typeof window.onerror | null = null;
let originalOnUnhandledRejection: typeof window.onunhandledrejection | null = null;
let originalConsoleError: typeof console.error | null = null;

/**
 * Stringify console arguments
 */
function stringifyArgs(args: any[]): string {
  try {
    return args
      .map((arg) => {
        if (typeof arg === "string") {
          return arg;
        }
        if (arg instanceof Error) {
          return arg.message;
        }
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      })
      .join(" ");
  } catch {
    return String(args);
  }
}

/**
 * Initialize client-side error hooks
 * Only works in browser environment and development mode
 */
export function initializeClientErrorHooks(): void {
  // Only instrument in development and browser
  if (process.env.NODE_ENV !== "development" || typeof window === "undefined") {
    return;
  }

  // Prevent double instrumentation
  if (isInstrumented) {
    return;
  }

  try {
    // Store original handlers
    originalOnError = window.onerror;
    originalOnUnhandledRejection = window.onunhandledrejection;
    originalConsoleError = console.error;

    // Patch window.onerror
    window.onerror = (
      message: string | Event,
      source?: string,
      lineno?: number,
      colno?: number,
      error?: Error
    ): boolean => {
      const route = getCurrentRoute();
      const errorMessage = typeof message === "string" ? message : message.type || "Unknown error";
      const stack = error?.stack || (source ? `${source}:${lineno}:${colno}` : undefined);

      recordError({
        route,
        source: "client",
        message: errorMessage,
        stack,
        severity: "error",
        meta: { source, lineno, colno },
      });

      // Call original handler if it exists
      if (originalOnError) {
        return originalOnError(message, source, lineno, colno, error);
      }

      return false;
    };

    // Patch window.onunhandledrejection
    window.onunhandledrejection = (event: PromiseRejectionEvent): void => {
      const route = getCurrentRoute();
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      const stack = reason instanceof Error ? reason.stack : undefined;

      recordError({
        route,
        source: "client",
        message: `Unhandled promise rejection: ${message}`,
        stack,
        severity: "error",
        meta: { type: "unhandledrejection" },
      });

      // Call original handler if it exists
      if (originalOnUnhandledRejection) {
        originalOnUnhandledRejection.call(window, event);
      }
    };

    // Wrap console.error to capture error-level logs
    // Only capture actual errors, not warnings/info
    console.error = (...args: any[]): void => {
      const route = getCurrentRoute();
      const message = stringifyArgs(args);

      // Check if it looks like an error (contains "Error" or stack trace)
      const isError = args.some(
        (arg) => arg instanceof Error || (typeof arg === "string" && arg.includes("Error"))
      );

      if (isError) {
        recordLog({
          route,
          level: "error",
          message,
          meta: { source: "console.error" },
        });
      }

      // Call original console.error
      if (originalConsoleError) {
        originalConsoleError.apply(console, args);
      }
    };

    isInstrumented = true;
  } catch (error) {
    // Silently fail if hooks can't be set up
    if (process.env.NODE_ENV === "development") {
      console.warn("[nextpulse] Failed to initialize client error hooks:", error);
    }
  }
}

/**
 * Restore original error handlers (for testing)
 */
export function restoreClientErrorHooks(): void {
  if (!isInstrumented || typeof window === "undefined") {
    return;
  }

  if (originalOnError !== null) {
    window.onerror = originalOnError;
  } else {
    window.onerror = null;
  }

  if (originalOnUnhandledRejection !== null) {
    window.onunhandledrejection = originalOnUnhandledRejection;
  } else {
    window.onunhandledrejection = null;
  }

  if (originalConsoleError !== null) {
    console.error = originalConsoleError;
  }

  isInstrumented = false;
}

