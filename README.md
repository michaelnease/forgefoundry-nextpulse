# @forged/nextpulse

Developer diagnostics and metadata overlay for Next.js apps. Shows app information, framework version, git branch, and more in a dev-only corner widget.

## Quick Start

### Installation

**Recommended:** Use npx (no installation needed):

```bash
npx @forged/nextpulse init
```

**Optional:** Install globally for a `nextpulse` command:

```bash
npm install -g @forged/nextpulse
```

### Initialize

Run the init command in your Next.js project root:

```bash
# With npx (recommended)
npx @forged/nextpulse init

# Or if installed globally
nextpulse init
```

This will:
- Detect your router type (App Router or Pages Router)
- Inject `NextPulseDev` component into your entry file (`app/layout.tsx` or `pages/_app.tsx`)
- Create `nextpulse.config.json` with default settings
- Make the component dev-only (only renders when `NODE_ENV === "development"`)

### Options

```bash
# Specify custom app path
nextpulse init --path ./my-app

# Suppress prompts (useful for monorepos)
nextpulse init --yes
```

## Configuration

The init command creates `nextpulse.config.json` in your project root:

```json
{
  "enabled": true,
  "overlayPosition": "bottomRight",
  "openBrowserOnStart": false
}
```

### Environment Variable

You can disable NextPulse via environment variable:

```bash
NEXTPULSE_ENABLED=0 npm run dev
```

## How It Works

### Dev-Only Behavior

The `NextPulseDev` component is only rendered in development:

```tsx
{process.env.NODE_ENV === "development" && <NextPulseDev />}
```

In production builds, the component is completely excluded (tree-shaken) and has no impact on bundle size.

### What It Shows

The overlay widget displays:
- App name (from `package.json`)
- Next.js version
- Current port
- Git branch
- Git short SHA

All information is gathered locally - no network calls are made.

## Router Support

### App Router

For App Router projects, the component is injected into `app/layout.tsx` (or `app/layout.ts`):

```tsx
import { NextPulseDev } from "@forged/nextpulse/runtime";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        {process.env.NODE_ENV === "development" && <NextPulseDev />}
      </body>
    </html>
  );
}
```

### Pages Router

For Pages Router projects, the component is injected into `pages/_app.tsx`:

```tsx
import { NextPulseDev } from "@forged/nextpulse/runtime";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      {process.env.NODE_ENV === "development" && <NextPulseDev />}
    </>
  );
}
```

## Monorepo Support

If multiple Next.js apps are detected (in `apps/*` or `packages/*`), you'll be prompted to select which app to initialize:

```bash
[nextpulse] Multiple Next.js apps found:
  1. apps/web
  2. apps/admin
  3. packages/ui

Select app (1-3):
```

Use `--yes` to automatically select the first app without prompting.

## Removing NextPulse

To remove NextPulse from your project:

1. Remove the import and component from your entry file (`app/layout.tsx` or `pages/_app.tsx`)
2. Delete `nextpulse.config.json` (optional)
3. Uninstall the package: `npm uninstall @forged/nextpulse`

The init command is idempotent - running it multiple times won't duplicate imports or components.

## Development

```bash
# Build
npm run build

# Run tests
npm test

# Development mode
npm run dev
```

## License

MIT
