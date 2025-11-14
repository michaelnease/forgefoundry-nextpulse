# Phase 3: Fetch & Server Action Inspector - Architecture Plan

## Overview

Phase 3 adds runtime instrumentation to track fetch calls and server actions in Next.js applications. All instrumentation runs only in development mode and does not affect production behavior.

## Architecture Components

### 1. Data Model (`src/types/runtime.ts`)

**FetchEvent**
- Tracks individual fetch() calls
- Records: URL, method, status, duration, cache info, origin
- Associated with a session

**ServerActionEvent**
- Tracks server action executions
- Records: name, file, execution time, status, errors
- Associated with a session

**SessionEvent**
- Represents a request/render session
- Contains arrays of fetches and actions
- Tracks start/end times

**RuntimeSnapshot**
- In-memory container for all runtime data
- Singleton pattern for global access
- Updated in real-time as events occur

### 2. Instrumentation Layer (`src/instrumentation/`)

#### Session Tracking (`sessions.ts`)
- **Server-side**: Begin session on request start, end on request finish
- **Client-side**: Begin session on navigation, end on new navigation
- Use Next.js request context (AsyncLocalStorage) for server-side
- Use pathname changes for client-side

#### Fetch Instrumentation (`instrumentFetch.ts`)
- **Server-side**: Patch `globalThis.fetch` in Node.js environment
- **Client-side**: Patch `window.fetch` in browser environment
- Wrap original fetch to record events
- Detect cache mode from RequestInit
- Infer origin from execution context (server-component, client-component, etc.)

#### Server Action Instrumentation (`instrumentServerActions.ts`)
- Hook into Next.js server action system
- Wrap action handlers to record execution
- Extract action name from function name or file
- Capture errors and stack traces

#### Initialization (`index.ts`)
- Single entry point for all instrumentation
- Guards to prevent double-initialization
- Development-only checks
- Initialize on module load

### 3. Server API (`src/server/startServer.ts`)

**GET /api/runtime**
- Returns current RuntimeSnapshot as JSON
- Accessible from dashboard
- Real-time data (no caching)

### 4. Dashboard UI Updates

**New Tab: "Runtime Activity"**
- Active Session display
- Recent Sessions list (collapsible)
- Fetch table with filtering
- Server Action table
- Auto-refresh every 1 second

### 5. In-App Panel Updates (`src/runtime/Panel.tsx`)

**New Section: "Activity"**
- Current session fetch count
- Last 5 fetches (URL, duration, status)
- Server action count
- Last action details
- Poll `/api/nextpulse/runtime` endpoint (client-side)

### 6. Integration Points

**Server-side initialization:**
- In Next.js middleware or instrumentation hook
- Or via a server component that imports the instrumentation

**Client-side initialization:**
- In NextPulse component's useEffect
- Only runs in development

## Implementation Strategy

### Phase 1: Data Model & Session Tracking
1. Create types
2. Implement session tracking
3. Test session lifecycle

### Phase 2: Fetch Instrumentation
1. Implement server-side fetch patching
2. Implement client-side fetch patching
3. Test fetch event recording

### Phase 3: Server Action Instrumentation
1. Research Next.js server action internals
2. Implement action wrapping
3. Test action event recording

### Phase 4: API & UI
1. Add /api/runtime endpoint
2. Update dashboard UI
3. Update in-app panel

### Phase 5: Testing
1. Unit tests for instrumentation
2. Integration tests for API
3. E2E tests for UI

## Key Considerations

1. **Development-only**: All code must check `NODE_ENV === "development"`
2. **No production impact**: Instrumentation must be completely disabled in production
3. **Performance**: Minimal overhead, efficient data structures
4. **Memory**: Limit session history (keep last N sessions)
5. **Thread-safety**: Use proper synchronization for server-side
6. **Next.js compatibility**: Work with both App Router and Pages Router

## Challenges & Solutions

**Challenge 1: Server Action Detection**
- Solution: Hook into Next.js action registration or wrap action exports

**Challenge 2: Origin Detection**
- Solution: Use stack traces or execution context to determine origin

**Challenge 3: Session Tracking Across Server/Client**
- Solution: Use request IDs or session IDs to correlate

**Challenge 4: Cache Detection**
- Solution: Parse RequestInit.cache and Response headers

**Challenge 5: Client-side Session Tracking**
- Solution: Use Next.js navigation events (usePathname hook)

