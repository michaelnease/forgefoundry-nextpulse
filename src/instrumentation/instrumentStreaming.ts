/**
 * Streaming instrumentation for NextPulse
 * Tracks Next.js streaming phases (shell, data, content, complete)
 */

import { recordStreamingEvent, getCurrentRoute } from "./sessions.js";
import type { StreamingEvent } from "../types/runtime.js";

let isInstrumented = false;
let streamingPhases: Map<string, { route: string | null; phases: StreamingEvent["phase"][] }> =
  new Map();

/**
 * Instrument streaming phases
 *
 * Strategy: Hook into Next.js streaming pipeline via global hooks
 * or monitor Response stream events
 */
export function instrumentStreaming(): void {
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
    (globalThis as any).__next_pulse_streaming_patch = {
      onStreamingPhase: (phase: StreamingEvent["phase"], route?: string) => {
        const currentRoute = route || getCurrentRoute();
        recordStreamingEvent({
          route: currentRoute,
          phase,
          timestamp: Date.now(),
        });
      },
    };
  }

  // Try to patch Response streaming if available
  if (typeof Response !== "undefined" && Response.prototype) {
    const originalBodyGetter = Object.getOwnPropertyDescriptor(Response.prototype, "body");

    // Monitor streaming responses
    try {
      Object.defineProperty(Response.prototype, "body", {
        get() {
          const body = originalBodyGetter?.get?.call(this);

          if (body && body instanceof ReadableStream) {
            // This is a streaming response
            const route = getCurrentRoute();
            recordStreamingEvent({
              route,
              phase: "shell",
              timestamp: Date.now(),
            });

            // Monitor stream events
            const reader = body.getReader();
            let hasData = false;
            let hasContent = false;

            const monitorStream = async (): Promise<void> => {
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) {
                    if (hasContent) {
                      recordStreamingEvent({
                        route,
                        phase: "complete",
                        timestamp: Date.now(),
                      });
                    }
                    break;
                  }

                  if (!hasData) {
                    hasData = true;
                    recordStreamingEvent({
                      route,
                      phase: "data",
                      timestamp: Date.now(),
                    });
                  } else if (!hasContent) {
                    hasContent = true;
                    recordStreamingEvent({
                      route,
                      phase: "content",
                      timestamp: Date.now(),
                    });
                  }
                }
              } catch {
                // Ignore stream errors
              }
            };

            // Start monitoring (don't await, let it run in background)
            monitorStream().catch(() => {
              // Ignore errors
            });

            // Return a new stream that wraps the original
            return new ReadableStream({
              start(controller) {
                reader.read().then(function process({ done, value }): Promise<void> {
                  if (done) {
                    controller.close();
                    return Promise.resolve();
                  }
                  controller.enqueue(value);
                  return reader.read().then(process);
                });
              },
            });
          }

          return body;
        },
        configurable: true,
      });
    } catch {
      // If we can't patch, that's okay - use global hooks instead
    }
  }

  isInstrumented = true;
}

/**
 * Manually record a streaming phase
 * Can be called from Next.js middleware or route handlers
 */
export function recordStreamingPhase(phase: StreamingEvent["phase"], route?: string): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  const currentRoute = route || getCurrentRoute();
  recordStreamingEvent({
    route: currentRoute,
    phase,
    timestamp: Date.now(),
  });
}

/**
 * Restore original behavior (for testing)
 */
export function restoreStreaming(): void {
  if (typeof globalThis !== "undefined") {
    delete (globalThis as any).__next_pulse_streaming_patch;
  }
  streamingPhases.clear();
  isInstrumented = false;
}
