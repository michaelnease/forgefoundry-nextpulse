/**
 * Error and log tracking for NextPulse
 * Collects errors and log events from the dev runtime
 */

import type { ErrorEvent, LogEvent, ErrorLogSnapshot, ErrorSource, LogLevel } from "../types/errors.js";
import { getCurrentRoute, getRuntimeSnapshot } from "./sessions.js";

// In-memory snapshot (singleton)
let snapshot: ErrorLogSnapshot = {
  errors: [],
  logs: [],
  lastUpdated: Date.now(),
};

// Maximum number of errors and logs to keep in memory
const MAX_ERRORS = 100;
const MAX_LOGS = 200;

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `error_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a unique log ID
 */
function generateLogId(): string {
  return `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Record an error event
 */
export function recordError(event: Omit<ErrorEvent, "id" | "timestamp">): ErrorEvent {
  const runtimeSnapshot = getRuntimeSnapshot();
  const activeSession = runtimeSnapshot.activeSessionId
    ? runtimeSnapshot.sessions.find((s) => s.id === runtimeSnapshot.activeSessionId)
    : null;
  const sessionId = activeSession?.id || null;
  const route = event.route || getCurrentRoute();

  const errorEvent: ErrorEvent = {
    ...event,
    id: generateId(),
    timestamp: Date.now(),
    sessionId,
    route,
  };

  snapshot.errors.unshift(errorEvent); // Add to beginning

  // Keep only the last MAX_ERRORS errors
  if (snapshot.errors.length > MAX_ERRORS) {
    snapshot.errors = snapshot.errors.slice(0, MAX_ERRORS);
  }

  snapshot.lastUpdated = Date.now();

  return errorEvent;
}

/**
 * Record a log event
 */
export function recordLog(event: Omit<LogEvent, "id" | "timestamp">): LogEvent {
  const runtimeSnapshot = getRuntimeSnapshot();
  const activeSession = runtimeSnapshot.activeSessionId
    ? runtimeSnapshot.sessions.find((s) => s.id === runtimeSnapshot.activeSessionId)
    : null;
  const sessionId = activeSession?.id || null;
  const route = event.route || getCurrentRoute();

  const logEvent: LogEvent = {
    ...event,
    id: generateLogId(),
    timestamp: Date.now(),
    sessionId,
    route,
  };

  snapshot.logs.unshift(logEvent); // Add to beginning

  // Keep only the last MAX_LOGS logs
  if (snapshot.logs.length > MAX_LOGS) {
    snapshot.logs = snapshot.logs.slice(0, MAX_LOGS);
  }

  snapshot.lastUpdated = Date.now();

  return logEvent;
}

/**
 * Get the current error and log snapshot
 */
export function getErrorLogSnapshot(): ErrorLogSnapshot {
  snapshot.lastUpdated = Date.now();
  return {
    ...snapshot,
    errors: [...snapshot.errors],
    logs: [...snapshot.logs],
  };
}

/**
 * Clear all errors and logs
 */
export function clearErrorsAndLogs(): void {
  snapshot.errors = [];
  snapshot.logs = [];
  snapshot.lastUpdated = Date.now();
}

