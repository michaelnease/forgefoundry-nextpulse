/**
 * Diagnostic snapshot types for NextPulse
 * Combines all diagnostic data into a single AI-readable format
 */

import type { Metadata } from "../runtime/Panel.js";
import type { NextPulseConfig } from "../utils/config.js";
import type { RoutesSnapshot } from "./routes.js";
import type { BundlesSnapshot } from "./bundles.js";
import type { RuntimeSnapshot } from "./runtime.js";
import type { ErrorLogSnapshot } from "./errors.js";

/**
 * Performance snapshot (enriched runtime data)
 */
export interface PerformanceSnapshot {
  sessions: Array<{
    id: string;
    route: string;
    startedAt: number;
    finishedAt: number | null;
    metrics: {
      totalServerRenderTime: number;
      totalStreamingTime: number;
      slowestRscComponent: {
        componentName: string | null;
        durationMs: number;
      } | null;
      suspenseBoundaryCount: number;
      waterfallCount: number;
    };
    waterfalls: Array<{
      type: "fetch" | "rsc";
      events: unknown[];
      totalDuration: number;
    }>;
  }>;
  activeSessionId: string | null;
  lastUpdated: number;
}

/**
 * Environment information
 */
export interface EnvironmentInfo {
  node: string;
  platform: string;
  nextpulseVersion: string;
  nextJsVersion: string | null;
  git: {
    branch: string;
    sha: string;
    dirty: boolean;
  };
}

/**
 * Complete diagnostic snapshot
 * Combines all diagnostic data from all phases
 */
export interface DiagnosticSnapshot {
  timestamp: number;
  metadata: Metadata;
  config: NextPulseConfig;
  routes: RoutesSnapshot;
  bundles: BundlesSnapshot | null;
  runtime: RuntimeSnapshot;
  performance: PerformanceSnapshot;
  errors: ErrorLogSnapshot;
  environment: EnvironmentInfo;
}
