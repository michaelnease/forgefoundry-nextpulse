## @forgefoundry/nextpulse

Dev overlay for Next.js that shows app name, Next version, port, git branch/sha. Ships a CLI that injects a dev-only component (no prod impact).

### Quickstart

```bash
npx @forgefoundry/nextpulse init
# or locally
pnpm dev
```

### What it does

- Detects App Router vs Pages Router
- Injects `<NextPulseDev />` into `app/layout.(t|j)sx` or `pages/_app.(t|j)sx`
- Renders only when `NODE_ENV === "development"`

### Config (`nextpulse.config.json`)

- `enabled: boolean` (default true)
- `overlayPosition: "bottomRight" | "bottomLeft" | "topRight" | "topLeft"`
- `openBrowserOnStart: boolean`

### Uninstall

- Remove `import { NextPulseDev } from "@forgefoundry/nextpulse/runtime"`
- Remove `<NextPulseDev />` from the root wrapper
- Delete `nextpulse.config.json`
