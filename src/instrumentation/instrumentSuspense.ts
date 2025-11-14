/**
 * Suspense boundary instrumentation for NextPulse
 * Tracks Suspense boundary behavior and fallback timing
 */

import React from "react";
import { recordSuspenseEvent, getCurrentRoute } from "./sessions.js";
import type { SuspenseEvent } from "../types/runtime.js";

let isInstrumented = false;
const suspenseBoundaries = new Map<string, { startedAt: number; fallbackMountedAt?: number }>();

/**
 * Extract boundary name from props or context
 */
function extractBoundaryName(props: any): string | null {
  if (props?.name) {
    return props.name;
  }

  if (props?.fallback) {
    // Try to infer from fallback component
    const fallbackName = props.fallback?.type?.name || props.fallback?.displayName;
    if (fallbackName) {
      return `Suspense(${fallbackName})`;
    }
  }

  return null;
}

/**
 * Generate a unique boundary ID
 */
function generateBoundaryId(): string {
  return `suspense_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Instrument Suspense boundaries
 * 
 * Strategy: Since React Suspense is internal, we provide a wrapper component
 * that can be used to wrap Suspense boundaries, or we hook into React internals
 * if available in development mode
 */
export function instrumentSuspense(): void {
  // Only instrument in development
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  // Prevent double instrumentation
  if (isInstrumented) {
    return;
  }

  // Set up global hook for React/Next.js to use
  if (typeof globalThis !== "undefined") {
    (globalThis as any).__next_pulse_suspense_patch = {
      onSuspenseStart: (boundaryId: string, props: any) => {
        const boundaryName = extractBoundaryName(props);
        const route = getCurrentRoute();
        const startedAt = Date.now();

        suspenseBoundaries.set(boundaryId, {
          startedAt,
        });

        // If fallback is shown immediately, record that
        if (props?.fallback) {
          suspenseBoundaries.set(boundaryId, {
            startedAt,
            fallbackMountedAt: startedAt,
          });
        }
      },
      onSuspenseResolve: (boundaryId: string) => {
        const boundary = suspenseBoundaries.get(boundaryId);
        if (!boundary) {
          return;
        }

        const route = getCurrentRoute();
        const resolvedAt = Date.now();
        const fallbackRenderMs = boundary.fallbackMountedAt
          ? resolvedAt - boundary.fallbackMountedAt
          : 0;
        const contentResolveMs = resolvedAt - boundary.startedAt;

        recordSuspenseEvent({
          boundaryName: null, // Will be set if available
          route,
          startedAt: boundary.startedAt,
          resolvedAt,
          fallbackRenderMs,
          contentResolveMs,
        });

        suspenseBoundaries.delete(boundaryId);
      },
    };
  }

  isInstrumented = true;
}

/**
 * Create an instrumented Suspense wrapper
 * This can be used to wrap Suspense boundaries manually
 */
export function createInstrumentedSuspense(
  SuspenseComponent: React.ComponentType<any>,
  props: any
): React.ReactElement {
  if (process.env.NODE_ENV !== "development") {
    return React.createElement(SuspenseComponent, props);
  }

  const boundaryId = generateBoundaryId();
  const boundaryName = extractBoundaryName(props);
  const route = getCurrentRoute();
  const startedAt = Date.now();

  // Track this boundary
  suspenseBoundaries.set(boundaryId, {
    startedAt,
    fallbackMountedAt: props?.fallback ? startedAt : undefined,
  });

  // Wrap children to detect when they resolve
  const originalChildren = props.children;
  const wrappedChildren = React.Children.map(originalChildren, (child) => {
    if (React.isValidElement(child)) {
      // Wrap with effect to detect resolution
      return React.createElement(SuspenseTracker, {
        boundaryId,
        boundaryName,
        route,
        startedAt,
        children: child,
      });
    }
    return child;
  });

  return React.createElement(SuspenseComponent, {
    ...props,
    children: wrappedChildren || originalChildren,
  });
}

/**
 * Internal component to track Suspense resolution
 */
function SuspenseTracker({
  boundaryId,
  boundaryName,
  route,
  startedAt,
  children,
}: {
  boundaryId: string;
  boundaryName: string | null;
  route: string | null;
  startedAt: number;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    // Component mounted/resolved
    const boundary = suspenseBoundaries.get(boundaryId);
    if (boundary) {
      const resolvedAt = Date.now();
      const fallbackRenderMs = boundary.fallbackMountedAt
        ? resolvedAt - boundary.fallbackMountedAt
        : 0;
      const contentResolveMs = resolvedAt - startedAt;

      recordSuspenseEvent({
        boundaryName,
        route,
        startedAt,
        resolvedAt,
        fallbackRenderMs,
        contentResolveMs,
      });

      suspenseBoundaries.delete(boundaryId);
    }
  }, []);

  return React.createElement(React.Fragment, null, children);
}

/**
 * Restore original behavior (for testing)
 */
export function restoreSuspense(): void {
  if (typeof globalThis !== "undefined") {
    delete (globalThis as any).__next_pulse_suspense_patch;
  }
  suspenseBoundaries.clear();
  isInstrumented = false;
}

