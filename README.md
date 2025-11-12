# @forged/nextpulse

Developer diagnostics and metadata overlay for Next.js apps. Shows app name, Next.js version, port, git branch/sha in a dev-only corner widget. Includes a CLI to inject a safe overlay that never renders in production.

## Quick start

```bash
npx @forged/nextpulse init
# or, if you cloned locally:
pnpm dev  # during development
pnpm build && pnpm start  # after building
```

## What it does

- Detects App Router vs Pages Router
- Injects `<NextPulseDev />` into `app/layout.(t|j)sx` or `pages/_app.(t|j)sx`
- Renders only when `NODE_ENV === "development"`
- No production side effects

## Config

`nextpulse.config.json` (created on init)

- `enabled`: boolean (default true)
- `overlayPosition`: "bottomRight" | "bottomLeft" | "topRight" | "topLeft"
- `openBrowserOnStart`: boolean

## Remove / uninstall

1. Remove the `import { NextPulseDev } ...` line
2. Remove `<NextPulseDev />` from the root wrapper
3. Delete `nextpulse.config.json`

## License

MIT
