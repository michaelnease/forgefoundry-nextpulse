/**
 * Change Detection for NextPulse Runtime Data
 * Detects changes in runtime data and triggers SSE broadcasts
 */

import { sseManager } from "./sseManager.js";
import { fetchAppRuntimeSnapshot, fetchAppErrors } from "./appRuntimeClient.js";
import type { RuntimeSnapshot } from "../types/runtime.js";
import type { ErrorLogSnapshot } from "../types/errors.js";

/**
 * Configuration for change detection
 */
export interface ChangeDetectorConfig {
  /** Next.js app base URL */
  nextDevBaseUrl: string;
  /** Poll interval in milliseconds (only used as fallback) */
  pollInterval?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Change Detector - Monitors for changes and broadcasts via SSE
 */
export class ChangeDetector {
  private config: Required<ChangeDetectorConfig>;
  private lastRuntimeHash: string | null = null;
  private lastErrorsHash: string | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(config: ChangeDetectorConfig) {
    this.config = {
      pollInterval: 1000, // 1 second default
      debug: false,
      ...config,
    };
  }

  /**
   * Start monitoring for changes
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.log("Change detector started");

    // Start polling for changes
    this.pollInterval = setInterval(() => {
      this.checkForChanges();
    }, this.config.pollInterval);

    // Initial check
    this.checkForChanges();
  }

  /**
   * Stop monitoring for changes
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.log("Change detector stopped");
  }

  /**
   * Check for changes in runtime data
   */
  private async checkForChanges(): Promise<void> {
    // Only check if we have connected clients
    if (sseManager.getClientCount() === 0) {
      return;
    }

    // Check runtime changes
    if (sseManager.getClientCountByEventType("runtime") > 0) {
      await this.checkRuntimeChanges();
    }

    // Check performance changes (uses same runtime data)
    if (sseManager.getClientCountByEventType("performance") > 0) {
      await this.checkPerformanceChanges();
    }

    // Check error changes
    if (sseManager.getClientCountByEventType("errors") > 0) {
      await this.checkErrorChanges();
    }
  }

  /**
   * Check for runtime data changes
   */
  private async checkRuntimeChanges(): Promise<void> {
    try {
      const runtime = await fetchAppRuntimeSnapshot(this.config.nextDevBaseUrl);
      if (!runtime) {
        return;
      }

      const currentHash = this.hashRuntimeData(runtime);

      if (currentHash !== this.lastRuntimeHash) {
        this.lastRuntimeHash = currentHash;
        this.log(`Runtime data changed, broadcasting to clients`);

        // Broadcast the update
        sseManager.broadcast("runtime", "update", runtime);
      }
    } catch (error) {
      this.log(`Error checking runtime changes: ${error}`);
    }
  }

  /**
   * Check for performance data changes
   */
  private async checkPerformanceChanges(): Promise<void> {
    try {
      const runtime = await fetchAppRuntimeSnapshot(this.config.nextDevBaseUrl);
      if (!runtime) {
        return;
      }

      const currentHash = this.hashRuntimeData(runtime);

      // Performance data is derived from runtime data
      if (currentHash !== this.lastRuntimeHash) {
        this.log(`Performance data changed, broadcasting to clients`);

        // Import buildPerformanceSnapshot dynamically to avoid circular deps
        const { buildPerformanceSnapshot } = await import("../diagnostics/index.js");
        const performance = buildPerformanceSnapshot(runtime);

        // Broadcast the update
        sseManager.broadcast("performance", "update", performance);
      }
    } catch (error) {
      this.log(`Error checking performance changes: ${error}`);
    }
  }

  /**
   * Check for error log changes
   */
  private async checkErrorChanges(): Promise<void> {
    try {
      const errors = await fetchAppErrors(this.config.nextDevBaseUrl);
      if (!errors) {
        return;
      }

      const currentHash = this.hashErrorData(errors);

      if (currentHash !== this.lastErrorsHash) {
        this.lastErrorsHash = currentHash;
        this.log(`Error data changed, broadcasting to clients`);

        // Broadcast the update
        sseManager.broadcast("errors", "update", errors);
      }
    } catch (error) {
      this.log(`Error checking error changes: ${error}`);
    }
  }

  /**
   * Hash runtime data for change detection
   */
  private hashRuntimeData(runtime: RuntimeSnapshot): string {
    // Simple hash based on lastUpdated and session count/IDs
    const sessionIds = runtime.sessions.map((s) => s.id).join(",");
    const fetchCounts = runtime.sessions.map((s) => s.fetches.length).join(",");
    const actionCounts = runtime.sessions.map((s) => s.actions.length).join(",");

    return `${runtime.lastUpdated}-${sessionIds}-${fetchCounts}-${actionCounts}`;
  }

  /**
   * Hash error data for change detection
   */
  private hashErrorData(errors: ErrorLogSnapshot): string {
    // Simple hash based on lastUpdated and error/log counts
    return `${errors.lastUpdated}-${errors.errors.length}-${errors.logs.length}`;
  }

  /**
   * Log a message if debug is enabled
   */
  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[ChangeDetector] ${message}`);
    }
  }
}
