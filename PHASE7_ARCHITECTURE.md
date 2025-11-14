# Phase 7: AI Diagnostic Snapshot - Architecture Plan

## Overview

Phase 7 adds a comprehensive diagnostic snapshot feature that combines all data from previous phases into a single, AI-readable JSON export.

## Architecture Components

### 1. Data Model (`src/types/snapshot.ts`)

**DiagnosticSnapshot**
- Combines all data sources:
  - metadata (from Phase 1)
  - config (from Phase 1)
  - routes (from Phase 2)
  - bundles (from Phase 5)
  - runtime (from Phase 3)
  - performance (from Phase 4)
  - errors (from Phase 6)
  - environment (Node version, platform, NextPulse version, Next.js version, git info)

### 2. Snapshot Generator (`src/server/snapshot.ts`)

**generateDiagnosticSnapshot()**
- Gathers all data synchronously:
  - metadata → loadMetadata()
  - config → readConfig()
  - routes → scanAllRoutes()
  - bundles → scanBundles()
  - runtime → getRuntimeSnapshot()
  - performance → getRuntimeSnapshot() + timeline/metrics
  - errors → getErrorLogSnapshot()
  - environment → process.versions, process.platform, package.json

**Sanitization**
- No secrets, env vars, cookies, headers
- Safe file paths only
- Fully serializable

### 3. CLI Command

**nextpulse snapshot**
- Detects project root
- Calls generateDiagnosticSnapshot()
- Prints JSON to stdout (pretty-printed, 2 spaces)
- No dashboard server needed
- No browser open
- Silent unless errors

### 4. Server Endpoint

**GET /api/snapshot**
- Calls generateDiagnosticSnapshot()
- Returns JSON
- Sanitized output

### 5. Dashboard UI

**Export Snapshot Button**
- Fetches /api/snapshot
- Downloads as nextpulse-snapshot-{timestamp}.json
- Uses blob URL for download

**Snapshot Tab (Optional)**
- Brief explanation
- Export button
- JSON preview (read-only)

## Implementation Strategy

1. Create snapshot types
2. Implement snapshot generator
3. Add CLI command
4. Add server endpoint
5. Update dashboard UI
6. Add tests

