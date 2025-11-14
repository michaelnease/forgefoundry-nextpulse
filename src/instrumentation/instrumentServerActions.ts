/**
 * Server Action instrumentation for NextPulse
 * Wraps Next.js server actions to record execution
 */

import { recordServerActionEvent, getCurrentRoute } from "./sessions.js";
import type { ServerActionEvent } from "../types/runtime.js";

let isInstrumented = false;

/**
 * Extract action name from function
 */
function extractActionName(fn: Function): string {
  if (fn.name) {
    return fn.name;
  }
  
  // Try to get name from toString
  const match = fn.toString().match(/function\s+(\w+)/);
  if (match) {
    return match[1];
  }
  
  return "anonymous";
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
      const match = line.match(/\(([^)]+\.(ts|tsx|js|jsx)):\d+:\d+\)/);
      if (match) {
        return match[1];
      }
    }
  } catch {
    // Ignore errors
  }
  
  return null;
}

/**
 * Wrap a server action function
 */
function wrapServerAction<T extends (...args: any[]) => Promise<any>>(
  action: T,
  name?: string
): T {
  const actionName = name || extractActionName(action);
  const file = extractFileFromStack();
  const route = getCurrentRoute();

  return (async (...args: any[]) => {
    const startedAt = Date.now();
    let status: "success" | "error" = "success";
    let errorMessage: string | undefined;
    let errorStack: string | undefined;
    let finishedAt = startedAt;

    try {
      const result = await action(...args);
      finishedAt = Date.now();

      recordServerActionEvent({
        name: actionName,
        file,
        route,
        executionTimeMs: finishedAt - startedAt,
        status,
        startedAt,
        finishedAt,
      });

      return result;
    } catch (error: any) {
      finishedAt = Date.now();
      status = "error";
      errorMessage = error?.message || String(error);
      errorStack = error?.stack;

      recordServerActionEvent({
        name: actionName,
        file,
        route,
        executionTimeMs: finishedAt - startedAt,
        status,
        errorMessage,
        errorStack,
        startedAt,
        finishedAt,
      });

      throw error;
    }
  }) as T;
}

/**
 * Instrument server actions
 * 
 * Note: This is a simplified approach. In practice, Next.js server actions
 * are registered through a specific mechanism. This function provides
 * a way to wrap actions manually or through a helper.
 */
export function instrumentServerActions(): void {
  // Only instrument in development
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  // Prevent double instrumentation
  if (isInstrumented) {
    return;
  }

  // For now, we provide a helper function that users can use
  // or we can try to hook into Next.js internals
  // This is a placeholder that can be extended based on Next.js version

  isInstrumented = true;
}

/**
 * Create an instrumented server action
 * This is a helper function that developers can use to wrap their actions
 */
export function createInstrumentedAction<T extends (...args: any[]) => Promise<any>>(
  action: T,
  name?: string
): T {
  if (process.env.NODE_ENV !== "development") {
    return action;
  }

  return wrapServerAction(action, name);
}

/**
 * Restore original behavior (for testing)
 */
export function restoreServerActions(): void {
  isInstrumented = false;
}

