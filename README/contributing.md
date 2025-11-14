# Contributing to NextPulse

Thank you for your interest in contributing to NextPulse! This document provides guidelines and instructions for contributing.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Coding Guidelines](#coding-guidelines)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)

---

## Code of Conduct

By participating in this project, you agree to:

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on what's best for the community
- Show empathy towards other community members

---

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Node.js** 18.17 or higher
- **npm** or **pnpm** package manager
- **Git** for version control
- **TypeScript** knowledge (preferred)
- A **Next.js** project for testing (create one if needed)

### Finding Issues to Work On

1. **Browse open issues**: https://github.com/michaelnease/nextforge/issues
2. **Look for "good first issue"** labels for beginner-friendly tasks
3. **Check "help wanted"** labels for issues seeking contributors
4. **Propose new features** by creating an issue first

---

## Development Setup

### 1. Fork the Repository

Click "Fork" button on GitHub: https://github.com/michaelnease/nextforge

### 2. Clone Your Fork

```bash
git clone https://github.com/YOUR_USERNAME/nextforge.git
cd nextforge
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Build the Project

```bash
npm run build
```

This compiles TypeScript to the `dist/` directory.

### 5. Link Locally

```bash
npm link
```

This allows you to test your changes in other Next.js projects:

```bash
cd your-nextjs-project
npm link @forgefoundry/nextpulse
nextpulse init
```

### 6. Run Tests

```bash
npm test
```

Should see all tests passing:
```
✓ tests/inject.test.ts (4 tests)
✓ tests/errors.test.ts (13 tests)
...
Test Files  21 passed (21)
Tests  185 passed (185)
```

---

## How to Contribute

### Reporting Bugs

1. **Search existing issues** to avoid duplicates
2. **Create a new issue** with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version, Next.js version)
   - Screenshots if applicable
3. **Include a snapshot**:
   ```bash
   nextpulse snapshot > bug-report-snapshot.json
   ```

### Suggesting Features

1. **Check existing feature requests** first
2. **Create an issue** with:
   - Clear use case
   - Proposed API or behavior
   - Alternative approaches considered
   - Willingness to implement it yourself
3. **Wait for maintainer feedback** before starting work

### Improving Documentation

Documentation contributions are always welcome!

- Fix typos or unclear explanations
- Add examples or tutorials
- Improve API documentation
- Translate documentation (future)

---

## Coding Guidelines

### Code Style

NextPulse uses TypeScript with strict mode enabled.

**TypeScript Configuration**:
```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

**Formatting**:
- **Indentation**: 2 spaces
- **Quotes**: Double quotes for strings
- **Semicolons**: Always use semicolons
- **Line length**: Soft limit of 100 characters

### File Structure

```
src/
├── cli/              # CLI commands
├── commands/         # Command implementations
├── instrumentation/  # Runtime tracking
├── runtime/          # React components
├── server/           # Dashboard server
├── types/            # TypeScript types
└── utils/            # Helper functions
```

### Naming Conventions

- **Files**: `camelCase.ts` (e.g., `instrumentFetch.ts`)
- **Components**: `PascalCase.tsx` (e.g., `NextPulse.tsx`)
- **Types**: `PascalCase` (e.g., `RuntimeSnapshot`)
- **Functions**: `camelCase` (e.g., `recordFetchEvent`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_SESSIONS`)

### TypeScript Guidelines

**Prefer interfaces over types** for objects:
```typescript
// ✅ Good
interface SessionEvent {
  id: string;
  route: string;
}

// ❌ Avoid
type SessionEvent = {
  id: string;
  route: string;
};
```

**Use explicit return types** for public functions:
```typescript
// ✅ Good
export function recordFetchEvent(event: FetchEvent): void {
  // ...
}

// ❌ Avoid
export function recordFetchEvent(event: FetchEvent) {
  // ...
}
```

**Avoid `any`** - use proper types:
```typescript
// ✅ Good
export function processError(error: Error | unknown): void {
  const message = error instanceof Error ? error.message : String(error);
}

// ❌ Avoid
export function processError(error: any): void {
  const message = error.message;
}
```

### Comment Guidelines

**Use JSDoc comments** for public APIs:
```typescript
/**
 * Record a fetch event to the active session
 * @param event - The fetch event to record
 */
export function recordFetchEvent(event: FetchEvent): void {
  // Implementation
}
```

**Add inline comments** for complex logic:
```typescript
// Check if result is a Promise (async component)
if (result instanceof Promise) {
  // Handle async case...
}
```

---

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/errors.test.ts

# Run tests in watch mode
npm test -- --watch
```

### Writing Tests

NextPulse uses **Vitest** for testing.

**Test file naming**: `*.test.ts` (e.g., `errors.test.ts`)

**Example test**:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { recordError, getErrorLogSnapshot, clearErrorsAndLogs } from '../src/instrumentation/errors';

describe('error tracking', () => {
  beforeEach(() => {
    clearErrorsAndLogs();
  });

  it('should record error event', () => {
    const error = recordError({
      route: '/test',
      source: 'client',
      message: 'Test error',
      severity: 'error',
    });

    expect(error.id).toMatch(/^error_/);
    expect(error.message).toBe('Test error');

    const snapshot = getErrorLogSnapshot();
    expect(snapshot.errors).toHaveLength(1);
  });
});
```

### Test Coverage

Aim for **>80% coverage** for new features:

```bash
npm test -- --coverage
```

### Integration Tests

Test against real Next.js projects:

```bash
# Located in tests/integration/
npm test -- tests/integration/init.test.ts
```

---

## Pull Request Process

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

**Branch naming**:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test improvements

### 2. Make Changes

- Follow coding guidelines
- Add tests for new functionality
- Update documentation if needed
- Ensure all tests pass: `npm test`
- Build successfully: `npm run build`

### 3. Commit Changes

Use clear, descriptive commit messages:

```bash
git add .
git commit -m "feat: add waterfall detection for parallel fetches"
```

**Commit message format**:
```
<type>: <description>

[optional body]

[optional footer]
```

**Types**:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `refactor:` - Code refactoring
- `test:` - Tests
- `chore:` - Maintenance

**Examples**:
```
feat: add error tracking to server actions
fix: resolve memory leak in session tracking
docs: update API reference for error tracking
refactor: extract ID generation to shared utility
test: add integration tests for snapshot generation
```

### 4. Push Changes

```bash
git push origin feature/your-feature-name
```

### 5. Create Pull Request

1. Go to your fork on GitHub
2. Click "Compare & pull request"
3. Fill out the PR template:
   - **Title**: Clear, descriptive title
   - **Description**: What changed and why
   - **Testing**: How you tested the changes
   - **Screenshots**: If UI changes
4. Link related issues (e.g., "Fixes #123")
5. Submit the PR

### 6. Code Review

- Address reviewer feedback
- Push additional commits to your branch
- Keep discussion focused and professional
- Be patient - reviews may take time

### 7. Merge

Once approved:
- Maintainer will merge your PR
- Your branch will be deleted
- Changes will be included in next release

---

## Pull Request Checklist

Before submitting, verify:

- [ ] Code follows style guidelines
- [ ] All tests pass (`npm test`)
- [ ] New tests added for new functionality
- [ ] Documentation updated
- [ ] Build succeeds (`npm run build`)
- [ ] No TypeScript errors
- [ ] Commit messages follow format
- [ ] PR description is clear and complete

---

## Release Process

(For maintainers)

### 1. Version Bump

Update version in `package.json`:

```json
{
  "version": "0.2.0"
}
```

### 2. Update Changelog

Document changes in `CHANGELOG.md` (if exists).

### 3. Build

```bash
npm run build
```

### 4. Test

```bash
npm test
```

### 5. Publish

```bash
npm publish
```

### 6. Tag Release

```bash
git tag v0.2.0
git push origin v0.2.0
```

### 7. GitHub Release

Create release on GitHub with changelog notes.

---

## Development Tips

### Live Development

Test changes in a real Next.js project:

```bash
# In nextpulse repo
npm run build && npm link

# In test Next.js project
npm link @forgefoundry/nextpulse
npm run dev
```

### Debugging

Use Node.js debugger:

```bash
node --inspect-brk node_modules/.bin/vitest run tests/errors.test.ts
```

### Watch Mode

Rebuild on changes:

```bash
npx tsc -p tsconfig.json --watch
```

### Clean Build

```bash
rm -rf dist node_modules
npm install
npm run build
```

---

## Architecture Overview

Understanding the codebase structure:

```
CLI Commands
     ↓
Server Layer (Dashboard)
     ↓
Instrumentation Layer (Tracking)
     ↓
Runtime Layer (UI Components)
     ↓
Utils Layer (Helpers)
```

See [Architecture Documentation](architecture.md) for details.

---

## Questions?

- **Documentation**: Check [README](../README.md) and [docs](.)
- **Issues**: https://github.com/michaelnease/nextforge/issues
- **Discussions**: GitHub Discussions (if enabled)

---

## Recognition

Contributors will be:
- Listed in release notes
- Added to contributors list
- Mentioned in project acknowledgments

Thank you for contributing to NextPulse! 🎉
