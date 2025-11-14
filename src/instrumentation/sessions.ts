/**
 * Session tracking for NextPulse runtime instrumentation
 * Tracks request/render sessions across server and client
 */

import type {
  RuntimeSnapshot,
  SessionEvent,
  FetchEvent,
  ServerActionEvent,
  RscRenderEvent,
  SuspenseEvent,
  StreamingEvent,
  PerformanceTimelineEntry,
} from "../types/runtime.js";

// In-memory snapshot (singleton)
let snapshot: RuntimeSnapshot = {
  sessions: [],
  activeSessionId: null,
  lastUpdated: Date.now(),
};

// Maximum number of sessions to keep in memory
const MAX_SESSIONS = 50;

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get the current runtime snapshot
 */
export function getRuntimeSnapshot(): RuntimeSnapshot {
  return {
    ...snapshot,
    sessions: [...snapshot.sessions],
  };
}

/**
 * Begin a new session
 */
export function beginSession(route: string): string {
  const sessionId = generateSessionId();
  const session: SessionEvent = {
    id: sessionId,
    route,
    startedAt: Date.now(),
    finishedAt: null,
    fetches: [],
    actions: [],
    rsc: [],
    suspense: [],
    streaming: [],
    timeline: [],
  };

  // End previous active session if any
  if (snapshot.activeSessionId) {
    endSession();
  }

  snapshot.sessions.unshift(session);
  snapshot.activeSessionId = sessionId;
  snapshot.lastUpdated = Date.now();

  // Limit session history
  if (snapshot.sessions.length > MAX_SESSIONS) {
    snapshot.sessions = snapshot.sessions.slice(0, MAX_SESSIONS);
  }

  return sessionId;
}

/**
 * End the current active session
 */
export function endSession(): void {
  if (!snapshot.activeSessionId) {
    return;
  }

  const activeSession = snapshot.sessions.find((s) => s.id === snapshot.activeSessionId);

  if (activeSession) {
    activeSession.finishedAt = Date.now();
  }

  snapshot.activeSessionId = null;
  snapshot.lastUpdated = Date.now();
}

/**
 * Get the current active session
 */
function getActiveSession(): SessionEvent | null {
  if (!snapshot.activeSessionId) {
    return null;
  }

  return snapshot.sessions.find((s) => s.id === snapshot.activeSessionId) || null;
}

/**
 * Record a fetch event to the active session
 */
export function recordFetchEvent(event: Omit<FetchEvent, "id">): void {
  const activeSession = getActiveSession();
  if (!activeSession) {
    return;
  }

  const fetchEvent: FetchEvent = {
    ...event,
    id: `fetch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
  };

  activeSession.fetches.push(fetchEvent);
  snapshot.lastUpdated = Date.now();
}

/**
 * Record a server action event to the active session
 */
export function recordServerActionEvent(event: Omit<ServerActionEvent, "id">): void {
  const activeSession = getActiveSession();
  if (!activeSession) {
    return;
  }

  const actionEvent: ServerActionEvent = {
    ...event,
    id: `action_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
  };

  activeSession.actions.push(actionEvent);
  snapshot.lastUpdated = Date.now();
}

/**
 * Record an RSC render event to the active session
 */
export function recordRscRenderEvent(event: Omit<RscRenderEvent, "id">): void {
  const activeSession = getActiveSession();
  if (!activeSession) {
    return;
  }

  const rscEvent: RscRenderEvent = {
    ...event,
    id: `rsc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
  };

  activeSession.rsc.push(rscEvent);
  snapshot.lastUpdated = Date.now();
}

/**
 * Record a Suspense event to the active session
 */
export function recordSuspenseEvent(event: Omit<SuspenseEvent, "id">): void {
  const activeSession = getActiveSession();
  if (!activeSession) {
    return;
  }

  const suspenseEvent: SuspenseEvent = {
    ...event,
    id: `suspense_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
  };

  activeSession.suspense.push(suspenseEvent);
  snapshot.lastUpdated = Date.now();
}

/**
 * Record a streaming event to the active session
 */
export function recordStreamingEvent(event: Omit<StreamingEvent, "id">): void {
  const activeSession = getActiveSession();
  if (!activeSession) {
    return;
  }

  const streamingEvent: StreamingEvent = {
    ...event,
    id: `streaming_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
  };

  activeSession.streaming.push(streamingEvent);
  snapshot.lastUpdated = Date.now();
}

/**
 * Add timeline entries to the active session
 */
export function addTimelineEntries(entries: PerformanceTimelineEntry[]): void {
  const activeSession = getActiveSession();
  if (!activeSession) {
    return;
  }

  activeSession.timeline.push(...entries);
  snapshot.lastUpdated = Date.now();
}

/**
 * Get current route (for client-side)
 * This will be set by the client runtime
 */
let currentRoute: string | null = null;

export function setCurrentRoute(route: string): void {
  currentRoute = route;
}

export function getCurrentRoute(): string | null {
  return currentRoute;
}
