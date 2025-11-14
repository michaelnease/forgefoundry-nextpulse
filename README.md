# NextPulse

> **Developer diagnostics and monitoring for Next.js applications**

NextPulse is a comprehensive development tool that provides real-time insights into your Next.js app's performance, runtime behavior, errors, and bundles. Get instant visibility into server components, server actions, fetch calls, errors, and more - all without impacting production.

[![npm version](https://img.shields.io/npm/v/@forgefoundry/nextpulse)](https://www.npmjs.com/package/@forgefoundry/nextpulse)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Features

- **Dev Overlay** - Lightweight overlay showing app metadata, git info, and real-time activity
- **Session Tracking** - Monitor user navigation sessions with route-based boundaries
- **Fetch Monitoring** - Track all fetch calls with timing, cache behavior, and status
- **Server Action Tracking** - Monitor server action execution and errors
- **RSC Performance** - Measure React Server Component render times
- **Error Center** - Centralized error and log tracking from all sources
- **Bundle Analysis** - Analyze client and server bundle sizes
- **Performance Timeline** - Visual timeline with waterfall detection
- **Diagnostic Snapshots** - Export AI-readable diagnostic data
- **Dashboard Server** - Standalone dashboard at http://localhost:4337

---

## Quick Start

### Installation

```bash
# Using npx (recommended)
npx @forgefoundry/nextpulse init

# Or install globally
npm install -g @forgefoundry/nextpulse
nextpulse init
```

NextPulse auto-detects your Next.js setup (App Router vs Pages Router) and injects itself automatically.

### Start Your App

```bash
npm run dev
```

You'll see the NextPulse overlay in the bottom-right corner of your app.

### View Dashboard

```bash
nextpulse serve
```

Opens the dashboard at http://localhost:4337 with:
- Metadata & configuration
- Route tree visualization
- Real-time runtime activity
- Performance timelines
- Bundle analysis
- Error tracking

---

## Commands

### `nextpulse init`

Setup NextPulse in your Next.js app with auto-detection (zero-config).

```bash
nextpulse init [options]
```

**Options:**
- `--app <path>` - Path to Next.js app root (default: `.`)
- `--dry-run` - Show what would be done without making changes
- `--revert` - Remove NextPulse from the project
- `--force` - Overwrite existing files
- `--with-dev-script` - Update package.json dev script to include NextPulse

**What it does:**
1. Detects App Router vs Pages Router
2. Creates `.nextpulse/metadata.json`
3. Generates API routes at `/api/nextpulse/*`
4. Injects `<NextPulse />` component into your root layout/app
5. Creates `nextpulse.config.json` (optional)

### `nextpulse serve`

Start the standalone dashboard server.

```bash
nextpulse serve [options]
```

**Options:**
- `--port <port>` - Port to run the server on (default: `4337`)
- `--path <path>` - Path to Next.js project root (default: `.`)
- `--no-open` - Don't automatically open browser

### `nextpulse snapshot`

Generate a complete diagnostic snapshot (AI-readable JSON).

```bash
nextpulse snapshot [options]
```

**Options:**
- `--path <path>` - Path to Next.js project root (default: `.`)

**Output:** Prints JSON to stdout containing:
- Project metadata
- Configuration
- Route tree
- Bundle analysis
- Runtime sessions
- Performance metrics
- Error logs
- Environment info

Use this to share diagnostics with AI assistants or team members.

---

## Configuration

Create `nextpulse.config.json` in your project root:

```json
{
  "enabled": true,
  "overlayPosition": "bottomRight",
  "openBrowserOnStart": true
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable/disable NextPulse overlay |
| `overlayPosition` | `"bottomRight"` \| `"bottomLeft"` \| `"topRight"` \| `"topLeft"` | `"bottomRight"` | Position of overlay |
| `openBrowserOnStart` | `boolean` | `true` | Auto-open browser when running `nextpulse serve` |

---

## Architecture

NextPulse is organized into distinct layers:

### **CLI Layer** (`src/cli/`)
Entry point for all commands (`init`, `serve`, `snapshot`)

### **Runtime Layer** (`src/runtime/`)
React components that render the overlay and panel in your Next.js app

### **Instrumentation Layer** (`src/instrumentation/`)
Non-invasive monitoring of:
- Session tracking
- Fetch calls (global fetch patching)
- Server actions
- React Server Components
- Suspense boundaries
- Streaming phases
- Errors and logs

### **Server Layer** (`src/server/`)
Standalone HTTP dashboard server with:
- Route scanning
- Bundle analysis
- Performance aggregation
- Diagnostic snapshot generation

### **Utils Layer** (`src/utils/`)
Helper functions for:
- AST-based code injection
- Project detection (App/Pages Router)
- Configuration management
- API route generation

See [README/architecture.md](README/architecture.md) for detailed architecture documentation.

---

## How It Works

### Session Tracking

NextPulse tracks user navigation sessions automatically:
- Each route change creates a new session
- Sessions capture: fetches, server actions, RSC renders, suspense events
- Max 50 sessions kept in memory (development only)

### Fetch Monitoring

Global fetch patching records:
- URL, method, status code
- Duration and timing
- Cache mode and result
- Origin (client, server-component, server-action, route-handler)

### Error Tracking

Comprehensive error capture from:
- `window.onerror` (client)
- `window.onunhandledrejection` (client)
- `console.error` (client)
- Server action failures
- RSC render errors
- Failed fetch calls

All errors are linked to sessions and routes for easy debugging.

### Performance Analysis

Detects performance issues:
- **Slowest RSC components** - Find render bottlenecks
- **Suspense boundaries** - Track fallback timing
- **Waterfalls** - Identify serial fetch/RSC chains that should be parallel

---

## Development-Only

NextPulse runs **only in development mode**:

```typescript
if (process.env.NODE_ENV !== "development") {
  return; // No-op in production
}
```

This means:
- Zero production bundle size impact
- No production runtime overhead
- Safe to commit to your repository

---

## Uninstall

### Option 1: Use `--revert` flag

```bash
nextpulse init --revert
```

This removes:
- `<NextPulse />` component from layout/app
- API routes at `/api/nextpulse/*`
- `.nextpulse/` directory

### Option 2: Manual removal

1. Remove import and component:
   ```tsx
   // Remove these lines
   import { NextPulse } from "@forgefoundry/nextpulse";
   <NextPulse />
   ```

2. Delete files:
   ```bash
   rm -rf .nextpulse/
   rm -rf app/api/nextpulse/  # or pages/api/nextpulse/
   rm nextpulse.config.json
   ```

3. Uninstall package:
   ```bash
   npm uninstall @forgefoundry/nextpulse
   ```

---

## API Reference

### Runtime API

Access runtime data via API routes:

- `GET /api/nextpulse/metadata` - App metadata
- `GET /api/nextpulse/config` - NextPulse configuration
- `GET /api/nextpulse/runtime` - Runtime sessions snapshot
- `GET /api/nextpulse/errors` - Error and log events

### Instrumentation API

```typescript
// Manual instrumentation (advanced)
import { beginSession, endSession, recordFetchEvent } from "@forgefoundry/nextpulse";

// Create session
const sessionId = beginSession("/dashboard");

// Record custom fetch event
recordFetchEvent({
  url: "https://api.example.com/data",
  method: "GET",
  route: "/dashboard",
  origin: "client-component",
  statusCode: 200,
  durationMs: 150,
  startedAt: Date.now() - 150,
  finishedAt: Date.now(),
});

// End session
endSession();
```

See [README/api-reference.md](README/api-reference.md) for complete API documentation.

---

## Troubleshooting

### Overlay not showing

1. Check `NODE_ENV === "development"`
2. Verify `nextpulse.config.json` has `enabled: true`
3. Check browser console for errors
4. Ensure `<NextPulse />` is in your root layout/app

### Dashboard shows no data

1. Make sure your Next.js dev server is running
2. Run `nextpulse serve` from your project root
3. Check that API routes exist at `/api/nextpulse/*`
4. Try re-running `nextpulse init`

### TypeScript errors

Make sure you have the latest version:

```bash
npm install @forgefoundry/nextpulse@latest
```

See [README/troubleshooting.md](README/troubleshooting.md) for more help.

---

## Compatibility

- **Next.js**: 13.4+ (App Router and Pages Router)
- **React**: 18.0+ or 19.0+
- **Node.js**: 18.17+
- **TypeScript**: 5.0+ (optional but recommended)

---

## Contributing

Contributions are welcome! Please see [README/contributing.md](README/contributing.md) for guidelines.

### Development Setup

```bash
# Clone repository
git clone https://github.com/michaelnease/nextforge.git
cd nextforge

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Development mode
npm run dev
```

---

## License

MIT © [Forge Foundry](https://github.com/michaelnease/nextforge)

---

## Links

- [Documentation](README/)
- [NPM Package](https://www.npmjs.com/package/@forgefoundry/nextpulse)
- [GitHub Repository](https://github.com/michaelnease/nextforge)
- [Issue Tracker](https://github.com/michaelnease/nextforge/issues)

---

## Acknowledgments

Built with:
- [commander](https://github.com/tj/commander.js) - CLI framework
- [babel/parser](https://babeljs.io/docs/babel-parser) - AST parsing
- [recast](https://github.com/benjamn/recast) - Code transformation
- [picocolors](https://github.com/alexeyraspopov/picocolors) - Terminal colors
- [zod](https://github.com/colinhacks/zod) - Schema validation

---

**Made with ❤️ for Next.js developers**
