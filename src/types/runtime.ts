/**
 * Runtime instrumentation types for NextPulse
 * Tracks fetch calls, server actions, request sessions, and performance metrics
 */

export interface FetchEvent {
  id: string;
  url: string;
  method: string;
  route: string | null;
  origin: "server-component" | "server-action" | "route-handler" | "client-component" | "unknown";
  statusCode: number | null;
  durationMs: number;
  cacheMode: string | null;
  cacheResult: "hit" | "miss" | "bypass" | "unknown";
  startedAt: number;
  finishedAt: number;
}

export interface ServerActionEvent {
  id: string;
  name: string;
  file: string | null;
  route: string | null;
  executionTimeMs: number;
  status: "success" | "error";
  errorMessage?: string;
  errorStack?: string;
  startedAt: number;
  finishedAt: number;
}

export interface RscRenderEvent {
  id: string;
  file: string | null;
  componentName: string | null;
  route: string | null;
  durationMs: number;
  startedAt: number;
  finishedAt: number;
  isAsync: boolean;
}

export interface SuspenseEvent {
  id: string;
  boundaryName: string | null;
  route: string | null;
  startedAt: number;
  resolvedAt: number;
  fallbackRenderMs: number;
  contentResolveMs: number;
}

export interface StreamingEvent {
  id: string;
  route: string | null;
  phase: "shell" | "data" | "content" | "complete";
  timestamp: number;
}

export interface PerformanceTimelineEntry {
  type: "rsc" | "suspense" | "streaming" | "fetch" | "action";
  timestamp: number;
  durationMs?: number;
  refId?: string;
}

export interface SessionEvent {
  id: string;
  route: string;
  startedAt: number;
  finishedAt: number | null;
  fetches: FetchEvent[];
  actions: ServerActionEvent[];
  rsc: RscRenderEvent[];
  suspense: SuspenseEvent[];
  streaming: StreamingEvent[];
  timeline: PerformanceTimelineEntry[];
}

export interface RuntimeSnapshot {
  sessions: SessionEvent[];
  activeSessionId: string | null;
  lastUpdated: number;
}
