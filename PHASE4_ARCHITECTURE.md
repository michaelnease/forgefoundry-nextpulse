# Phase 4: Performance & Streaming Diagnostics - Architecture Plan

## Overview

Phase 4 adds performance instrumentation to track RSC renders, Suspense boundaries, and streaming phases in Next.js applications. This provides developers with detailed performance timelines and waterfall detection.

## Architecture Components

### 1. Data Model Extensions (`src/types/runtime.ts`)

**New Event Types:**
- `RscRenderEvent` - Tracks server component render timing
- `SuspenseEvent` - Tracks Suspense boundary behavior
- `StreamingEvent` - Tracks streaming phases
- `PerformanceTimelineEntry` - Unified timeline entry

**Extended SessionEvent:**
- Added arrays: `rsc`, `suspense`, `streaming`, `timeline`

### 2. Instrumentation Strategy

#### RSC Instrumentation (`instrumentRSC.ts`)
**Challenge:** Next.js RSC rendering is internal and not easily accessible.

**Solution:**
1. Use global hook: `globalThis.__next_pulse_rsc_patch`
2. Wrap React Server Component execution by intercepting async component functions
3. Use stack traces to infer component names and files
4. Detect async components (those returning Promises)

**Approach:**
- Patch module-level async functions that look like RSC components
- Use Proxy or Function wrapping for server components
- Record start/end times and detect async behavior

#### Suspense Instrumentation (`instrumentSuspense.ts`)
**Challenge:** React Suspense is internal to React.

**Solution:**
1. Wrap `React.Suspense` component (if accessible)
2. Use React DevTools hooks (if available in dev)
3. Monitor fallback rendering vs content resolution
4. Track boundary identity from props or context

**Approach:**
- Wrap Suspense component at render time
- Use useEffect/useLayoutEffect to detect fallback mounting
- Track when content resolves (Promise resolution)

#### Streaming Instrumentation (`instrumentStreaming.ts`)
**Challenge:** Next.js streaming is internal to the framework.

**Solution:**
1. Hook into Next.js streaming pipeline via global hooks
2. Monitor Response stream events
3. Detect phases: shell → data → content → complete
4. Use timing markers in the stream

**Approach:**
- Patch Next.js internal streaming functions
- Monitor Response.body stream events
- Track phase transitions via timestamps

### 3. Timeline Builder (`timeline.ts`)

**Responsibilities:**
- Convert all event types to timeline entries
- Sort entries by timestamp
- Detect waterfalls (3+ serial async operations)
- Calculate performance metrics

**Waterfall Detection:**
- Identify serial fetch calls (one starts after previous ends)
- Identify serial async RSC components
- Flag patterns that indicate performance issues

### 4. Integration Points

**Server-side:**
- Initialize in Next.js middleware or instrumentation hook
- Hook into RSC render pipeline
- Monitor streaming response

**Client-side:**
- Initialize in NextPulse component
- Monitor Suspense boundaries
- Track streaming phases from client perspective

### 5. Dashboard UI

**Performance Timeline View:**
- Gantt-style chart using CSS
- Horizontal time axis
- Color-coded event bars
- Summary metrics panel
- Waterfall indicators

## Implementation Plan

### Step 1: Extend Data Model
- Add new event types to `runtime.ts`
- Extend `SessionEvent` interface
- Update session tracking functions

### Step 2: Implement RSC Instrumentation
- Create `instrumentRSC.ts`
- Implement component wrapping
- Record render events

### Step 3: Implement Suspense Instrumentation
- Create `instrumentSuspense.ts`
- Wrap Suspense boundaries
- Track fallback/content timing

### Step 4: Implement Streaming Instrumentation
- Create `instrumentStreaming.ts`
- Hook into streaming pipeline
- Record phase events

### Step 5: Create Timeline Builder
- Create `timeline.ts`
- Convert events to timeline entries
- Detect waterfalls

### Step 6: Update Server & UI
- Add `/api/performance` endpoint
- Update dashboard with timeline view
- Add perf summary to Panel

### Step 7: Tests
- Test each instrumentation module
- Test timeline builder
- Test API endpoint

## Key Considerations

1. **Next.js Internals**: RSC and streaming are internal - use best-effort detection
2. **Performance Impact**: Minimal overhead, efficient data structures
3. **Development Only**: All instrumentation disabled in production
4. **Fallback Strategies**: If direct hooks fail, use alternative detection methods
5. **Compatibility**: Work with Next.js 13+ App Router

