/**
 * Error and log tracking types for NextPulse
 * Tracks errors and log events from the dev runtime
 */

export type ErrorSource =
  | "server-action"
  | "route-handler"
  | "rsc-render"
  | "suspense"
  | "client"
  | "fetch"
  | "next-runtime"
  | "unknown";

export interface ErrorEvent {
  id: string;
  route: string | null;
  source: ErrorSource;
  message: string;
  stack?: string;
  timestamp: number;
  sessionId?: string | null;
  severity: "error" | "warning" | "info";
  meta?: Record<string, unknown>;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEvent {
  id: string;
  route: string | null;
  level: LogLevel;
  message: string;
  timestamp: number;
  sessionId?: string | null;
  meta?: Record<string, unknown>;
}

export interface ErrorLogSnapshot {
  errors: ErrorEvent[];
  logs: LogEvent[];
  lastUpdated: number;
}
