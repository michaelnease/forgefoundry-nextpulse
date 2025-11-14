# API Reference

Complete API reference for NextPulse's runtime APIs, HTTP endpoints, and instrumentation functions.

---

## Runtime APIs

### Session Management

#### `beginSession(route: string): string`

Create a new tracking session for a route.

**Parameters**:
- `route` (string) - The route path (e.g., `/dashboard`, `/blog/[slug]`)

**Returns**: Session ID (string)

**Example**:
```typescript
import { beginSession } from '@forgefoundry/nextpulse';

const sessionId = beginSession('/dashboard');
console.log(sessionId); // 'session_1234567890_abc123'
```

**Notes**:
- Automatically ends previous active session
- Sessions are capped at 50 in memory
- Development-only (no-op in production)

---

#### `endSession(): void`

End the current active session.

**Example**:
```typescript
import { endSession } from '@forgefoundry/nextpulse';

endSession();
```

**Notes**:
- Safe to call when no session is active
- Sets `finishedAt` timestamp on the session

---

#### `getRuntimeSnapshot(): RuntimeSnapshot`

Get the current runtime snapshot containing all sessions.

**Returns**: `RuntimeSnapshot` object

**Example**:
```typescript
import { getRuntimeSnapshot } from '@forgefoundry/nextpulse';

const snapshot = getRuntimeSnapshot();
console.log(snapshot.sessions.length); // Number of sessions
console.log(snapshot.activeSessionId); // Current active session ID
```

**Return Type**:
```typescript
interface RuntimeSnapshot {
  sessions: SessionEvent[];
  activeSessionId: string | null;
  lastUpdated: number;
}
```

---

### Event Recording

#### `recordFetchEvent(event: Omit<FetchEvent, 'id'>): void`

Record a fetch event to the active session.

**Parameters**:
```typescript
{
  url: string;
  method: string;
  route: string;
  origin: 'client-component' | 'server-component' | 'server-action' | 'route-handler' | 'unknown';
  statusCode: number | null;
  durationMs: number;
  cacheMode?: string | null;
  cacheResult?: 'hit' | 'miss' | 'bypass' | 'unknown';
  startedAt: number;
  finishedAt: number;
}
```

**Example**:
```typescript
import { recordFetchEvent } from '@forgefoundry/nextpulse';

recordFetchEvent({
  url: 'https://api.example.com/users',
  method: 'GET',
  route: '/dashboard',
  origin: 'client-component',
  statusCode: 200,
  durationMs: 156,
  cacheMode: 'no-cache',
  cacheResult: 'miss',
  startedAt: Date.now() - 156,
  finishedAt: Date.now(),
});
```

---

#### `recordServerActionEvent(event: Omit<ServerActionEvent, 'id'>): void`

Record a server action execution event.

**Parameters**:
```typescript
{
  name: string;
  file: string | null;
  route: string;
  executionTimeMs: number;
  status: 'success' | 'error';
  errorMessage?: string;
  errorStack?: string;
  startedAt: number;
  finishedAt: number;
}
```

**Example**:
```typescript
import { recordServerActionEvent } from '@forgefoundry/nextpulse';

recordServerActionEvent({
  name: 'createUser',
  file: 'app/actions/user.ts',
  route: '/signup',
  executionTimeMs: 234,
  status: 'success',
  startedAt: Date.now() - 234,
  finishedAt: Date.now(),
});
```

---

#### `recordRscRenderEvent(event: Omit<RscRenderEvent, 'id'>): void`

Record a React Server Component render event.

**Parameters**:
```typescript
{
  file: string | null;
  componentName: string | null;
  route: string;
  durationMs: number;
  isAsync: boolean;
  startedAt: number;
  finishedAt: number;
}
```

**Example**:
```typescript
import { recordRscRenderEvent } from '@forgefoundry/nextpulse';

recordRscRenderEvent({
  file: 'app/components/UserProfile.tsx',
  componentName: 'UserProfile',
  route: '/profile',
  durationMs: 45,
  isAsync: true,
  startedAt: Date.now() - 45,
  finishedAt: Date.now(),
});
```

---

#### `recordError(event: Omit<ErrorEvent, 'id' | 'timestamp'>): ErrorEvent`

Record an error event.

**Parameters**:
```typescript
{
  route: string | null;
  source: 'server-action' | 'route-handler' | 'rsc-render' | 'suspense' | 'client' | 'fetch' | 'next-runtime' | 'unknown';
  message: string;
  stack?: string;
  severity: 'error' | 'warning' | 'info';
  meta?: Record<string, unknown>;
}
```

**Returns**: `ErrorEvent` object with generated ID and timestamp

**Example**:
```typescript
import { recordError } from '@forgefoundry/nextpulse';

const errorEvent = recordError({
  route: '/dashboard',
  source: 'server-action',
  message: 'Failed to create user',
  stack: new Error().stack,
  severity: 'error',
  meta: { userId: '123', action: 'createUser' },
});

console.log(errorEvent.id); // 'error_1234567890_abc123'
```

---

#### `recordLog(event: Omit<LogEvent, 'id' | 'timestamp'>): LogEvent`

Record a log event.

**Parameters**:
```typescript
{
  route: string | null;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  meta?: Record<string, unknown>;
}
```

**Returns**: `LogEvent` object with generated ID and timestamp

**Example**:
```typescript
import { recordLog } from '@forgefoundry/nextpulse';

const logEvent = recordLog({
  route: '/dashboard',
  level: 'info',
  message: 'User logged in successfully',
  meta: { userId: '123', timestamp: Date.now() },
});
```

---

### Error Tracking

#### `getErrorLogSnapshot(): ErrorLogSnapshot`

Get the current error and log snapshot.

**Returns**: `ErrorLogSnapshot` object

**Example**:
```typescript
import { getErrorLogSnapshot } from '@forgefoundry/nextpulse';

const snapshot = getErrorLogSnapshot();
console.log(snapshot.errors.length); // Number of errors
console.log(snapshot.logs.length);   // Number of logs
```

**Return Type**:
```typescript
interface ErrorLogSnapshot {
  errors: ErrorEvent[];
  logs: LogEvent[];
  lastUpdated: number;
}
```

---

#### `clearErrorsAndLogs(): void`

Clear all errors and logs.

**Example**:
```typescript
import { clearErrorsAndLogs } from '@forgefoundry/nextpulse';

clearErrorsAndLogs();
```

**Use Cases**:
- Reset state between tests
- Clear errors after handling
- Fresh start for debugging session

---

### Route Tracking

#### `setCurrentRoute(route: string): void`

Set the current route (for client-side tracking).

**Parameters**:
- `route` (string) - The current route path

**Example**:
```typescript
import { setCurrentRoute } from '@forgefoundry/nextpulse';

// In Next.js useEffect
useEffect(() => {
  setCurrentRoute(pathname);
}, [pathname]);
```

---

#### `getCurrentRoute(): string | null`

Get the current route.

**Returns**: Current route string or `null`

**Example**:
```typescript
import { getCurrentRoute } from '@forgefoundry/nextpulse';

const route = getCurrentRoute();
console.log(route); // '/dashboard' or null
```

---

## HTTP API Endpoints

All endpoints are served by the Next.js app at `/api/nextpulse/*` and by the dashboard server at `/api/*`.

### `GET /api/nextpulse/metadata`

Get application metadata.

**Response**:
```json
{
  "appName": "my-next-app",
  "nextVersion": "14.0.0",
  "gitBranch": "main",
  "gitSha": "abc1234",
  "gitDirty": false,
  "port": "3000"
}
```

**Example**:
```typescript
const response = await fetch('/api/nextpulse/metadata');
const metadata = await response.json();
console.log(metadata.appName);
```

---

### `GET /api/nextpulse/config`

Get NextPulse configuration.

**Response**:
```json
{
  "enabled": true,
  "overlayPosition": "bottomRight",
  "openBrowserOnStart": true
}
```

**Example**:
```typescript
const response = await fetch('/api/nextpulse/config');
const config = await response.json();
console.log(config.overlayPosition);
```

---

### `GET /api/nextpulse/runtime`

Get runtime snapshot (sessions, fetches, actions, etc.).

**Response**:
```json
{
  "sessions": [
    {
      "id": "session_1234567890_abc123",
      "route": "/dashboard",
      "startedAt": 1234567890000,
      "finishedAt": 1234567895000,
      "fetches": [...],
      "actions": [...],
      "rsc": [...],
      "suspense": [...],
      "streaming": [...],
      "timeline": [...]
    }
  ],
  "activeSessionId": "session_1234567890_abc123",
  "lastUpdated": 1234567890000
}
```

**Example**:
```typescript
const response = await fetch('/api/nextpulse/runtime');
const runtime = await response.json();
console.log(runtime.sessions.length);
```

---

### `GET /api/nextpulse/errors`

Get error and log snapshot.

**Response**:
```json
{
  "errors": [
    {
      "id": "error_1234567890_abc123",
      "route": "/dashboard",
      "source": "server-action",
      "message": "Failed to create user",
      "stack": "Error: Failed...",
      "timestamp": 1234567890000,
      "sessionId": "session_123",
      "severity": "error",
      "meta": {}
    }
  ],
  "logs": [...],
  "lastUpdated": 1234567890000
}
```

**Example**:
```typescript
const response = await fetch('/api/nextpulse/errors');
const { errors, logs } = await response.json();
console.log(`${errors.length} errors, ${logs.length} logs`);
```

---

## Dashboard API Endpoints

These endpoints are served by the standalone dashboard server (`nextpulse serve`).

### `GET /api/health`

Health check endpoint.

**Response**:
```json
{
  "status": "ok",
  "timestamp": 1234567890000
}
```

---

### `GET /api/routes`

Get route tree structure.

**Response**:
```json
{
  "tree": [
    {
      "path": "/",
      "type": "page",
      "file": "app/page.tsx",
      "children": [...]
    }
  ],
  "totalRoutes": 15
}
```

---

### `GET /api/bundles`

Get bundle analysis.

**Response**:
```json
{
  "client": [
    {
      "name": "main.js",
      "size": 123456,
      "type": "client"
    }
  ],
  "server": [...],
  "totalSize": 456789
}
```

---

### `GET /api/snapshot`

Get complete diagnostic snapshot.

**Response**: Same as `nextpulse snapshot` command output

---

## TypeScript Types

### Core Types

#### `SessionEvent`

```typescript
interface SessionEvent {
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
```

#### `FetchEvent`

```typescript
interface FetchEvent {
  id: string;
  url: string;
  method: string;
  route: string;
  origin: 'client-component' | 'server-component' | 'server-action' | 'route-handler' | 'unknown';
  statusCode: number | null;
  durationMs: number;
  cacheMode?: string | null;
  cacheResult?: 'hit' | 'miss' | 'bypass' | 'unknown';
  startedAt: number;
  finishedAt: number;
}
```

#### `ErrorEvent`

```typescript
interface ErrorEvent {
  id: string;
  route: string | null;
  source: ErrorSource;
  message: string;
  stack?: string;
  timestamp: number;
  sessionId?: string | null;
  severity: 'error' | 'warning' | 'info';
  meta?: Record<string, unknown>;
}

type ErrorSource =
  | 'server-action'
  | 'route-handler'
  | 'rsc-render'
  | 'suspense'
  | 'client'
  | 'fetch'
  | 'next-runtime'
  | 'unknown';
```

---

## Advanced Usage

### Custom Instrumentation Wrapper

Create a custom wrapper for server actions:

```typescript
import { recordServerActionEvent, recordError } from '@forgefoundry/nextpulse';

export function withPulse<T extends (...args: any[]) => Promise<any>>(
  action: T,
  name: string
): T {
  return (async (...args: any[]) => {
    const startedAt = Date.now();
    try {
      const result = await action(...args);
      recordServerActionEvent({
        name,
        file: null,
        route: getCurrentRoute(),
        executionTimeMs: Date.now() - startedAt,
        status: 'success',
        startedAt,
        finishedAt: Date.now(),
      });
      return result;
    } catch (error) {
      recordServerActionEvent({
        name,
        file: null,
        route: getCurrentRoute(),
        executionTimeMs: Date.now() - startedAt,
        status: 'error',
        errorMessage: error.message,
        startedAt,
        finishedAt: Date.now(),
      });
      recordError({
        route: getCurrentRoute(),
        source: 'server-action',
        message: error.message,
        stack: error.stack,
        severity: 'error',
      });
      throw error;
    }
  }) as T;
}

// Usage
const createUser = withPulse(async (data: UserData) => {
  // ... implementation
}, 'createUser');
```

### Session-Based Analytics

Track page views and interactions:

```typescript
import { beginSession, endSession, setCurrentRoute } from '@forgefoundry/nextpulse';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export function useNextPulseSession() {
  const pathname = usePathname();

  useEffect(() => {
    setCurrentRoute(pathname);
    const sessionId = beginSession(pathname);

    return () => {
      endSession();
    };
  }, [pathname]);
}

// In app/layout.tsx
export default function RootLayout({ children }) {
  useNextPulseSession();

  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
```

---

See also:
- [Architecture](architecture.md)
- [Configuration](configuration.md)
- [Development Guide](development.md)
