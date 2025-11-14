/**
 * Tests for Phase 7: AI Diagnostic Snapshot
 */

import { describe, it, expect, beforeEach } from "vitest";
import { generateDiagnosticSnapshot } from "../src/server/snapshot.js";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "fs";
import { join } from "path";
import os from "os";
import type { DiagnosticSnapshot } from "../src/types/snapshot.js";

describe("Diagnostic Snapshot", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(os.tmpdir(), `nextpulse-snapshot-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    // Create minimal package.json
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({
        name: "test-app",
        dependencies: {
          next: "16.0.3",
        },
      })
    );
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should generate a complete diagnostic snapshot", async () => {
    const snapshot = await generateDiagnosticSnapshot(tempDir);

    expect(snapshot).toBeDefined();
    expect(snapshot.timestamp).toBeGreaterThan(0);
    expect(snapshot.metadata).toBeDefined();
    expect(snapshot.config).toBeDefined();
    expect(snapshot.routes).toBeDefined();
    expect(snapshot.runtime).toBeDefined();
    expect(snapshot.performance).toBeDefined();
    expect(snapshot.errors).toBeDefined();
    expect(snapshot.environment).toBeDefined();
  });

  it("should include metadata in snapshot", async () => {
    const snapshot = await generateDiagnosticSnapshot(tempDir);

    expect(snapshot.metadata).toHaveProperty("appName");
    expect(snapshot.metadata).toHaveProperty("nextVersion");
    expect(snapshot.metadata).toHaveProperty("gitBranch");
    expect(snapshot.metadata).toHaveProperty("gitSha");
    expect(snapshot.metadata).toHaveProperty("gitDirty");
  });

  it("should include config in snapshot", async () => {
    const snapshot = await generateDiagnosticSnapshot(tempDir);

    expect(snapshot.config).toHaveProperty("enabled");
    expect(snapshot.config).toHaveProperty("overlayPosition");
  });

  it("should include routes in snapshot", async () => {
    const snapshot = await generateDiagnosticSnapshot(tempDir);

    expect(snapshot.routes).toHaveProperty("appRoutes");
    expect(snapshot.routes).toHaveProperty("pagesRoutes");
    expect(Array.isArray(snapshot.routes.appRoutes)).toBe(true);
    expect(Array.isArray(snapshot.routes.pagesRoutes)).toBe(true);
  });

  it("should handle missing bundles gracefully", async () => {
    // No .next directory
    const snapshot = await generateDiagnosticSnapshot(tempDir);

    expect(snapshot.bundles).toBeNull();
  });

  it("should include runtime data in snapshot", async () => {
    const snapshot = await generateDiagnosticSnapshot(tempDir);

    expect(snapshot.runtime).toHaveProperty("sessions");
    expect(snapshot.runtime).toHaveProperty("activeSessionId");
    expect(snapshot.runtime).toHaveProperty("lastUpdated");
    expect(Array.isArray(snapshot.runtime.sessions)).toBe(true);
  });

  it("should include performance data in snapshot", async () => {
    const snapshot = await generateDiagnosticSnapshot(tempDir);

    expect(snapshot.performance).toHaveProperty("sessions");
    expect(snapshot.performance).toHaveProperty("activeSessionId");
    expect(snapshot.performance).toHaveProperty("lastUpdated");
  });

  it("should include errors in snapshot", async () => {
    const snapshot = await generateDiagnosticSnapshot(tempDir);

    expect(snapshot.errors).toHaveProperty("errors");
    expect(snapshot.errors).toHaveProperty("logs");
    expect(snapshot.errors).toHaveProperty("lastUpdated");
    expect(Array.isArray(snapshot.errors.errors)).toBe(true);
    expect(Array.isArray(snapshot.errors.logs)).toBe(true);
  });

  it("should include environment information", async () => {
    const snapshot = await generateDiagnosticSnapshot(tempDir);

    expect(snapshot.environment).toHaveProperty("node");
    expect(snapshot.environment).toHaveProperty("platform");
    expect(snapshot.environment).toHaveProperty("nextpulseVersion");
    expect(snapshot.environment).toHaveProperty("nextJsVersion");
    expect(snapshot.environment).toHaveProperty("git");
    expect(snapshot.environment.git).toHaveProperty("branch");
    expect(snapshot.environment.git).toHaveProperty("sha");
    expect(snapshot.environment.git).toHaveProperty("dirty");
  });

  it("should be fully serializable", async () => {
    const snapshot = await generateDiagnosticSnapshot(tempDir);

    // Should not throw when stringifying
    expect(() => JSON.stringify(snapshot)).not.toThrow();

    // Should be parseable
    const json = JSON.stringify(snapshot);
    const parsed = JSON.parse(json);
    expect(parsed.timestamp).toBe(snapshot.timestamp);
  });

  it("should work with empty datasets", async () => {
    // Create a minimal project with no routes, no bundles, no errors
    const snapshot = await generateDiagnosticSnapshot(tempDir);

    // Should still generate valid snapshot
    expect(snapshot).toBeDefined();
    expect(snapshot.routes.appRoutes).toEqual([]);
    expect(snapshot.routes.pagesRoutes).toEqual([]);
    expect(snapshot.bundles).toBeNull();
    expect(snapshot.runtime.sessions).toEqual([]);
    expect(snapshot.errors.errors).toEqual([]);
    expect(snapshot.errors.logs).toEqual([]);
  });
});
