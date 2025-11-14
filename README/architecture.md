# Architecture

Deep dive into NextPulse's architecture, design patterns, and implementation details.

---

## Overview

NextPulse is built using a **layered architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────┐
│          CLI Layer (Commands)            │
│  init, serve, snapshot                   │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│      Server Layer (Dashboard)            │
│  HTTP server, scanners, aggregation      │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│   Instrumentation Layer (Tracking)       │
│  Sessions, fetch, RSC, errors            │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│     Runtime Layer (UI Components)        │
│  NextPulse component, Panel, StatusIcon  │
└──────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│       Utils Layer (Helpers)              │
│  AST, config, detection, injection       │
└──────────────────────────────────────────┘
```

---

## Layer Breakdown

### 1. CLI Layer

**Location**: `src/cli/`

**Purpose**: Command-line interface entry point

**Key Files**:
- `index.ts` - Main CLI entry using `commander`

**Commands**:
```typescript
program
  .command('init')      // Setup NextPulse
  .command('serve')     // Start dashboard
  .command('snapshot')  // Generate diagnostics
```

**Design Patterns**:
- **Command Pattern**: Each command is self-contained
- **Dependency Injection**: Commands receive options as parameters

---

### 2. Server Layer

**Location**: `src/server/`

**Purpose**: Standalone HTTP dashboard server and data aggregation

**Key Files**:
- `startServer.ts` - HTTP server with inline HTML dashboard
- `routesScanner.ts` - Scans app/ and pages/ directories
- `bundleScanner.ts` - Analyzes .next/ build output
- `snapshot.ts` - Generates diagnostic snapshots
- `loadMetadata.ts` - Reads project metadata

**Architecture**:

```
HTTP Server (port 4337)
├── Static Routes
│   └── GET / → Dashboard HTML
└── API Routes
    ├── GET /api/health
    ├── GET /api/metadata
    ├── GET /api/config
    ├── GET /api/routes
    ├── GET /api/runtime
    ├── GET /api/performance
    ├── GET /api/bundles
    ├── GET /api/errors
    └── GET /api/snapshot
```

**Design Patterns**:
- **Singleton**: Single HTTP server instance
- **Facade**: Simple API over complex scanning logic
- **Repository**: Scanners abstract file system access

---

### 3. Instrumentation Layer

**Location**: `src/instrumentation/`

**Purpose**: Non-invasive runtime monitoring and tracking

**Key Files**:
- `sessions.ts` - Core session management (singleton)
- `instrumentFetch.ts` - Global fetch patching
- `instrumentServerActions.ts` - Server action wrapping
- `instrumentRSC.ts` - RSC component wrapping
- `instrumentSuspense.ts` - Suspense boundary tracking
- `instrumentStreaming.ts` - Streaming phase tracking
- `errors.ts` - Error and log center
- `clientErrorHooks.ts` - Browser error capture
- `timeline.ts` - Performance timeline builder

**Session Lifecycle**:

```
User Navigation
     │
     ├─► beginSession(route)
     │        │
     │        ├─► Create session object
     │        ├─► End previous session
     │        └─► Set as active session
     │
     ├─► Events occur (fetches, actions, RSC renders)
     │        │
     │        └─► recordFetchEvent()
     │        └─► recordServerActionEvent()
     │        └─► recordRscRenderEvent()
     │        └─► recordError()
     │
     └─► endSession()
              │
              └─► Mark session as finished
```

**Instrumentation Techniques**:

1. **Global Patching** (Fetch)
```typescript
const originalFetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
  const start = Date.now();
  const result = await originalFetch(...args);
  recordFetchEvent({...});
  return result;
};
```

2. **Function Wrapping** (Server Actions, RSC)
```typescript
function wrapServerAction(action) {
  return async (...args) => {
    const start = Date.now();
    const result = await action(...args);
    recordServerActionEvent({...});
    return result;
  };
}
```

3. **Error Hooks** (Client Errors)
```typescript
window.onerror = (message, source, lineno, colno, error) => {
  recordError({...});
  return originalOnError?.(...);
};
```

**Design Patterns**:
- **Singleton**: In-memory state (snapshot)
- **Observer**: Event-based tracking
- **Decorator**: Wrapping functions without modifying them
- **Proxy**: Intercepting fetch calls

**Data Flow**:

```
User Action
     │
     ▼
Instrumentation Capture
     │
     ├─► In-Memory Storage
     │        │
     │        └─► RuntimeSnapshot
     │        └─► ErrorLogSnapshot
     │
     └─► API Routes
              │
              ├─► /api/nextpulse/runtime
              └─► /api/nextpulse/errors
                       │
                       ▼
                   Dashboard UI
```

---

### 4. Runtime Layer

**Location**: `src/runtime/`

**Purpose**: React components for overlay and panel

**Key Files**:
- `NextPulse.tsx` - Main component (anvil button + panel)
- `Panel.tsx` - Collapsible diagnostic panel
- `StatusIcon.tsx` - Git dirty status indicator

**Component Hierarchy**:

```
<NextPulse>
  ├── Button (anvil icon)
  └── {isOpen && <Panel>}
        ├── Metadata section
        ├── Activity section (expandable)
        │     ├── Fetches
        │     └── Server Actions
        ├── Performance section (expandable)
        │     ├── RSC renders
        │     ├── Suspense
        │     └── Streaming
        ├── Bundles section (expandable)
        └── Errors section (expandable)
```

**State Management**:

```typescript
// Polling architecture
useEffect(() => {
  const fetchRuntime = async () => {
    const response = await fetch('/api/nextpulse/runtime');
    setRuntimeData(await response.json());
  };

  fetchRuntime();
  const interval = setInterval(fetchRuntime, 2000);
  return () => clearInterval(interval);
}, []);
```

**Design Patterns**:
- **Presentational Components**: Pure UI components
- **Container Components**: Data fetching logic
- **Polling**: Real-time updates via intervals

---

### 5. Utils Layer

**Location**: `src/utils/`

**Purpose**: Helper functions and utilities

**Key Files**:
- `injection.ts` - AST-based code injection
- `injectionLocal.ts` - Local code injection
- `projectDetect.ts` - Project structure detection
- `config.ts` - Configuration management
- `generateFiles.ts` - API route generation
- `ast.ts` - AST manipulation utilities

**AST-Based Injection**:

```typescript
// Safe code transformation using Babel + Recast
1. Parse code → AST
2. Check if already injected (idempotent)
3. Add import statement
4. Add component to JSX
5. Generate code (preserves formatting)
6. Write file
```

**Project Detection Algorithm**:

```typescript
function detectRouterType(projectRoot: string) {
  // 1. Check for app/ directory
  if (exists(join(projectRoot, 'app'))) {
    return 'app-router';
  }

  // 2. Check for pages/ directory
  if (exists(join(projectRoot, 'pages'))) {
    return 'pages-router';
  }

  // 3. Check monorepo structure
  if (exists(join(projectRoot, 'apps'))) {
    // Scan apps/*/app or apps/*/pages
  }

  throw new Error('Could not detect Next.js project');
}
```

**Design Patterns**:
- **Strategy**: Different injection strategies for App/Pages Router
- **Template Method**: Common injection flow, different implementations
- **Factory**: Generate API routes based on router type

---

## Data Structures

### RuntimeSnapshot

```typescript
interface RuntimeSnapshot {
  sessions: SessionEvent[];
  activeSessionId: string | null;
  lastUpdated: number;
}

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

### ErrorLogSnapshot

```typescript
interface ErrorLogSnapshot {
  errors: ErrorEvent[];
  logs: LogEvent[];
  lastUpdated: number;
}

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
```

### DiagnosticSnapshot

```typescript
interface DiagnosticSnapshot {
  timestamp: number;
  metadata: Metadata;
  config: Config;
  routes: RouteTree;
  bundles: BundleAnalysis | null;
  runtime: RuntimeSnapshot;
  performance: PerformanceSnapshot;
  errors: ErrorLogSnapshot;
  environment: EnvironmentInfo;
}
```

---

## Security Considerations

### Development-Only Execution

All instrumentation checks `NODE_ENV`:

```typescript
if (process.env.NODE_ENV !== 'development') {
  return; // No-op in production
}
```

### Safe AST Transformation

Using Babel parser and Recast ensures:
- No code execution during parsing
- Preserves original formatting
- Idempotent (safe to run multiple times)

### No Secrets Exposure

Diagnostic snapshots:
- Don't include environment variables
- Sanitize file paths (relative only)
- Don't expose `.env` contents

### XSS Prevention

Dashboard HTML should escape dynamic content:
```typescript
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
```

---

## Performance Characteristics

### Memory Usage

- **Sessions**: Max 50 in memory (~5-10 MB)
- **Errors**: Max 100 errors, 200 logs (~2-5 MB)
- **Total**: ~10-20 MB overhead in development

### CPU Usage

- **Instrumentation**: <5% overhead (development only)
- **Polling**: Minimal (2-5s intervals)
- **Dashboard**: Single-threaded HTTP server

### Bundle Size

- **Production**: 0 bytes (tree-shaken)
- **Development**: ~50 KB (runtime components)

---

## Extension Points

NextPulse is designed to be extensible:

### 1. Custom Instrumentation

```typescript
import { recordFetchEvent } from '@forgefoundry/nextpulse';

// Record custom events
recordFetchEvent({
  url: 'custom-api',
  method: 'POST',
  route: '/dashboard',
  origin: 'client-component',
  statusCode: 200,
  durationMs: 150,
  startedAt: Date.now() - 150,
  finishedAt: Date.now(),
});
```

### 2. Custom Dashboard Tab

Fork and modify `src/server/startServer.ts` to add tabs.

### 3. Custom Scanners

Implement scanner interface:

```typescript
interface Scanner {
  scan(projectRoot: string): ScanResult;
}
```

---

## Future Architecture

Potential future enhancements:

1. **Plugin System**: Allow third-party extensions
2. **WebSocket Support**: Real-time updates instead of polling
3. **Distributed Tracing**: Cross-service request tracking
4. **Time-Travel Debugging**: Replay sessions
5. **Performance Budgets**: Alert on threshold violations

---

See also:
- [API Reference](api-reference.md)
- [Development Guide](development.md)
- [Configuration](configuration.md)
