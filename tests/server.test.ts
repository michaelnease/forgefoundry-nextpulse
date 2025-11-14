import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { createServer } from "http";
import { loadMetadata } from "../src/server/loadMetadata.js";
import { startServer } from "../src/server/startServer.js";
import { readConfig, writeConfig } from "../src/utils/config.js";

describe("loadMetadata", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nextpulse-server-test-"));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it("should load metadata with priority: env → metadata.json → package.json → git → defaults", async () => {
    // Create package.json
    await fs.writeFile(
      path.join(tempDir, "package.json"),
      JSON.stringify({
        name: "test-app",
        dependencies: { next: "^14.0.0" },
      }),
      "utf-8"
    );

    const metadata = loadMetadata(tempDir);

    expect(metadata.appName).toBe("test-app");
    expect(metadata.nextVersion).toBe("14.0.0");
    expect(metadata.port).toBe("3000");
    expect(typeof metadata.gitBranch).toBe("string");
    expect(typeof metadata.gitSha).toBe("string");
    expect(typeof metadata.gitDirty).toBe("boolean");
  });

  it("should prioritize environment variables", () => {
    const originalEnv = { ...process.env };
    process.env.NEXTPULSE_APP_NAME = "env-app";
    process.env.NEXTPULSE_NEXT_VERSION = "16.0.0";
    process.env.NEXTPULSE_GIT_BRANCH = "env-branch";
    process.env.NEXTPULSE_GIT_SHA = "env-sha";
    process.env.NEXTPULSE_GIT_DIRTY = "true";
    process.env.PORT = "8080";

    try {
      const metadata = loadMetadata(tempDir);
      expect(metadata.appName).toBe("env-app");
      expect(metadata.nextVersion).toBe("16.0.0");
      expect(metadata.gitBranch).toBe("env-branch");
      expect(metadata.gitSha).toBe("env-sha");
      expect(metadata.gitDirty).toBe(true);
      expect(metadata.port).toBe("8080");
    } finally {
      process.env = originalEnv;
    }
  });

  it("should prioritize metadata.json over package.json", async () => {
    // Create package.json
    await fs.writeFile(
      path.join(tempDir, "package.json"),
      JSON.stringify({
        name: "package-app",
        dependencies: { next: "^14.0.0" },
      }),
      "utf-8"
    );

    // Create metadata.json
    await fs.ensureDir(path.join(tempDir, ".nextpulse"));
    await fs.writeFile(
      path.join(tempDir, ".nextpulse/metadata.json"),
      JSON.stringify({
        appName: "metadata-app",
        nextVersion: "15.0.0",
        gitBranch: "metadata-branch",
        gitSha: "metadata-sha",
        gitDirty: true,
        port: "4000",
      }),
      "utf-8"
    );

    const metadata = loadMetadata(tempDir);

    expect(metadata.appName).toBe("metadata-app");
    expect(metadata.nextVersion).toBe("15.0.0");
    expect(metadata.gitBranch).toBe("metadata-branch");
    expect(metadata.gitSha).toBe("metadata-sha");
    expect(metadata.gitDirty).toBe(true);
    expect(metadata.port).toBe("4000");
  });

  it("should handle missing files gracefully", () => {
    const metadata = loadMetadata(tempDir);

    expect(metadata.appName).toBe("Next.js App");
    expect(metadata.nextVersion).toBe("unknown");
    expect(metadata.gitBranch).toBe("unknown");
    expect(metadata.gitSha).toBe("unknown");
    expect(metadata.gitDirty).toBe(false);
    expect(metadata.port).toBe("3000");
  });

  it("should always return a fully-populated Metadata object", () => {
    const metadata = loadMetadata(tempDir);

    expect(metadata).toHaveProperty("appName");
    expect(metadata).toHaveProperty("nextVersion");
    expect(metadata).toHaveProperty("gitBranch");
    expect(metadata).toHaveProperty("gitSha");
    expect(metadata).toHaveProperty("gitDirty");
    expect(metadata).toHaveProperty("port");

    expect(typeof metadata.appName).toBe("string");
    expect(typeof metadata.nextVersion).toBe("string");
    expect(typeof metadata.gitBranch).toBe("string");
    expect(typeof metadata.gitSha).toBe("string");
    expect(typeof metadata.gitDirty).toBe("boolean");
    expect(typeof metadata.port).toBe("string");
  });
});

describe("startServer", () => {
  let tempDir: string;
  let testPort: number;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nextpulse-server-test-"));
    // Find an available port
    testPort = await findAvailablePort();
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it("should start server and respond to /api/health", async () => {
    await startServer({
      port: testPort,
      projectRoot: tempDir,
      openBrowser: false,
    });

    try {
      const response = await fetch(`http://localhost:${testPort}/api/health`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toEqual({ ok: true });
    } finally {
      // Server will keep running, but test will complete
    }
  });

  it("should return metadata from /api/metadata", async () => {
    // Create package.json
    await fs.writeFile(
      path.join(tempDir, "package.json"),
      JSON.stringify({
        name: "test-app",
        dependencies: { next: "^14.0.0" },
      }),
      "utf-8"
    );

    await startServer({
      port: testPort,
      projectRoot: tempDir,
      openBrowser: false,
    });

    try {
      const response = await fetch(`http://localhost:${testPort}/api/metadata`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.appName).toBe("test-app");
      expect(data.nextVersion).toBe("14.0.0");
      expect(data).toHaveProperty("gitBranch");
      expect(data).toHaveProperty("gitSha");
      expect(data).toHaveProperty("gitDirty");
      expect(data).toHaveProperty("port");
    } finally {
      // Server will keep running
    }
  });

  it("should return config from /api/config", async () => {
    writeConfig(tempDir, {
      overlayPosition: "topLeft",
      enabled: true,
    });

    await startServer({
      port: testPort,
      projectRoot: tempDir,
      openBrowser: false,
    });

    try {
      const response = await fetch(`http://localhost:${testPort}/api/config`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.overlayPosition).toBe("topLeft");
      expect(data.enabled).toBe(true);
    } finally {
      // Server will keep running
    }
  });

  it("should serve dashboard HTML at /", async () => {
    await startServer({
      port: testPort,
      projectRoot: tempDir,
      openBrowser: false,
    });

    try {
      const response = await fetch(`http://localhost:${testPort}/`);
      expect(response.ok).toBe(true);
      const html = await response.text();
      expect(html).toContain("NextPulse");
      expect(html).toContain("Dashboard");
      expect(html).toContain("anvil-button");
      expect(html).toContain("api/metadata");
    } finally {
      // Server will keep running
    }
  });

  it("should handle missing project root gracefully", async () => {
    const nonExistentPath = path.join(tempDir, "non-existent");

    await startServer({
      port: testPort,
      projectRoot: nonExistentPath,
      openBrowser: false,
    });

    try {
      const response = await fetch(`http://localhost:${testPort}/api/metadata`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      // Should still return metadata with defaults
      expect(data).toHaveProperty("appName");
      expect(data).toHaveProperty("nextVersion");
    } finally {
      // Server will keep running
    }
  });

  it("should reject if port is already in use", async () => {
    // Start first server
    await startServer({
      port: testPort,
      projectRoot: tempDir,
      openBrowser: false,
    });

    // Try to start second server on same port
    await expect(
      startServer({
        port: testPort,
        projectRoot: tempDir,
        openBrowser: false,
      })
    ).rejects.toThrow();
  });
});

/**
 * Helper to find an available port
 */
function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address === "object") {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        reject(new Error("Could not find available port"));
      }
    });
    server.on("error", reject);
  });
}

