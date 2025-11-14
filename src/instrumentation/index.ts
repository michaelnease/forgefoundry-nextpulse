/**
 * Instrumentation utilities exported for use in generated API routes
 * These functions allow NextPulse API routes to access runtime data
 */

export { getRuntimeSnapshot } from "./sessions.js";
export { getErrorLogSnapshot, clearErrorsAndLogs } from "./errors.js";
export { scanBundles } from "../server/bundleScanner.js";

// Re-export instrumentation setup functions
export { instrumentFetch } from "./instrumentFetch.js";
export { instrumentRSC } from "./instrumentRSC.js";
export { instrumentServerActions } from "./instrumentServerActions.js";
export { instrumentSuspense } from "./instrumentSuspense.js";
export { instrumentStreaming } from "./instrumentStreaming.js";
export { initializeClientErrorHooks } from "./clientErrorHooks.js";

// Import for use in initializeInstrumentation
import { initializeClientErrorHooks } from "./clientErrorHooks.js";
import { instrumentFetch } from "./instrumentFetch.js";
import { instrumentSuspense } from "./instrumentSuspense.js";

/**
 * Initialize all NextPulse instrumentation
 * Call this once in development mode to set up all runtime tracking
 */
export function initializeInstrumentation(): void {
  // Only initialize in development
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  // Initialize client-side error tracking
  if (typeof window !== "undefined") {
    initializeClientErrorHooks();
    instrumentFetch();
    instrumentSuspense();
  }

  // Server-side instrumentation is typically set up via Next.js middleware or instrumentation hook
  // These are called automatically when the module is imported in the right context
}
