/**
 * NextPulse instrumentation initialization
 * Sets up fetch, server action, RSC, Suspense, and streaming tracking in development mode
 */

import { instrumentFetch } from "./instrumentFetch.js";
import { instrumentServerActions } from "./instrumentServerActions.js";
import { instrumentRSC } from "./instrumentRSC.js";
import { instrumentSuspense } from "./instrumentSuspense.js";
import { instrumentStreaming } from "./instrumentStreaming.js";

let isInitialized = false;

/**
 * Initialize all instrumentation
 * Should be called once at module load time (development only)
 */
export function initializeInstrumentation(): void {
  // Only initialize in development
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  // Prevent double initialization
  if (isInitialized) {
    return;
  }

  try {
    // Instrument fetch
    instrumentFetch();

    // Instrument server actions
    instrumentServerActions();

    // Instrument RSC rendering
    instrumentRSC();

    // Instrument Suspense boundaries
    instrumentSuspense();

    // Instrument streaming phases
    instrumentStreaming();

    isInitialized = true;
  } catch (error) {
    // Silently fail if instrumentation can't be set up
    // This ensures production builds never break
    if (process.env.NODE_ENV === "development") {
      console.warn("[nextpulse] Failed to initialize instrumentation:", error);
    }
  }
}

/**
 * Check if instrumentation is initialized
 */
export function isInstrumentationInitialized(): boolean {
  return isInitialized;
}

// Auto-initialize in development when module is loaded
if (typeof window !== "undefined" || typeof globalThis !== "undefined") {
  // Only auto-initialize on client-side or in Node.js
  // Server-side initialization should be explicit
  if (process.env.NODE_ENV === "development") {
    // For client-side, initialize immediately
    // For server-side, we'll initialize via NextPulse component or middleware
    if (typeof window !== "undefined") {
      initializeInstrumentation();
    }
  }
}

