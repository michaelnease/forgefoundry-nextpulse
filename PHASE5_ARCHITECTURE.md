# Phase 5: Bundle & Asset Analyzer - Architecture Plan

## Overview

Phase 5 adds static bundle analysis to scan Next.js build output (`.next/` directory) and extract detailed information about bundles, chunks, assets, and route-to-chunk mappings.

## Architecture Components

### 1. Data Model (`src/types/bundles.ts`)

**BundleAsset**
- Tracks individual files (JS, CSS, images, fonts, etc.)
- Records size (raw + gzip), type, location (client/server/shared)

**ChunkInfo**
- Groups related files (chunks with hashes)
- Tracks entry/dynamic/shared status
- Maps to routes

**RouteBundleInfo**
- Maps routes to their client/server chunks
- Calculates total sizes per route

**BundlesSnapshot**
- Complete snapshot of all bundle data
- Includes totals and generation timestamp

### 2. Bundle Scanner (`src/server/bundleScanner.ts`)

**Directory Structure Detection**
- `.next/static/chunks/` - Client chunks
- `.next/static/` - Static assets
- `.next/server/app/` - App Router server bundles
- `.next/server/pages/` - Pages Router server bundles
- `.next/server/chunks/` - Server chunks

**Asset Detection**
- File extension → type mapping
- Path-based client/server detection
- Size calculation (fs.statSync)
- Gzip size (zlib.gzipSync + readFileSync)

**Chunk Grouping**
- Extract base name from hashed filenames
- Group by base name
- Detect entry/dynamic/shared chunks

**Route Mapping**
- Use Phase 2 route data
- Map routes to server bundles
- Map routes to client chunks
- Calculate per-route totals

### 3. Server Endpoint

**GET /api/bundles**
- Calls `scanBundles(projectRoot)`
- Returns `BundlesSnapshot` as JSON
- Handles missing `.next/` gracefully

### 4. Dashboard UI

**New "Bundles" Tab**
- High-level totals (client/server sizes, largest chunks/assets)
- Route mapping table (route → sizes → chunk count)
- Assets list (sortable table)
- Chunk view (visual bars, highlight shared)
- Auto-refresh every 3 seconds

### 5. In-App Panel (Optional)

**Minimal Bundle Summary**
- Largest client chunk size
- Largest server chunk size
- Total client bundle size

## Implementation Strategy

### Step 1: Create Data Model
- Define all interfaces in `bundles.ts`

### Step 2: Implement Scanner
- Scan directories recursively
- Build asset list
- Build chunk list
- Map routes to bundles
- Calculate totals

### Step 3: Add Server Endpoint
- Add `/api/bundles` route
- Integrate with dashboard

### Step 4: Update Dashboard UI
- Add "Bundles" tab
- Implement bundle views
- Add auto-refresh

### Step 5: Update Panel (Optional)
- Add bundle summary section

### Step 6: Tests
- Test scanner with fixtures
- Test endpoint
- Test UI rendering

## Key Considerations

1. **Next.js Version Compatibility**: Handle different `.next/` structures gracefully
2. **Performance**: Efficient scanning, cache results if needed
3. **Missing Builds**: Handle missing `.next/` directory (no build yet)
4. **File I/O**: Use synchronous operations for simplicity in dev
5. **Gzip Calculation**: Optional but recommended for accurate size reporting

