/**
 * Fetch instrumentation for NextPulse
 * Patches global fetch to record all fetch calls
 */

import { recordFetchEvent, getCurrentRoute } from "./sessions.js";
import type { FetchEvent } from "../types/runtime.js";

let isInstrumented = false;
let originalFetch: typeof fetch;

/**
 * Detect the origin of the fetch call
 */
function detectOrigin(): FetchEvent["origin"] {
  // Check if we're in a browser environment
  if (typeof window !== "undefined") {
    return "client-component";
  }

  // Server-side detection
  // Try to infer from stack trace or context
  try {
    const stack = new Error().stack || "";
    
    // Check for server action context
    if (stack.includes("server-action") || stack.includes("action")) {
      return "server-action";
    }
    
    // Check for route handler context
    if (stack.includes("route") || stack.includes("handler")) {
      return "route-handler";
    }
    
    // Default to server-component for server-side
    return "server-component";
  } catch {
    return "unknown";
  }
}

/**
 * Determine cache result from response
 */
function determineCacheResult(response: Response | null): FetchEvent["cacheResult"] {
  if (!response) {
    return "unknown";
  }

  // Check response headers for cache indicators
  const cacheControl = response.headers.get("cache-control");
  const age = response.headers.get("age");
  const xCache = response.headers.get("x-cache");

  if (xCache === "HIT" || xCache === "hit") {
    return "hit";
  }
  if (xCache === "MISS" || xCache === "miss") {
    return "miss";
  }
  if (age && parseInt(age) > 0) {
    return "hit";
  }
  if (cacheControl?.includes("no-cache") || cacheControl?.includes("no-store")) {
    return "bypass";
  }

  return "unknown";
}

/**
 * Extract cache mode from RequestInit
 */
function extractCacheMode(init?: RequestInit): string | null {
  if (!init) {
    return null;
  }

  if (init.cache) {
    return String(init.cache);
  }

  // Next.js extends RequestInit with a 'next' property
  const nextInit = init as RequestInit & { next?: { revalidate?: number; tags?: string[] } };
  if (nextInit.next) {
    const nextOptions = nextInit.next;
    if (nextOptions.revalidate !== undefined) {
      return `revalidate:${nextOptions.revalidate}`;
    }
  }

  return null;
}

/**
 * Instrument fetch function
 */
export function instrumentFetch(): void {
  // Only instrument in development
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  // Prevent double instrumentation
  if (isInstrumented) {
    return;
  }

  // Store original fetch
  if (typeof globalThis !== "undefined" && globalThis.fetch) {
    originalFetch = globalThis.fetch;
  } else if (typeof window !== "undefined" && window.fetch) {
    originalFetch = window.fetch;
  } else {
    // No fetch available, skip instrumentation
    return;
  }

  // Create instrumented fetch
  const instrumentedFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const startedAt = Date.now();
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method || (typeof input === "object" && "method" in input ? input.method : "GET")).toUpperCase();
    const route = getCurrentRoute();
    const origin = detectOrigin();
    const cacheMode = extractCacheMode(init);

    let statusCode: number | null = null;
    let cacheResult: FetchEvent["cacheResult"] = "unknown";
    let finishedAt = startedAt;

    try {
      // Call original fetch
      const response = await originalFetch(input, init);
      
      finishedAt = Date.now();
      statusCode = response.status;
      cacheResult = determineCacheResult(response);

      // Record the fetch event
      recordFetchEvent({
        url,
        method,
        route,
        origin,
        statusCode,
        durationMs: finishedAt - startedAt,
        cacheMode,
        cacheResult,
        startedAt,
        finishedAt,
      });

      return response;
    } catch (error) {
      finishedAt = Date.now();
      statusCode = null;

      // Record the fetch event even on error
      recordFetchEvent({
        url,
        method,
        route,
        origin,
        statusCode,
        durationMs: finishedAt - startedAt,
        cacheMode,
        cacheResult: "unknown",
        startedAt,
        finishedAt,
      });

      throw error;
    }
  };

  // Replace global fetch
  if (typeof globalThis !== "undefined") {
    (globalThis as any).fetch = instrumentedFetch;
  }
  if (typeof window !== "undefined") {
    (window as any).fetch = instrumentedFetch;
  }

  isInstrumented = true;
}

/**
 * Restore original fetch (for testing)
 */
export function restoreFetch(): void {
  if (!isInstrumented || !originalFetch) {
    return;
  }

  if (typeof globalThis !== "undefined") {
    (globalThis as any).fetch = originalFetch;
  }
  if (typeof window !== "undefined") {
    (window as any).fetch = originalFetch;
  }

  isInstrumented = false;
}

