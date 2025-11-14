# Commands Reference

Complete reference for all NextPulse CLI commands.

---

## Overview

NextPulse provides three main commands:

| Command | Description |
|---------|-------------|
| `nextpulse init` | Setup NextPulse in your Next.js app |
| `nextpulse serve` | Start the standalone dashboard server |
| `nextpulse snapshot` | Generate diagnostic snapshot (JSON) |

---

## `nextpulse init`

Setup NextPulse in a Next.js application with automatic detection and configuration.

### Syntax

```bash
nextpulse init [options]
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--app <path>` | string | `.` | Path to Next.js app root |
| `--dry-run` | boolean | `false` | Preview changes without writing files |
| `--revert` | boolean | `false` | Remove NextPulse from the project |
| `--force` | boolean | `false` | Overwrite existing files |
| `--with-dev-script` | boolean | `false` | Update package.json dev script |

### Examples

#### Basic initialization

```bash
nextpulse init
```

#### Preview changes (dry run)

```bash
nextpulse init --dry-run
```

Output:
```
[dry-run] created app/api/nextpulse/metadata/route.ts
[dry-run] created app/api/nextpulse/config/route.ts
[dry-run] patched app/layout.tsx
```

#### Specify custom app directory

```bash
nextpulse init --app ./apps/web
```

#### Overwrite existing files

```bash
nextpulse init --force
```

#### Include development script

```bash
nextpulse init --with-dev-script
```

Updates `package.json`:
```json
{
  "scripts": {
    "dev": "concurrently \"next dev\" \"nextpulse serve\""
  }
}
```

#### Uninstall NextPulse

```bash
nextpulse init --revert
```

Removes:
- NextPulse component from layout/app
- API routes at `/api/nextpulse/*`
- `.nextpulse/` directory
- `nextpulse.config.json`

### What It Does

1. **Detects project structure**
   - App Router vs Pages Router
   - TypeScript vs JavaScript
   - Monorepo layout

2. **Creates files**
   - `.nextpulse/metadata.json` - App metadata
   - API routes at `/api/nextpulse/*`
   - `nextpulse.config.json` (optional)

3. **Injects component**
   - Uses AST-based transformation (safe, preserves formatting)
   - Adds `import { NextPulse } from "@forgefoundry/nextpulse"`
   - Injects `<NextPulse />` in root layout/app

4. **Idempotent**
   - Safe to run multiple times
   - Won't duplicate imports or components

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Error (invalid path, missing files, etc.) |

---

## `nextpulse serve`

Start the standalone dashboard server for monitoring and diagnostics.

### Syntax

```bash
nextpulse serve [options]
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--port <port>` | number | `4337` | Port to run the server on |
| `--path <path>` | string | `.` | Path to Next.js project root |
| `--no-open` | boolean | `false` | Don't automatically open browser |

### Examples

#### Start server (default settings)

```bash
nextpulse serve
```

Opens browser at http://localhost:4337

#### Custom port

```bash
nextpulse serve --port 8080
```

Opens browser at http://localhost:8080

#### Specify project path

```bash
nextpulse serve --path ./apps/web
```

#### Disable auto-open browser

```bash
nextpulse serve --no-open
```

#### Custom port + custom path

```bash
nextpulse serve --port 5000 --path ./apps/admin
```

### Dashboard Features

The dashboard provides:

1. **Metadata Tab**
   - App name, Next.js version
   - Git branch, SHA, dirty status
   - Development server port

2. **Routes Tab**
   - Visual route tree
   - Route types (page, layout, loading, error, route handler)
   - Dynamic segments `[param]`, catch-all `[...param]`

3. **Runtime Tab**
   - Active session tracking
   - Fetch calls with timing
   - Server action execution
   - RSC render performance

4. **Performance Tab**
   - Timeline visualization
   - Waterfall detection
   - Slowest components
   - Suspense boundaries

5. **Bundles Tab**
   - Client bundle analysis
   - Server bundle analysis
   - Chunk sizes and dependencies

6. **Errors Tab**
   - Centralized error log
   - Error source tracking
   - Stack traces
   - Session linking

7. **Snapshot Tab**
   - Export complete diagnostic snapshot
   - AI-readable JSON format
   - Share with team or AI assistants

### API Endpoints

The server exposes the following endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Dashboard HTML |
| `/api/health` | GET | Health check |
| `/api/metadata` | GET | App metadata |
| `/api/config` | GET | NextPulse configuration |
| `/api/routes` | GET | Route tree |
| `/api/runtime` | GET | Runtime sessions |
| `/api/performance` | GET | Performance metrics |
| `/api/bundles` | GET | Bundle analysis |
| `/api/errors` | GET | Error and log events |
| `/api/snapshot` | GET | Complete diagnostic snapshot |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl/Cmd + R` | Refresh data |
| `Ctrl/Cmd + K` | Search/filter |
| `Ctrl/Cmd + E` | Export snapshot |
| `Esc` | Close modal/panel |

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success (server stopped gracefully) |
| `1` | Error (invalid port, address in use, etc.) |

### Stopping the Server

Press `Ctrl + C` to stop the server gracefully:

```
^C
[nextpulse] Shutting down...
```

---

## `nextpulse snapshot`

Generate a complete diagnostic snapshot in AI-readable JSON format.

### Syntax

```bash
nextpulse snapshot [options]
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--path <path>` | string | `.` | Path to Next.js project root |

### Examples

#### Generate snapshot (print to stdout)

```bash
nextpulse snapshot
```

#### Save to file

```bash
nextpulse snapshot > diagnostic-snapshot.json
```

#### Pretty-print

```bash
nextpulse snapshot | jq .
```

#### Generate from custom path

```bash
nextpulse snapshot --path ./apps/web > web-snapshot.json
```

### Snapshot Contents

The snapshot includes:

```typescript
{
  timestamp: number,           // Unix timestamp
  metadata: {                  // App metadata
    appName: string,
    nextVersion: string,
    gitBranch: string,
    gitSha: string,
    gitDirty: boolean,
    port: string
  },
  config: {                    // NextPulse config
    enabled: boolean,
    overlayPosition: string,
    openBrowserOnStart: boolean
  },
  routes: {                    // Route tree
    tree: RouteNode[],
    totalRoutes: number
  },
  bundles: {                   // Bundle analysis
    client: BundleInfo[],
    server: BundleInfo[],
    totalSize: number
  },
  runtime: {                   // Runtime sessions
    sessions: Session[],
    activeSessionId: string | null,
    lastUpdated: number
  },
  performance: {               // Performance metrics
    sessions: EnrichedSession[],
    activeSessionId: string | null,
    lastUpdated: number
  },
  errors: {                    // Error log
    errors: ErrorEvent[],
    logs: LogEvent[],
    lastUpdated: number
  },
  environment: {               // Environment info
    node: string,
    platform: string,
    nextpulseVersion: string,
    nextJsVersion: string,
    git: {
      branch: string,
      sha: string,
      dirty: boolean
    }
  }
}
```

### Use Cases

1. **Share with AI assistants**
   ```bash
   nextpulse snapshot > snapshot.json
   # Upload snapshot.json to Claude, ChatGPT, etc.
   ```

2. **Debug with team members**
   ```bash
   nextpulse snapshot > issue-123-snapshot.json
   # Attach to GitHub issue
   ```

3. **Performance analysis**
   ```bash
   nextpulse snapshot | jq '.performance'
   ```

4. **Error tracking**
   ```bash
   nextpulse snapshot | jq '.errors'
   ```

5. **Bundle analysis**
   ```bash
   nextpulse snapshot | jq '.bundles'
   ```

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success (snapshot generated) |
| `1` | Error (invalid path, missing data, etc.) |

---

## Global Options

These options work with all commands:

### `--version` or `-v`

Display NextPulse version:

```bash
nextpulse --version
```

Output:
```
0.1.0
```

### `--help` or `-h`

Display help information:

```bash
nextpulse --help
nextpulse init --help
nextpulse serve --help
nextpulse snapshot --help
```

---

## Environment Variables

NextPulse respects the following environment variables:

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | Only runs in `development` |
| `PORT` | Default port for Next.js dev server |
| `NEXTPULSE_PORT` | Override default dashboard port (4337) |
| `NEXTPULSE_ENABLED` | Override config enabled setting |

### Examples

```bash
# Disable NextPulse
NEXTPULSE_ENABLED=false npm run dev

# Custom dashboard port
NEXTPULSE_PORT=5000 nextpulse serve
```

---

## Scripting

NextPulse commands can be used in scripts:

### package.json scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "dev:pulse": "concurrently \"npm run dev\" \"nextpulse serve\"",
    "pulse:init": "nextpulse init --force",
    "pulse:snapshot": "nextpulse snapshot > .nextpulse/snapshot.json",
    "pulse:remove": "nextpulse init --revert"
  }
}
```

### Shell scripts

```bash
#!/bin/bash
# dev-with-pulse.sh

# Initialize NextPulse
npx nextpulse init --force

# Start dev server and dashboard
concurrently \
  "npm run dev" \
  "nextpulse serve --port 4337"
```

### CI/CD integration

```yaml
# .github/workflows/diagnostics.yml
name: Generate Diagnostics
on: [push]
jobs:
  diagnostics:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npx nextpulse init --dry-run
      - run: npx nextpulse snapshot > snapshot.json
      - uses: actions/upload-artifact@v3
        with:
          name: diagnostic-snapshot
          path: snapshot.json
```

---

## Tips & Tricks

### Run dashboard in background

```bash
nextpulse serve --no-open &
```

### Auto-restart on file changes

```bash
npx nodemon --exec "nextpulse serve" --watch nextpulse.config.json
```

### Generate snapshot on interval

```bash
while true; do
  nextpulse snapshot > "snapshot-$(date +%s).json"
  sleep 300  # Every 5 minutes
done
```

### Compare snapshots

```bash
nextpulse snapshot > before.json
# Make changes...
nextpulse snapshot > after.json
diff before.json after.json
```

---

See also:
- [Installation Guide](installation.md)
- [Configuration Guide](configuration.md)
- [API Reference](api-reference.md)
