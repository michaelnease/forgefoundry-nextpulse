/**
 * Tests for /api/snapshot endpoint
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { startServer } from "../src/server/startServer.js";
import fs from "fs-extra";
import path from "path";
import os from "os";

// Helper to find an available port
async function findAvailablePort(): Promise<number> {
  const net = await import("net");
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

describe("API /api/snapshot", () => {
  let testPort: number;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nextpulse-server-snapshot-test-"));
    testPort = await findAvailablePort();

    // Create minimal package.json
    await fs.writeJSON(path.join(tempDir, "package.json"), {
      name: "test-app",
      dependencies: {
        next: "16.0.3",
      },
    });
  });

  afterEach(async () => {
    if (tempDir && (await fs.pathExists(tempDir))) {
      await fs.remove(tempDir);
    }
  });

  it("should return a complete diagnostic snapshot", async () => {
    await startServer({
      port: testPort,
      projectRoot: tempDir,
      openBrowser: false,
    });

    try {
      const response = await fetch(`http://localhost:${testPort}/api/snapshot`);
      expect(response.ok).toBe(true);
      const snapshot = await response.json();

      expect(snapshot).toHaveProperty("timestamp");
      expect(snapshot).toHaveProperty("metadata");
      expect(snapshot).toHaveProperty("config");
      expect(snapshot).toHaveProperty("routes");
      expect(snapshot).toHaveProperty("bundles");
      expect(snapshot).toHaveProperty("runtime");
      expect(snapshot).toHaveProperty("performance");
      expect(snapshot).toHaveProperty("errors");
      expect(snapshot).toHaveProperty("environment");
    } finally {
      // Server will keep running
    }
  });

  it("should return valid snapshot structure", async () => {
    await startServer({
      port: testPort,
      projectRoot: tempDir,
      openBrowser: false,
    });

    try {
      const response = await fetch(`http://localhost:${testPort}/api/snapshot`);
      expect(response.ok).toBe(true);
      const snapshot = await response.json();

      // Check metadata structure
      expect(snapshot.metadata).toHaveProperty("appName");
      expect(snapshot.metadata).toHaveProperty("nextVersion");
      expect(snapshot.metadata).toHaveProperty("gitBranch");
      expect(snapshot.metadata).toHaveProperty("gitSha");
      expect(snapshot.metadata).toHaveProperty("gitDirty");

      // Check config structure
      expect(snapshot.config).toHaveProperty("enabled");
      expect(snapshot.config).toHaveProperty("overlayPosition");

      // Check routes structure
      expect(snapshot.routes).toHaveProperty("appRoutes");
      expect(snapshot.routes).toHaveProperty("pagesRoutes");
      expect(Array.isArray(snapshot.routes.appRoutes)).toBe(true);
      expect(Array.isArray(snapshot.routes.pagesRoutes)).toBe(true);

      // Check runtime structure
      expect(snapshot.runtime).toHaveProperty("sessions");
      expect(snapshot.runtime).toHaveProperty("activeSessionId");
      expect(snapshot.runtime).toHaveProperty("lastUpdated");

      // Check performance structure
      expect(snapshot.performance).toHaveProperty("sessions");
      expect(snapshot.performance).toHaveProperty("activeSessionId");
      expect(snapshot.performance).toHaveProperty("lastUpdated");

      // Check errors structure
      expect(snapshot.errors).toHaveProperty("errors");
      expect(snapshot.errors).toHaveProperty("logs");
      expect(snapshot.errors).toHaveProperty("lastUpdated");

      // Check environment structure
      expect(snapshot.environment).toHaveProperty("node");
      expect(snapshot.environment).toHaveProperty("platform");
      expect(snapshot.environment).toHaveProperty("nextpulseVersion");
      expect(snapshot.environment).toHaveProperty("git");
    } finally {
      // Server will keep running
    }
  });

  it("should return pretty-printed JSON", async () => {
    await startServer({
      port: testPort,
      projectRoot: tempDir,
      openBrowser: false,
    });

    try {
      const response = await fetch(`http://localhost:${testPort}/api/snapshot`);
      expect(response.ok).toBe(true);
      const text = await response.text();

      // Should be valid JSON
      const snapshot = JSON.parse(text);

      // Should be pretty-printed (check for newlines and indentation)
      const lines = text.split("\n");
      expect(lines.length).toBeGreaterThan(1);

      // Check for 2-space indentation
      const firstIndentedLine = lines.find((line) => line.startsWith("  "));
      expect(firstIndentedLine).toBeDefined();

      expect(snapshot).toBeDefined();
    } finally {
      // Server will keep running
    }
  });

  it("should handle missing bundles gracefully", async () => {
    // No .next directory
    await startServer({
      port: testPort,
      projectRoot: tempDir,
      openBrowser: false,
    });

    try {
      const response = await fetch(`http://localhost:${testPort}/api/snapshot`);
      expect(response.ok).toBe(true);
      const snapshot = await response.json();

      // Bundles should be null if .next doesn't exist
      expect(snapshot.bundles).toBeNull();
    } finally {
      // Server will keep running
    }
  });

  it("should return snapshot with empty datasets", async () => {
    await startServer({
      port: testPort,
      projectRoot: tempDir,
      openBrowser: false,
    });

    try {
      const response = await fetch(`http://localhost:${testPort}/api/snapshot`);
      expect(response.ok).toBe(true);
      const snapshot = await response.json();

      // Should still return valid snapshot even with empty data
      expect(snapshot.routes.appRoutes).toEqual([]);
      expect(snapshot.routes.pagesRoutes).toEqual([]);
      expect(snapshot.runtime.sessions).toEqual([]);
      expect(snapshot.errors.errors).toEqual([]);
      expect(snapshot.errors.logs).toEqual([]);
    } finally {
      // Server will keep running
    }
  });
});
