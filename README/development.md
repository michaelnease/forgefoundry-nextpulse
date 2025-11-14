# Development Guide

Complete guide for developing and extending NextPulse.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Build System](#build-system)
- [Testing Strategy](#testing-strategy)
- [Debugging](#debugging)
- [Adding Features](#adding-features)
- [Best Practices](#best-practices)

---

## Getting Started

### Prerequisites

- **Node.js** 18.17+
- **npm** or **pnpm**
- **TypeScript** 5.0+
- **Git**
- Next.js project for testing

### Initial Setup

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

# Link for local development
npm link
```

### Development Workflow

```bash
# 1. Make changes in src/
# 2. Build
npm run build

# 3. Test in a Next.js project
cd your-nextjs-project
npm link @forgefoundry/nextpulse
nextpulse init
npm run dev

# 4. Run tests
npm test
```

---

## Project Structure

```
nextpulse/
├── src/                    # Source code
│   ├── cli/               # CLI entry point
│   │   └── index.ts       # Commander setup
│   ├── commands/          # Command implementations
│   │   └── init.ts        # Init command
│   ├── instrumentation/   # Runtime tracking
│   │   ├── sessions.ts    # Session management
│   │   ├── errors.ts      # Error tracking
│   │   ├── instrumentFetch.ts
│   │   ├── instrumentServerActions.ts
│   │   ├── instrumentRSC.ts
│   │   └── timeline.ts    # Performance analysis
│   ├── runtime/           # React components
│   │   ├── NextPulse.tsx  # Main component
│   │   ├── Panel.tsx      # Diagnostic panel
│   │   └── StatusIcon.tsx
│   ├── server/            # Dashboard server
│   │   ├── startServer.ts # HTTP server
│   │   ├── routesScanner.ts
│   │   ├── bundleScanner.ts
│   │   └── snapshot.ts
│   ├── types/             # TypeScript types
│   │   ├── runtime.ts
│   │   ├── errors.ts
│   │   └── snapshot.ts
│   └── utils/             # Helper functions
│       ├── injection.ts   # Code injection
│       ├── projectDetect.ts
│       ├── config.ts
│       └── ast.ts
├── tests/                 # Test files
│   ├── integration/       # Integration tests
│   └── *.test.ts         # Unit tests
├── dist/                  # Build output
├── README/                # Documentation
├── package.json
└── tsconfig.json
```

---

## Build System

### TypeScript Configuration

**tsconfig.json**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

### Build Process

```bash
# Standard build
npm run build

# Watch mode
npx tsc -p tsconfig.json --watch

# Clean build
rm -rf dist && npm run build
```

**Build output**:
```
dist/
├── cli/
│   └── index.js         # CLI entry (#!/usr/bin/env node)
├── runtime/
│   ├── index.js         # Main export
│   ├── NextPulse.js
│   └── Panel.js
├── instrumentation/
├── server/
├── types/
│   └── *.d.ts           # Type declarations
└── utils/
```

### Package.json Configuration

**Key fields**:
```json
{
  "name": "@forgefoundry/nextpulse",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "nextpulse": "dist/cli/index.js"
  },
  "main": "./dist/runtime/index.js",
  "types": "./dist/runtime/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/runtime/index.d.ts",
      "import": "./dist/runtime/index.js"
    },
    "./runtime": {
      "types": "./dist/runtime/index.d.ts",
      "import": "./dist/runtime/index.js"
    }
  }
}
```

---

## Testing Strategy

### Test Framework

NextPulse uses **Vitest** for testing.

### Running Tests

```bash
# All tests
npm test

# Specific file
npm test -- tests/errors.test.ts

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

### Test Categories

#### 1. Unit Tests

Test individual functions in isolation:

```typescript
// tests/errors.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { recordError, clearErrorsAndLogs } from '../src/instrumentation/errors';

describe('recordError', () => {
  beforeEach(() => {
    clearErrorsAndLogs();
  });

  it('should generate unique error ID', () => {
    const error1 = recordError({
      route: '/test',
      source: 'client',
      message: 'Error 1',
      severity: 'error',
    });

    const error2 = recordError({
      route: '/test',
      source: 'client',
      message: 'Error 2',
      severity: 'error',
    });

    expect(error1.id).not.toBe(error2.id);
  });
});
```

#### 2. Integration Tests

Test full command workflows:

```typescript
// tests/integration/init.test.ts
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, readFileSync } from 'fs';

describe('nextpulse init', () => {
  it('should create files in app router project', () => {
    const tempDir = mkdtempSync('/tmp/nextpulse-test-');

    // Create minimal Next.js project
    // ...

    // Run init
    execSync('npx nextpulse init', { cwd: tempDir });

    // Verify files
    expect(existsSync(`${tempDir}/app/api/nextpulse/metadata/route.ts`)).toBe(true);
  });
});
```

#### 3. Fixtures

Use test fixtures for consistent testing:

```
tests/
├── fixtures/
│   ├── app-router/
│   │   ├── app/
│   │   │   └── layout.tsx
│   │   └── package.json
│   └── pages-router/
│       ├── pages/
│       │   └── _app.tsx
│       └── package.json
```

### Writing Tests

**Test structure**:
```typescript
describe('feature name', () => {
  beforeEach(() => {
    // Setup before each test
  });

  it('should do something specific', () => {
    // Arrange
    const input = createTestData();

    // Act
    const result = functionUnderTest(input);

    // Assert
    expect(result).toBe(expected);
  });

  afterEach(() => {
    // Cleanup after each test
  });
});
```

**Assertions**:
```typescript
// Equality
expect(value).toBe(5);
expect(object).toEqual({ key: 'value' });

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();

// Numbers
expect(value).toBeGreaterThan(10);
expect(value).toBeLessThan(20);

// Strings
expect(str).toMatch(/pattern/);
expect(str).toContain('substring');

// Arrays
expect(array).toHaveLength(3);
expect(array).toContain(item);

// Objects
expect(obj).toHaveProperty('key');
expect(obj).toMatchObject({ subset });
```

---

## Debugging

### VS Code Debugging

**.vscode/launch.json**:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["test", "--", "--run"],
      "console": "integratedTerminal"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug CLI",
      "program": "${workspaceFolder}/dist/cli/index.js",
      "args": ["init"],
      "cwd": "/path/to/test-project"
    }
  ]
}
```

### Console Debugging

```typescript
// Add debug logs
console.log('[nextpulse] Debug:', value);

// Trace function calls
console.trace('[nextpulse] Function called');
```

### Node Inspector

```bash
node --inspect-brk dist/cli/index.js init
```

Then open `chrome://inspect` in Chrome.

---

## Adding Features

### Example: Add New Instrumentation Type

**1. Define Types** (`src/types/runtime.ts`):
```typescript
export interface CustomEvent {
  id: string;
  type: 'custom';
  data: string;
  timestamp: number;
}
```

**2. Add to Session** (`src/types/runtime.ts`):
```typescript
export interface SessionEvent {
  // ...existing fields
  customEvents: CustomEvent[];
}
```

**3. Implement Tracking** (`src/instrumentation/custom.ts`):
```typescript
import { SessionEvent } from '../types/runtime.js';

export function recordCustomEvent(data: string): void {
  const activeSession = getActiveSession();
  if (!activeSession) return;

  const event: CustomEvent = {
    id: generateId('custom'),
    type: 'custom',
    data,
    timestamp: Date.now(),
  };

  activeSession.customEvents.push(event);
}
```

**4. Export Function** (`src/instrumentation/index.ts`):
```typescript
export { recordCustomEvent } from './custom.js';
```

**5. Add Tests** (`tests/custom.test.ts`):
```typescript
import { describe, it, expect } from 'vitest';
import { recordCustomEvent, getRuntimeSnapshot } from '../src/instrumentation';

describe('custom events', () => {
  it('should record custom event', () => {
    beginSession('/test');
    recordCustomEvent('test data');

    const snapshot = getRuntimeSnapshot();
    expect(snapshot.sessions[0].customEvents).toHaveLength(1);
  });
});
```

**6. Update Documentation**:
- Add to [API Reference](api-reference.md)
- Update [README](../README.md)

---

## Best Practices

### 1. Development-Only Code

Always check `NODE_ENV`:

```typescript
export function instrumentFetch(): void {
  if (process.env.NODE_ENV !== 'development') {
    return; // No-op in production
  }
  // ... instrumentation code
}
```

### 2. Memory Management

Limit in-memory storage:

```typescript
const MAX_SESSIONS = 50;

if (snapshot.sessions.length > MAX_SESSIONS) {
  snapshot.sessions = snapshot.sessions.slice(0, MAX_SESSIONS);
}
```

### 3. Error Handling

Always use try-catch for instrumentation:

```typescript
export function instrumentFetch(): void {
  try {
    // Instrumentation code
  } catch (error) {
    // Silently fail - don't break user's app
    if (process.env.NODE_ENV === 'development') {
      console.warn('[nextpulse] Instrumentation error:', error);
    }
  }
}
```

### 4. Idempotent Operations

Make operations safe to run multiple times:

```typescript
let isInstrumented = false;

export function instrumentFetch(): void {
  if (isInstrumented) {
    return; // Already instrumented
  }

  // ... instrumentation
  isInstrumented = true;
}
```

### 5. Type Safety

Use strict TypeScript:

```typescript
// ✅ Good: Explicit types
export function recordEvent(event: Omit<Event, 'id'>): Event {
  // ...
}

// ❌ Avoid: Implicit any
export function recordEvent(event) {
  // ...
}
```

### 6. AST Manipulation

Use Babel + Recast for safe code transformation:

```typescript
import { parse } from '@babel/parser';
import { print } from 'recast';

const ast = parse(code, {
  sourceType: 'module',
  plugins: ['typescript', 'jsx'],
});

// Modify AST...

const newCode = print(ast).code;
```

### 7. Documentation

Document public APIs with JSDoc:

```typescript
/**
 * Record a fetch event to the active session
 *
 * @param event - The fetch event to record (id will be auto-generated)
 * @returns void
 *
 * @example
 * ```typescript
 * recordFetchEvent({
 *   url: 'https://api.example.com',
 *   method: 'GET',
 *   route: '/dashboard',
 *   origin: 'client-component',
 *   statusCode: 200,
 *   durationMs: 150,
 *   startedAt: Date.now() - 150,
 *   finishedAt: Date.now(),
 * });
 * ```
 */
export function recordFetchEvent(event: Omit<FetchEvent, 'id'>): void {
  // ...
}
```

---

## Performance Considerations

### Minimize Overhead

- Use lightweight data structures
- Avoid deep object cloning
- Limit string manipulation
- Cache expensive computations

### Memory Efficiency

```typescript
// ✅ Good: Limit array size
const MAX_EVENTS = 100;
events = events.slice(0, MAX_EVENTS);

// ❌ Avoid: Unbounded growth
events.push(newEvent);
```

### CPU Efficiency

```typescript
// ✅ Good: Early return
if (process.env.NODE_ENV !== 'development') {
  return; // No overhead in production
}

// ❌ Avoid: Unnecessary work
const result = expensiveOperation();
if (process.env.NODE_ENV !== 'development') {
  return;
}
```

---

## Deployment Checklist

Before releasing a new version:

- [ ] All tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] No TypeScript errors
- [ ] Documentation updated
- [ ] Version bumped in `package.json`
- [ ] CHANGELOG updated (if exists)
- [ ] Tested in real Next.js project
- [ ] Tested in both App Router and Pages Router
- [ ] Tested uninstall process

---

See also:
- [Contributing Guide](contributing.md)
- [Architecture](architecture.md)
- [API Reference](api-reference.md)
