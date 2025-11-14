# Installation Guide

Complete guide to installing and setting up NextPulse in your Next.js project.

---

## Prerequisites

Before installing NextPulse, ensure you have:

- **Next.js** 13.4 or higher (App Router or Pages Router)
- **Node.js** 18.17 or higher
- **React** 18.0+ or 19.0+
- **npm**, **pnpm**, or **yarn** package manager

---

## Installation Methods

### Method 1: Using npx (Recommended)

The quickest way to get started - no installation required:

```bash
cd your-nextjs-project
npx @forgefoundry/nextpulse init
```

This will:
1. Auto-detect your router type (App Router vs Pages Router)
2. Generate necessary files and API routes
3. Inject the NextPulse component automatically

### Method 2: Global Installation

Install NextPulse globally for use across multiple projects:

```bash
npm install -g @forgefoundry/nextpulse
cd your-nextjs-project
nextpulse init
```

### Method 3: Local Project Dependency

Add NextPulse as a dev dependency:

```bash
npm install --save-dev @forgefoundry/nextpulse
npx nextpulse init
```

Or with pnpm:

```bash
pnpm add -D @forgefoundry/nextpulse
pnpm nextpulse init
```

Or with yarn:

```bash
yarn add -D @forgefoundry/nextpulse
yarn nextpulse init
```

---

## What `nextpulse init` Does

When you run `nextpulse init`, the following happens:

### 1. Project Detection

NextPulse automatically detects your project structure:
- App Router (`app/` directory) vs Pages Router (`pages/` directory)
- TypeScript (`.tsx`, `.ts`) vs JavaScript (`.jsx`, `.js`)
- Monorepo support (scans `apps/` and `packages/` directories)

### 2. File Generation

Creates the following files:

#### `.nextpulse/metadata.json`
```json
{
  "appName": "your-app-name",
  "nextVersion": "14.0.0",
  "gitBranch": "main",
  "gitSha": "abc1234",
  "gitDirty": false,
  "port": "3000"
}
```

#### API Routes

**App Router**: Creates routes in `app/api/nextpulse/`
- `app/api/nextpulse/metadata/route.ts`
- `app/api/nextpulse/config/route.ts`
- `app/api/nextpulse/runtime/route.ts` (if instrumentation is enabled)
- `app/api/nextpulse/errors/route.ts` (if error tracking is enabled)

**Pages Router**: Creates routes in `pages/api/nextpulse/`
- `pages/api/nextpulse/metadata.ts`
- `pages/api/nextpulse/config.ts`
- `pages/api/nextpulse/runtime.ts` (if instrumentation is enabled)
- `pages/api/nextpulse/errors.ts` (if error tracking is enabled)

#### Configuration (Optional)

Creates `nextpulse.config.json`:
```json
{
  "enabled": true,
  "overlayPosition": "bottomRight",
  "openBrowserOnStart": true
}
```

### 3. Code Injection

Injects the NextPulse component using AST-based transformation:

**App Router** (`app/layout.tsx`):
```tsx
import { NextPulse } from "@forgefoundry/nextpulse";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <NextPulse />
        {children}
      </body>
    </html>
  );
}
```

**Pages Router** (`pages/_app.tsx`):
```tsx
import { NextPulse } from "@forgefoundry/nextpulse";

export default function App({ Component, pageProps }) {
  return (
    <>
      <NextPulse />
      <Component {...pageProps} />
    </>
  );
}
```

---

## Installation Options

### `--dry-run`

Preview changes without writing files:

```bash
nextpulse init --dry-run
```

Output:
```
[dry-run] created app/api/nextpulse/metadata/route.ts
[dry-run] created app/api/nextpulse/config/route.ts
[dry-run] patched app/layout.tsx
```

### `--app <path>`

Specify custom app directory:

```bash
nextpulse init --app ./apps/web
```

### `--force`

Overwrite existing files:

```bash
nextpulse init --force
```

### `--with-dev-script`

Update `package.json` dev script:

```bash
nextpulse init --with-dev-script
```

This modifies your `package.json`:
```json
{
  "scripts": {
    "dev": "concurrently \"next dev\" \"nextpulse serve\""
  }
}
```

---

## Post-Installation

### 1. Verify Installation

Check that files were created:

```bash
# App Router
ls -la app/api/nextpulse/
ls -la .nextpulse/

# Pages Router
ls -la pages/api/nextpulse/
ls -la .nextpulse/
```

### 2. Start Development Server

```bash
npm run dev
```

You should see the NextPulse overlay in the bottom-right corner.

### 3. Open Dashboard (Optional)

```bash
nextpulse serve
```

Opens http://localhost:4337 with the full dashboard.

---

## Monorepo Setup

NextPulse supports monorepos with multiple Next.js apps.

### Turborepo Example

```bash
# Install in specific workspace
cd apps/web
npx @forgefoundry/nextpulse init

# Or from root with --app flag
npx @forgefoundry/nextpulse init --app apps/web
```

### Nx Example

```bash
# Navigate to Next.js app
cd apps/web-app
npx @forgefoundry/nextpulse init
```

---

## Docker Setup

When using Docker, ensure NextPulse is installed during the build:

### Dockerfile Example

```dockerfile
FROM node:18-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Development image
FROM base AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx @forgefoundry/nextpulse init --force
CMD ["npm", "run", "dev"]
```

Or use a volume mount to persist `.nextpulse/`:

```yaml
# docker-compose.yml
version: '3.8'
services:
  web:
    build: .
    volumes:
      - .:/app
      - /app/node_modules
    ports:
      - "3000:3000"
      - "4337:4337"  # NextPulse dashboard
```

---

## Vercel Deployment

NextPulse is development-only and won't affect production builds on Vercel.

No special configuration needed - just deploy normally:

```bash
vercel deploy
```

NextPulse components will be tree-shaken out in production builds.

---

## Next Steps

After installation:

1. [Configure NextPulse](configuration.md) - Customize overlay position and settings
2. [Learn Commands](commands.md) - Explore all available commands
3. [View Dashboard](../README.md#view-dashboard) - Start the dashboard server
4. [Read Architecture](architecture.md) - Understand how NextPulse works

---

## Troubleshooting Installation

### Error: "Could not detect Next.js project"

**Cause**: Running `nextpulse init` outside a Next.js project.

**Solution**: Navigate to your Next.js project root:
```bash
cd path/to/nextjs-project
nextpulse init
```

### Error: "No layout.tsx or _app.tsx found"

**Cause**: Missing root layout/app file.

**Solution**: Create the file manually:

**App Router**:
```bash
mkdir -p app
touch app/layout.tsx
```

**Pages Router**:
```bash
mkdir -p pages
touch pages/_app.tsx
```

### Error: "Permission denied"

**Cause**: Insufficient permissions to write files.

**Solution**: Run with appropriate permissions or use `sudo` (not recommended):
```bash
# Better: fix directory permissions
chmod -R u+w .

# Or run with sudo (not recommended)
sudo nextpulse init
```

### Module resolution errors

**Cause**: Missing TypeScript or React types.

**Solution**: Install required types:
```bash
npm install --save-dev @types/react @types/node typescript
```

---

See [troubleshooting.md](troubleshooting.md) for more help.
