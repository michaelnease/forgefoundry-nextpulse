# @forged/nextpulse

Developer diagnostics and metadata tools for Next.js apps.

## Installation

```bash
npm install -g @forged/nextpulse
```

Or use with npx:

```bash
npx @forged/nextpulse init
```

## Commands

### `nextpulse init`

Inject NextPulseDev into a Next.js app for dev-only runtime visibility.

The init command:
- Detects your Next.js router type (App Router or Pages Router)
- Creates `components/nextpulse/NextPulseDev.tsx` (or `.jsx`)
- Patches your entry file (`app/layout.tsx` or `pages/_app.tsx`) to import and render the component
- Guards the component with `process.env.NODE_ENV === "development"` so it only runs in development
- Adds `NEXT_PUBLIC_NEXTPULSE_PORT=4000` to `.env.local` if not already set
- Is fully idempotent - safe to run multiple times

#### Options

- `--app <path>` - Path to Next.js app root (default: `.`)
- `--dry-run` - Print planned changes without writing
- `--revert` - Undo patches and remove NextPulseDev
- `--with-dev-script` - Add a dev script that runs nextpulse with next dev

#### Examples

Initialize in current directory:
```bash
npx nextpulse init
```

Initialize with custom app path:
```bash
npx nextpulse init --app ./my-next-app
```

Preview changes without writing:
```bash
npx nextpulse init --dry-run
```

Add concurrent dev script:
```bash
npx nextpulse init --with-dev-script
```

This modifies `package.json` to:
- Move existing `dev` script to `dev:next`
- Add `dev:pulse` script
- Update `dev` to run both concurrently

Undo the init:
```bash
npx nextpulse init --revert
```

## How it works

### NextPulseDev Component

The component fetches metadata from a local development server every 10 seconds:

```typescript
const port = process.env.NEXT_PUBLIC_NEXTPULSE_PORT || "4000";
const url = `http://127.0.0.1:${port}/api/meta`;
```

When metadata is available, it:
1. Dispatches a `nextpulse:meta` custom event with the metadata
2. Logs to console with `console.debug("[nextpulse] meta", meta)`

### Entry File Patching

**App Router** (`app/layout.tsx`):
```tsx
import NextPulseDev from "../components/nextpulse/NextPulseDev";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {process.env.NODE_ENV === "development" && <NextPulseDev />}
        {children}
      </body>
    </html>
  );
}
```

**Pages Router** (`pages/_app.tsx`):
```tsx
import NextPulseDev from "../components/nextpulse/NextPulseDev";

export default function App({ Component, pageProps }) {
  return (
    <>
      {process.env.NODE_ENV === "development" && <NextPulseDev />}
      <Component {...pageProps} />
    </>
  );
}
```

### Production Builds

The component is completely excluded from production builds because:
- The import and render are guarded by `process.env.NODE_ENV === "development"`
- The component itself returns `null` and only runs effects in development
- Next.js tree-shaking will remove it from production bundles

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development
npm run dev

# Run tests
npm test
```

## License

MIT
