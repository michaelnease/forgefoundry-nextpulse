# Troubleshooting Guide

Common issues and solutions when using NextPulse.

---

## Table of Contents

- [Installation Issues](#installation-issues)
- [Overlay Issues](#overlay-issues)
- [Dashboard Issues](#dashboard-issues)
- [Performance Issues](#performance-issues)
- [Build & TypeScript Issues](#build--typescript-issues)
- [Compatibility Issues](#compatibility-issues)

---

## Installation Issues

### "Could not detect Next.js project"

**Symptom**: `nextpulse init` fails with "Could not detect Next.js project"

**Cause**: Running the command outside a Next.js project root

**Solution**:
1. Navigate to your Next.js project root:
   ```bash
   cd path/to/your-nextjs-project
   ```

2. Verify you're in the right directory:
   ```bash
   ls -la package.json  # Should exist
   ls -la app/          # App Router
   # OR
   ls -la pages/        # Pages Router
   ```

3. Run `nextpulse init` again

---

### "No layout.tsx or _app.tsx found"

**Symptom**: Init fails because entry file is missing

**Cause**: Missing root layout (App Router) or _app (Pages Router)

**Solution**:

**For App Router**, create `app/layout.tsx`:
```typescript
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

**For Pages Router**, create `pages/_app.tsx`:
```typescript
import type { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
```

Then run `nextpulse init` again.

---

### "Permission denied" errors

**Symptom**: Cannot write files during `nextpulse init`

**Cause**: Insufficient file permissions

**Solution**:
1. Check directory permissions:
   ```bash
   ls -la
   ```

2. Fix permissions (if needed):
   ```bash
   chmod -R u+w .
   ```

3. Avoid using `sudo` (can cause ownership issues)

---

### Module resolution errors after installation

**Symptom**: TypeScript errors like "Cannot find module '@forgefoundry/nextpulse'"

**Cause**: Missing or stale type definitions

**Solution**:
1. Reinstall dependencies:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. Restart TypeScript server (VS Code):
   - `Cmd/Ctrl + Shift + P`
   - "TypeScript: Restart TS Server"

3. Ensure TypeScript is installed:
   ```bash
   npm install --save-dev typescript @types/react @types/node
   ```

---

## Overlay Issues

### Overlay not showing

**Symptom**: NextPulse overlay doesn't appear in the browser

**Checklist**:

1. **Verify development mode**:
   ```bash
   echo $NODE_ENV  # Should be "development" or empty
   ```

2. **Check component is injected**:
   ```typescript
   // app/layout.tsx or pages/_app.tsx should have:
   import { NextPulse } from "@forgefoundry/nextpulse";
   <NextPulse />
   ```

3. **Check configuration**:
   ```json
   // nextpulse.config.json
   {
     "enabled": true  // Make sure it's not disabled
   }
   ```

4. **Check environment variable override**:
   ```bash
   # Don't have this set:
   export NEXTPULSE_ENABLED=false
   ```

5. **Check browser console**:
   Open DevTools (F12) and look for errors

6. **Restart dev server**:
   ```bash
   # Stop current server (Ctrl + C)
   npm run dev
   ```

---

### Overlay appears but shows no data

**Symptom**: Overlay shows but metadata is missing or placeholder values

**Cause**: API routes not created or not accessible

**Solution**:

1. **Verify API routes exist**:
   ```bash
   # App Router
   ls -la app/api/nextpulse/metadata/route.ts
   ls -la app/api/nextpulse/config/route.ts

   # Pages Router
   ls -la pages/api/nextpulse/metadata.ts
   ls -la pages/api/nextpulse/config.ts
   ```

2. **Test API endpoints directly**:
   ```bash
   curl http://localhost:3000/api/nextpulse/metadata
   curl http://localhost:3000/api/nextpulse/config
   ```

3. **Recreate API routes**:
   ```bash
   nextpulse init --force
   ```

4. **Check .nextpulse/metadata.json**:
   ```bash
   cat .nextpulse/metadata.json
   ```

   Should contain valid JSON with app metadata.

---

### Overlay in wrong position

**Symptom**: Overlay appears in unexpected location

**Solution**:

Check `nextpulse.config.json`:
```json
{
  "overlayPosition": "bottomRight"  // Valid: bottomRight, bottomLeft, topRight, topLeft
}
```

Valid positions:
- `"bottomRight"` - Bottom-right corner (default)
- `"bottomLeft"` - Bottom-left corner
- `"topRight"` - Top-right corner
- `"topLeft"` - Top-left corner

Restart dev server after changing config.

---

### Overlay conflicts with other tools

**Symptom**: Overlay overlaps with Vercel toolbar, error overlays, etc.

**Solution**:

Change overlay position:
```json
{
  "overlayPosition": "topLeft"  // Move to different corner
}
```

Or increase z-index in custom CSS:
```css
/* global.css */
[data-nextpulse-overlay] {
  z-index: 99999 !important;
}
```

---

## Dashboard Issues

### Dashboard shows 404

**Symptom**: `nextpulse serve` starts but http://localhost:4337 shows 404

**Cause**: Dashboard server not running or port conflict

**Solution**:

1. **Verify server is running**:
   ```bash
   nextpulse serve
   # Should see: "Dashboard server running at http://localhost:4337"
   ```

2. **Check port is not in use**:
   ```bash
   lsof -i :4337  # macOS/Linux
   netstat -ano | findstr :4337  # Windows
   ```

3. **Try different port**:
   ```bash
   nextpulse serve --port 5000
   ```

4. **Check firewall settings** (may block localhost connections)

---

### Dashboard shows no routes

**Symptom**: Routes tab is empty

**Cause**: `app/` or `pages/` directory not found

**Solution**:

1. **Verify directory exists**:
   ```bash
   ls -la app/  # App Router
   ls -la pages/  # Pages Router
   ```

2. **Specify correct path**:
   ```bash
   nextpulse serve --path ./apps/web  # If in monorepo
   ```

3. **Check file permissions**:
   ```bash
   chmod -R u+r app/  # Ensure readable
   ```

---

### Dashboard shows no bundles

**Symptom**: Bundles tab shows "No bundle data available"

**Cause**: `.next/` directory doesn't exist or build hasn't run

**Solution**:

1. **Build the app first**:
   ```bash
   npm run build
   ```

2. **Verify .next/ exists**:
   ```bash
   ls -la .next/
   ```

3. **Run dev server** (dev builds also create bundles):
   ```bash
   npm run dev
   ```

---

### Dashboard doesn't auto-open browser

**Symptom**: `nextpulse serve` starts but browser doesn't open

**Cause**: `openBrowserOnStart` is disabled or running in headless environment

**Solution**:

1. **Check configuration**:
   ```json
   {
     "openBrowserOnStart": true
   }
   ```

2. **Manually open browser**:
   ```bash
   open http://localhost:4337  # macOS
   xdg-open http://localhost:4337  # Linux
   start http://localhost:4337  # Windows
   ```

3. **Use `--no-open` flag if intentional**:
   ```bash
   nextpulse serve --no-open  # Disable auto-open
   ```

---

## Performance Issues

### High memory usage

**Symptom**: Node.js process using excessive memory

**Cause**: Too many sessions or errors stored in memory

**Solution**:

NextPulse caps storage by default:
- **Sessions**: Max 50 (configurable in code)
- **Errors**: Max 100
- **Logs**: Max 200

If still experiencing issues:

1. **Restart dev server** periodically
2. **Clear errors programmatically**:
   ```typescript
   import { clearErrorsAndLogs } from '@forgefoundry/nextpulse';
   clearErrorsAndLogs();
   ```

3. **Disable NextPulse temporarily**:
   ```bash
   NEXTPULSE_ENABLED=false npm run dev
   ```

---

### Slow page loads

**Symptom**: Pages load slower with NextPulse enabled

**Cause**: Instrumentation overhead (usually <5%)

**Solution**:

1. **Verify it's actually NextPulse**:
   ```bash
   # Test without NextPulse
   NEXTPULSE_ENABLED=false npm run dev
   ```

2. **Check for other issues**:
   - Slow API calls
   - Large components
   - Database queries

3. **Review performance timeline** in dashboard:
   ```bash
   nextpulse serve
   # Check Performance tab for bottlenecks
   ```

---

### Dashboard polling causes network spam

**Symptom**: Network tab shows many requests to `/api/nextpulse/*`

**Cause**: Panel polls every 2 seconds by default

**Solution**:

This is expected behavior. If it's an issue:

1. **Close the panel** when not needed (click anvil button)
2. **Disable overlay**:
   ```json
   {
     "enabled": false
   }
   ```
3. **Use dashboard instead** (less polling):
   ```bash
   nextpulse serve
   ```

---

## Build & TypeScript Issues

### Build fails with NextPulse imported

**Symptom**: `npm run build` fails with NextPulse-related errors

**Cause**: NextPulse code being included in production build

**Solution**:

This should never happen (NextPulse is development-only). If it does:

1. **Verify NODE_ENV**:
   ```bash
   NODE_ENV=production npm run build
   ```

2. **Check for forced imports**:
   ```typescript
   // ❌ Don't do this
   import { NextPulse } from '@forgefoundry/nextpulse';

   // ✅ Do this (if manually importing)
   const NextPulse = process.env.NODE_ENV === 'development'
     ? require('@forgefoundry/nextpulse').NextPulse
     : null;
   ```

3. **Clear Next.js cache**:
   ```bash
   rm -rf .next
   npm run build
   ```

---

### TypeScript errors in API routes

**Symptom**: Type errors in generated API routes

**Cause**: Missing or incompatible type definitions

**Solution**:

1. **Update Next.js types**:
   ```bash
   npm install --save-dev @types/react @types/node
   ```

2. **Regenerate API routes**:
   ```bash
   nextpulse init --force
   ```

3. **Check TypeScript version**:
   ```bash
   npx tsc --version  # Should be 5.0+
   ```

---

### "Cannot find module" errors

**Symptom**: Import errors for NextPulse modules

**Cause**: Incorrect import paths or module resolution

**Solution**:

1. **Use correct imports**:
   ```typescript
   // ✅ Correct
   import { NextPulse } from '@forgefoundry/nextpulse';

   // ❌ Wrong
   import { NextPulse } from '@forgefoundry/nextpulse/runtime';
   ```

2. **Check package.json exports**:
   ```json
   {
     "exports": {
       ".": "./dist/runtime/index.js",
       "./runtime": "./dist/runtime/index.js"
     }
   }
   ```

3. **Clear module cache**:
   ```bash
   rm -rf node_modules/.cache
   ```

---

## Compatibility Issues

### Works in App Router but not Pages Router

**Symptom**: NextPulse works in App Router projects but fails in Pages Router

**Cause**: Different API route structure

**Solution**:

Verify API routes are in correct location:

**App Router**: `app/api/nextpulse/*/route.ts`
**Pages Router**: `pages/api/nextpulse/*.ts`

Run `nextpulse init --force` to regenerate.

---

### Conflicts with other dev tools

**Symptom**: NextPulse conflicts with Sentry, LogRocket, etc.

**Cause**: Multiple tools patching the same globals (console, fetch)

**Solution**:

1. **Load NextPulse last** (in your component tree)
2. **Disable client error hooks** if needed:
   ```typescript
   // In src/instrumentation/clientErrorHooks.ts
   // Comment out initializeClientErrorHooks() call
   ```

3. **Check console for warnings**

---

### Doesn't work in Docker

**Symptom**: NextPulse overlay doesn't appear when running in Docker

**Cause**: NODE_ENV not set or wrong directory

**Solution**:

1. **Set NODE_ENV in Dockerfile**:
   ```dockerfile
   ENV NODE_ENV=development
   ```

2. **Mount volume for live updates**:
   ```yaml
   # docker-compose.yml
   volumes:
     - .:/app
     - /app/node_modules
   ```

3. **Run init inside container**:
   ```dockerfile
   RUN npx @forgefoundry/nextpulse init --force
   ```

---

### Git info not showing

**Symptom**: Git branch/SHA shows as "unknown"

**Cause**: `.git` directory not accessible

**Solution**:

1. **Verify .git exists**:
   ```bash
   ls -la .git
   ```

2. **Initialize git** if needed:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

3. **Check file permissions**:
   ```bash
   chmod -R u+r .git
   ```

---

## Getting Help

If none of these solutions work:

1. **Check GitHub issues**: https://github.com/michaelnease/nextforge/issues
2. **Create a new issue** with:
   - NextPulse version (`nextpulse --version`)
   - Next.js version
   - Node.js version (`node --version`)
   - OS and environment
   - Steps to reproduce
   - Error messages and logs

3. **Generate diagnostic snapshot**:
   ```bash
   nextpulse snapshot > debug-snapshot.json
   ```
   Attach to your issue.

---

## Debug Mode

Enable verbose logging:

```bash
# Set debug environment variable
DEBUG=nextpulse:* npm run dev

# Or in Next.js
NODE_OPTIONS='--inspect' npm run dev
```

---

See also:
- [Installation Guide](installation.md)
- [Configuration](configuration.md)
- [API Reference](api-reference.md)
