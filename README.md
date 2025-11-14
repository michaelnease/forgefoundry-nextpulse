# NextPulse

> **⚠️ Work in Progress**

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
- **Dashboard Server** - Standalone dashboard at http://localhost:4337 with real-time SSE updates

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

When you run `nextpulse init` in an interactive terminal, you'll be guided through a simple setup wizard that:

1. **Detects your app** - Automatically finds your Next.js app and router type (App Router or Pages Router)
2. **Prompts for settings** - Asks a few questions about overlay position and browser auto-open preferences
3. **Injects the overlay** - Adds the `<NextPulse />` component to your root layout or `_app.tsx`
4. **Creates API routes** - Generates all necessary API endpoints for runtime data, bundles, and errors
5. **Writes config** - Creates `nextpulse.config.json` with your preferences

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

Setup NextPulse in your Next.js app with auto-detection and an interactive setup wizard.

```bash
nextpulse init [options]
```

**Interactive Mode (Default)**

When run in an interactive terminal, `nextpulse init` will guide you through setup:

1. **Confirm app location** - Verifies the detected Next.js app path and router type
2. **Choose overlay position** - Select where the overlay should appear (bottom right, bottom left, top right, or top left)
3. **Browser auto-open** - Decide if the browser should open automatically when running `nextpulse serve`

**Non-Interactive Usage**

For CI/CD, scripts, or when you want to skip prompts:

```bash
# Accept all defaults
npx nextpulse init --yes

# Or specify options directly
npx nextpulse init --non-interactive --overlay-position bottomLeft --open-browser
```

**Options:**
- `--app <path>` - Path to Next.js app root (default: `.`)
- `-y, --yes` - Accept defaults without prompts (non-interactive)
- `--non-interactive` - Disable interactive prompts
- `--overlay-position <position>` - Overlay position: `bottomRight`, `bottomLeft`, `topRight`, or `topLeft`
- `--open-browser` - Open browser automatically when running `nextpulse serve`
- `--no-open-browser` - Do not open browser automatically
- `--dry-run` - Show what would be done without making changes
- `--revert` - Remove NextPulse from the project
- `--force` - Overwrite existing files
- `--with-dev-script` - Update package.json dev script to include NextPulse
- `--with-webpack` - Inject metadata into next.config.js via webpack DefinePlugin

**What it does:**
1. Detects App Router vs Pages Router
2. Creates `.nextpulse/metadata.json`
3. Generates API routes at `/api/nextpulse/*`
4. Injects `<NextPulse />` component into your root layout/app
5. Creates `nextpulse.config.json` with your preferences or defaults

### `nextpulse doctor`

Run health checks to verify your NextPulse installation.

```bash
nextpulse doctor [options]
```

**What it does:**

The `doctor` command performs a series of automated checks to verify that NextPulse is correctly set up in your project:

1. **Config file check** - Verifies `nextpulse.config.json` exists and is valid
2. **Metadata file check** - Verifies `.nextpulse/metadata.json` exists
3. **Injection check** - Verifies `<NextPulse />` is injected into your app entry file
4. **API routes check** - Verifies all required API routes are present
5. **Diagnostics check** - Verifies the diagnostics module is available

**Options:**
- `--app <appDir>` - Path to Next.js app root (default: `.`)

**Example output:**

All checks passing:
```
[nextpulse] Running health checks...

[nextpulse] ok: nextpulse.config.json found and valid
[nextpulse] ok: .nextpulse/metadata.json found
[nextpulse] ok: NextPulse is injected into layout
[nextpulse] ok: All NextPulse API routes are present
[nextpulse] ok: Diagnostics module is available

[nextpulse] doctor summary: All checks passed. NextPulse should be ready to use.
```

With issues detected:
```
[nextpulse] Running health checks...

[nextpulse] warn: nextpulse.config.json not found. Run "npx nextpulse init" to create it.
[nextpulse] ok: .nextpulse/metadata.json found
[nextpulse] warn: NextPulse is not injected into your app entry. Run "npx nextpulse init" or add it manually.
[nextpulse] error: No NextPulse API routes found. Run "npx nextpulse init" to generate them.
[nextpulse] ok: Diagnostics module is available

[nextpulse] doctor summary: One or more critical issues detected. Please fix the errors above and re-run "nextpulse doctor".
```

**When to use:**

- After running `nextpulse init` to confirm everything is set up correctly
- When troubleshooting installation issues
- Before opening a GitHub issue - run `nextpulse doctor` and include the output

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
- **Real-time updates via Server-Sent Events (SSE)** - Push-based updates with 97% less network traffic
- **Smart change detection** - Only broadcasts when data actually changes
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

### Real-Time Dashboard Updates

The dashboard uses **Server-Sent Events (SSE)** for efficient real-time updates:

**Performance Benefits:**
- ⚡ **100x faster updates** - ~10ms latency vs 1-2 second polling
- 📉 **97% less network traffic** - Only broadcasts when data changes
- 🔋 **Battery friendly** - No constant polling
- 🚀 **Instant updates** - See changes as they happen

**Technical Details:**
- Push-based updates via SSE streams (`/api/runtime/stream`, `/api/performance/stream`, `/api/errors/stream`)
- Smart change detection - only broadcasts actual changes
- Automatic reconnection with keep-alive pings
- Supports multiple concurrent dashboard clients

See [OPTIMIZATIONS.md](OPTIMIZATIONS.md) for detailed performance metrics and implementation details.

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
