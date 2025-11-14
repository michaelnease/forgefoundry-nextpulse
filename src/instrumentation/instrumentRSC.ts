/**
 * RSC (React Server Component) instrumentation for NextPulse
 * Tracks server component render timing
 */

import { recordRscRenderEvent, getCurrentRoute } from "./sessions.js";
import { recordError } from "./errors.js";
import type { RscRenderEvent } from "../types/runtime.js";

let isInstrumented = false;

/**
 * Extract component name from function
 */
function extractComponentName(fn: Function): string | null {
  if (fn.name && fn.name !== "default") {
    return fn.name;
  }

  // Try to get name from toString
  const match = fn.toString().match(/function\s+(\w+)/);
  if (match) {
    return match[1];
  }

  // Try arrow function with const
  const arrowMatch = fn.toString().match(/const\s+(\w+)\s*=/);
  if (arrowMatch) {
    return arrowMatch[1];
  }

  return null;
}

/**
 * Extract file path from stack trace
 */
function extractFileFromStack(): string | null {
  try {
    const stack = new Error().stack || "";
    const lines = stack.split("\n");

    // Look for file paths in stack trace
    for (const line of lines) {
      // Match file paths like: /path/to/file.tsx:10:5 or C:\path\to\file.tsx:10:5
      const match = line.match(/\(?([^:()]+\.(ts|tsx|js|jsx)):\d+:\d+\)?/);
      if (match) {
        const filePath = match[1];
        // Filter out node_modules and .next
        if (!filePath.includes("node_modules") && !filePath.includes(".next")) {
          return filePath;
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return null;
}

/**
 * Wrap an async function (potential RSC component)
 */
function wrapAsyncComponent<T extends (...args: any[]) => Promise<any>>(
  component: T,
  name?: string
): T {
  const componentName = name || extractComponentName(component);
  const file = extractFileFromStack();
  const route = getCurrentRoute();

  return (async (...args: any[]) => {
    const startedAt = Date.now();
    let finishedAt = startedAt;
    let isAsync = false;

    try {
      const result = await component(...args);
      finishedAt = Date.now();
      isAsync = true;

      // Record RSC render event
      recordRscRenderEvent({
        file,
        componentName,
        route,
        durationMs: finishedAt - startedAt,
        startedAt,
        finishedAt,
        isAsync: true,
      });

      return result;
    } catch (error) {
      finishedAt = Date.now();
      isAsync = true;

      // Record even on error
      recordRscRenderEvent({
        file,
        componentName,
        route,
        durationMs: finishedAt - startedAt,
        startedAt,
        finishedAt,
        isAsync: true,
      });

      // Record error
      recordError({
        route,
        source: "rsc-render",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        severity: "error",
        meta: { file, componentName },
      });

      throw error;
    }
  }) as T;
}

/**
 * Wrap a sync function (potential RSC component)
 */
function wrapSyncComponent<T extends (...args: any[]) => any>(component: T, name?: string): T {
  const componentName = name || extractComponentName(component);
  const file = extractFileFromStack();
  const route = getCurrentRoute();

  return ((...args: any[]) => {
    const startedAt = Date.now();
    let finishedAt = startedAt;

    try {
      const result = component(...args);
      finishedAt = Date.now();

      // Check if result is a Promise (async component)
      if (result instanceof Promise) {
        // It's actually async, handle it
        result
          .then(() => {
            const asyncFinishedAt = Date.now();
            recordRscRenderEvent({
              file,
              componentName,
              route,
              durationMs: asyncFinishedAt - startedAt,
              startedAt,
              finishedAt: asyncFinishedAt,
              isAsync: true,
            });
          })
          .catch(() => {
            const asyncFinishedAt = Date.now();
            recordRscRenderEvent({
              file,
              componentName,
              route,
              durationMs: asyncFinishedAt - startedAt,
              startedAt,
              finishedAt: asyncFinishedAt,
              isAsync: true,
            });
          });
      } else {
        // Sync component
        recordRscRenderEvent({
          file,
          componentName,
          route,
          durationMs: finishedAt - startedAt,
          startedAt,
          finishedAt,
          isAsync: false,
        });
      }

      return result;
    } catch (error) {
      finishedAt = Date.now();

      recordRscRenderEvent({
        file,
        componentName,
        route,
        durationMs: finishedAt - startedAt,
        startedAt,
        finishedAt,
        isAsync: false,
      });

      // Record error
      recordError({
        route,
        source: "rsc-render",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        severity: "error",
        meta: { file, componentName },
      });

      throw error;
    }
  }) as T;
}

/**
 * Instrument RSC components
 * 
 * Strategy: Provide a global hook that Next.js can use, or wrap components manually
 * Since Next.js RSC rendering is internal, we provide utilities that can be used
 * to wrap components or hook into the render pipeline
 */
export function instrumentRSC(): void {
  // Only instrument in development
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  // Prevent double instrumentation
  if (isInstrumented) {
    return;
  }

  // Set up global hook for Next.js to use
  if (typeof globalThis !== "undefined") {
    (globalThis as any).__next_pulse_rsc_patch = {
      wrapAsync: wrapAsyncComponent,
      wrapSync: wrapSyncComponent,
    };
  }

  isInstrumented = true;
}

/**
 * Create an instrumented RSC component
 * Helper function for developers to wrap their components
 */
export function createInstrumentedRSC<T extends (...args: any[]) => any>(
  component: T,
  name?: string
): T {
  if (process.env.NODE_ENV !== "development") {
    return component;
  }

  // Check if component is async (returns Promise)
  const testResult = component.toString();
  const isAsync = testResult.includes("async") || testResult.includes("Promise");

  if (isAsync) {
    return wrapAsyncComponent(component, name);
  } else {
    return wrapSyncComponent(component, name);
  }
}

/**
 * Restore original behavior (for testing)
 */
export function restoreRSC(): void {
  if (typeof globalThis !== "undefined") {
    delete (globalThis as any).__next_pulse_rsc_patch;
  }
  isInstrumented = false;
}

