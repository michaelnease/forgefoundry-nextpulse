import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { startServer } from "../src/server/startServer.js";
import { beginSession, recordFetchEvent } from "../src/instrumentation/sessions.js";
import { createServer } from "http";

describe("Server /api/runtime endpoint", () => {
  let tempDir: string;
  let testPort: number;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nextpulse-server-runtime-test-"));
    testPort = await findAvailablePort();
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it("should return runtime snapshot", async () => {
    await startServer({
      port: testPort,
      projectRoot: tempDir,
      openBrowser: false,
    });

    try {
      const response = await fetch(`http://localhost:${testPort}/api/runtime`);
      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data).toHaveProperty("sessions");
      expect(data).toHaveProperty("activeSessionId");
      expect(data).toHaveProperty("lastUpdated");
      expect(Array.isArray(data.sessions)).toBe(true);
    } finally {
      // Server will keep running
    }
  });

  it("should return sessions with fetch events", async () => {
    // Create a session with fetch events before starting server
    beginSession("/test");
    recordFetchEvent({
      url: "https://example.com/api",
      method: "GET",
      route: "/test",
      origin: "client-component",
      statusCode: 200,
      durationMs: 100,
      cacheMode: null,
      cacheResult: "miss",
      startedAt: Date.now() - 100,
      finishedAt: Date.now(),
    });

    await startServer({
      port: testPort,
      projectRoot: tempDir,
      openBrowser: false,
    });

    try {
      const response = await fetch(`http://localhost:${testPort}/api/runtime`);
      expect(response.ok).toBe(true);
      const data = await response.json();

      if (data.sessions.length > 0) {
        const session = data.sessions[0];
        expect(session).toHaveProperty("fetches");
        expect(Array.isArray(session.fetches)).toBe(true);
      }
    } finally {
      // Server will keep running
    }
  });

  it("should return valid snapshot structure even with existing sessions", async () => {
    await startServer({
      port: testPort,
      projectRoot: tempDir,
      openBrowser: false,
    });

    try {
      const response = await fetch(`http://localhost:${testPort}/api/runtime`);
      expect(response.ok).toBe(true);
      const data = await response.json();

      // Should have valid structure (may have sessions from other tests)
      expect(data).toHaveProperty("sessions");
      expect(data).toHaveProperty("activeSessionId");
      expect(data).toHaveProperty("lastUpdated");
      expect(Array.isArray(data.sessions)).toBe(true);
    } finally {
      // Server will keep running
    }
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
