# Configuration Guide

Complete guide to configuring NextPulse for your Next.js application.

---

## Configuration File

NextPulse uses `nextpulse.config.json` for configuration. This file is optional - NextPulse works with sensible defaults out of the box.

### Location

```
your-nextjs-project/
├── app/ or pages/
├── package.json
└── nextpulse.config.json  ← Configuration file
```

### Creating the Config File

Create manually:

```bash
touch nextpulse.config.json
```

Or let `nextpulse init` create it:

```bash
nextpulse init
```

---

## Configuration Schema

```json
{
  "enabled": true,
  "overlayPosition": "bottomRight",
  "openBrowserOnStart": true
}
```

### Full Schema Reference

```typescript
interface NextPulseConfig {
  // Enable/disable NextPulse overlay
  enabled?: boolean;

  // Position of the overlay on screen
  overlayPosition?: "bottomRight" | "bottomLeft" | "topRight" | "topLeft";

  // Auto-open browser when running `nextpulse serve`
  openBrowserOnStart?: boolean;
}
```

---

## Options

### `enabled`

**Type**: `boolean`
**Default**: `true`
**Environment Variable**: `NEXTPULSE_ENABLED`

Enable or disable the NextPulse overlay.

```json
{
  "enabled": false
}
```

**Use Cases**:
- Temporarily disable NextPulse without removing it
- Disable for specific team members
- Disable during certain workflows (e.g., visual regression testing)

**Environment Variable Override**:

```bash
# Disable via environment variable
NEXTPULSE_ENABLED=false npm run dev

# Enable via environment variable (overrides config)
NEXTPULSE_ENABLED=true npm run dev
```

---

### `overlayPosition`

**Type**: `"bottomRight" | "bottomLeft" | "topRight" | "topLeft"`
**Default**: `"bottomRight"`

Control where the NextPulse overlay appears on screen.

```json
{
  "overlayPosition": "topLeft"
}
```

**Options**:

| Value | Position | CSS Equivalent |
|-------|----------|----------------|
| `"bottomRight"` | Bottom-right corner | `bottom: 20px; right: 20px` |
| `"bottomLeft"` | Bottom-left corner | `bottom: 20px; left: 20px` |
| `"topRight"` | Top-right corner | `top: 20px; right: 20px` |
| `"topLeft"` | Top-left corner | `top: 20px; left: 20px` |

**Use Cases**:
- Avoid conflicts with other overlays/toolbars
- Match your app's layout
- Personal preference

**Visual Guide**:

```
┌─────────────────────────────┐
│ topLeft        topRight     │
│                             │
│                             │
│                             │
│                             │
│ bottomLeft  bottomRight     │
└─────────────────────────────┘
```

---

### `openBrowserOnStart`

**Type**: `boolean`
**Default**: `true`

Auto-open browser when running `nextpulse serve`.

```json
{
  "openBrowserOnStart": false
}
```

**Use Cases**:
- Running in headless environments (CI/CD, Docker)
- Running multiple servers
- Using a custom browser opening mechanism

**Command-Line Override**:

```bash
# Disable auto-open (overrides config)
nextpulse serve --no-open

# Port option works with auto-open
nextpulse serve --port 5000  # Opens http://localhost:5000
```

---

## Configuration Examples

### Minimal Config (Defaults)

```json
{
  "enabled": true,
  "overlayPosition": "bottomRight",
  "openBrowserOnStart": true
}
```

### Disabled Overlay

```json
{
  "enabled": false
}
```

### Custom Position

```json
{
  "enabled": true,
  "overlayPosition": "topLeft"
}
```

### CI/CD Friendly

```json
{
  "enabled": true,
  "openBrowserOnStart": false
}
```

### Full Configuration

```json
{
  "enabled": true,
  "overlayPosition": "bottomRight",
  "openBrowserOnStart": true
}
```

---

## Environment Variables

NextPulse supports environment variables for runtime configuration.

### `NODE_ENV`

**Required for operation**: Must be `development`

NextPulse **only runs in development mode**:

```bash
NODE_ENV=development npm run dev  # ✅ NextPulse runs
NODE_ENV=production npm run build # ❌ NextPulse disabled
```

### `NEXTPULSE_ENABLED`

Override `enabled` config option:

```bash
# Disable NextPulse (overrides config)
NEXTPULSE_ENABLED=false npm run dev

# Enable NextPulse (overrides config)
NEXTPULSE_ENABLED=true npm run dev
```

### `NEXTPULSE_PORT`

Override default dashboard port (4337):

```bash
# Start dashboard on port 5000
NEXTPULSE_PORT=5000 nextpulse serve
```

### `PORT`

Next.js dev server port (read by NextPulse):

```bash
# Next.js will run on 3001
PORT=3001 npm run dev
```

NextPulse will detect this and show the correct port in the overlay.

---

## Configuration Loading

NextPulse loads configuration in the following order (later overrides earlier):

1. **Default values** (hardcoded)
2. **Config file** (`nextpulse.config.json`)
3. **Environment variables** (e.g., `NEXTPULSE_ENABLED`)
4. **Command-line flags** (e.g., `--no-open`)

### Example

Given this config:

```json
{
  "enabled": true,
  "openBrowserOnStart": true
}
```

Running this command:

```bash
NEXTPULSE_ENABLED=false nextpulse serve --no-open
```

Results in:

```json
{
  "enabled": false,           // ← From environment variable
  "openBrowserOnStart": false // ← From CLI flag
}
```

---

## Validation

NextPulse validates configuration using Zod schemas:

```typescript
import { z } from 'zod';

const configSchema = z.object({
  enabled: z.boolean().optional(),
  overlayPosition: z
    .enum(['bottomRight', 'bottomLeft', 'topRight', 'topLeft'])
    .optional(),
  openBrowserOnStart: z.boolean().optional(),
});
```

### Invalid Configuration

If `nextpulse.config.json` is invalid, NextPulse will:

1. **Log a warning**:
   ```
   [nextpulse] Warning: Invalid config file, using defaults
   ```

2. **Fall back to defaults**:
   ```json
   {
     "enabled": true,
     "overlayPosition": "bottomRight",
     "openBrowserOnStart": true
   }
   ```

### Common Validation Errors

```json
{
  "overlayPosition": "middle"  // ❌ Invalid: not a valid position
}
```

Error:
```
[nextpulse] Invalid overlayPosition: must be one of bottomRight, bottomLeft, topRight, topLeft
```

```json
{
  "enabled": "yes"  // ❌ Invalid: must be boolean
}
```

Error:
```
[nextpulse] Invalid enabled: expected boolean, received string
```

---

## Team Configuration

### Version Control

**Recommendation**: Commit `nextpulse.config.json` to version control

```gitignore
# .gitignore
# ✅ Commit config (recommended)
# nextpulse.config.json

# ❌ Don't commit snapshots
.nextpulse/snapshot-*.json
```

**Why commit**:
- Consistent team settings
- Avoid conflicts with other tools
- Document overlay position preference

### Per-Developer Override

Developers can override team config using environment variables:

```bash
# .env.local (not committed)
NEXTPULSE_ENABLED=false
```

Or in their shell:

```bash
# ~/.zshrc or ~/.bashrc
export NEXTPULSE_ENABLED=false
```

---

## Advanced Configuration

### Programmatic Configuration

You can read/modify config programmatically:

```typescript
import { readConfig, writeConfig } from '@forgefoundry/nextpulse';

// Read current config
const config = readConfig(process.cwd());
console.log(config.overlayPosition); // 'bottomRight'

// Modify config
writeConfig(process.cwd(), {
  ...config,
  overlayPosition: 'topLeft',
});
```

### Conditional Configuration

Use different configs for different environments:

```json
{
  "enabled": true,
  "overlayPosition": "bottomRight",
  "openBrowserOnStart": false  // ← CI-friendly
}
```

Then in package.json:

```json
{
  "scripts": {
    "dev": "next dev",
    "dev:ci": "NEXTPULSE_ENABLED=false next dev"
  }
}
```

---

## Configuration Best Practices

### 1. Use Defaults When Possible

Only configure what you need:

```json
{
  "overlayPosition": "topLeft"  // Only override position
}
```

Instead of:

```json
{
  "enabled": true,              // Unnecessary (default)
  "overlayPosition": "topLeft",
  "openBrowserOnStart": true    // Unnecessary (default)
}
```

### 2. Document Custom Settings

Add comments (in package.json or docs):

```json
// nextpulse.config.json
{
  // Moved to top-left to avoid conflict with Vercel toolbar
  "overlayPosition": "topLeft"
}
```

### 3. Use Environment Variables for CI/CD

```yaml
# .github/workflows/test.yml
- name: Run tests
  env:
    NEXTPULSE_ENABLED: false
  run: npm test
```

### 4. Keep Config Minimal

Only include non-default values to reduce noise.

---

## Troubleshooting Configuration

### Config Not Loading

**Symptom**: Changes to `nextpulse.config.json` aren't applied

**Solution**:
1. Restart Next.js dev server
2. Clear Next.js cache: `rm -rf .next`
3. Verify JSON syntax: `cat nextpulse.config.json | jq .`

### Overlay Not Showing

**Symptom**: Overlay doesn't appear despite `enabled: true`

**Checklist**:
1. ✅ `NODE_ENV === 'development'`
2. ✅ `<NextPulse />` component is in layout/app
3. ✅ Config file is valid JSON
4. ✅ No environment variable override (`NEXTPULSE_ENABLED=false`)

### Wrong Overlay Position

**Symptom**: Overlay appears in wrong location

**Solution**:
```json
{
  "overlayPosition": "bottomRight"  // Check spelling/case
}
```

Valid values: `bottomRight`, `bottomLeft`, `topRight`, `topLeft`

---

## Configuration API

### `readConfig(projectRoot: string)`

Read configuration from `nextpulse.config.json`:

```typescript
import { readConfig } from '@forgefoundry/nextpulse';

const config = readConfig('/path/to/project');
// Returns: { enabled: true, overlayPosition: 'bottomRight', ... }
```

### `writeConfig(projectRoot: string, config: Config)`

Write configuration to `nextpulse.config.json`:

```typescript
import { writeConfig } from '@forgefoundry/nextpulse';

writeConfig('/path/to/project', {
  enabled: false,
  overlayPosition: 'topLeft',
});
```

---

See also:
- [Commands Reference](commands.md)
- [Installation Guide](installation.md)
- [Troubleshooting](troubleshooting.md)
