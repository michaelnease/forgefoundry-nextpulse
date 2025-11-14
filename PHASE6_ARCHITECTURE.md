# Phase 6: Error and Log Center - Architecture Plan

## Overview

Phase 6 adds structured error and log tracking to collect, organize, and display errors and important log events from the dev runtime.

## Architecture Components

### 1. Data Model (`src/types/errors.ts`)

**ErrorEvent**
- Tracks errors from various sources (server-action, route-handler, rsc-render, suspense, client, fetch, next-runtime)
- Records message, stack, route, session, severity, metadata

**LogEvent**
- Tracks non-error log events (debug, info, warn, error)
- Records message, level, route, session, metadata

**ErrorLogSnapshot**
- In-memory container for all errors and logs
- Singleton pattern matching RuntimeSnapshot
- Separate from RuntimeSnapshot for clarity

### 2. Error Instrumentation (`src/instrumentation/errors.ts`)

**Core Functions**
- `recordError()` - Record error events
- `recordLog()` - Record log events
- `getErrorLogSnapshot()` - Get current snapshot
- `clearErrorsAndLogs()` - Clear all data

**Integration Points**
- Fetch instrumentation: Record errors on fetch failures (non-2xx or network errors)
- Server action instrumentation: Record errors when actions throw
- RSC instrumentation: Record errors when renders fail
- Suspense instrumentation: Record warnings for long fallbacks
- Client error hooks: window.onerror, window.onunhandledrejection, console.error

### 3. Client Error Hooks

**Window Error Handlers**
- Patch window.onerror for uncaught errors
- Patch window.onunhandledrejection for unhandled promise rejections
- Wrap console.error to capture error-level logs (optional, can be disabled)

**Requirements**
- Only active in development
- Don't spam with too many logs
- Preserve original behavior

### 4. Server Endpoint

**GET /api/errors**
- Returns ErrorLogSnapshot as JSON
- Separate from /api/runtime for clarity

### 5. Dashboard UI

**New "Errors" Tab**
- Summary metrics (total errors, warnings, info logs, affected routes)
- Error list (most recent first) with expandable details
- Route grouped view (sidebar/toggle)
- Logs view (optional, filterable by level)
- Controls (Clear button, auto-refresh toggle)

### 6. In-App Panel

**Minimal Error Summary**
- Badge with error count
- Last error message (truncated)
- Link to dashboard

## Implementation Strategy

1. Create error types
2. Implement error instrumentation module
3. Integrate with existing instrumentation
4. Add client error hooks
5. Add server endpoint
6. Update dashboard UI
7. Update Panel.tsx
8. Add tests

