import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { startServer } from "../src/server/startServer.js";
import { createServer } from "http";

describe("Server /api/routes endpoint", () => {
  let tempDir: string;
  let testPort: number;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nextpulse-server-routes-test-"));
    testPort = await findAvailablePort();
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it("should return routes for app router", async () => {
    await fs.ensureDir(path.join(tempDir, "app"));
    await fs.writeFile(path.join(tempDir, "app", "page.tsx"), "export default function Page() {}");
    await fs.writeFile(path.join(tempDir, "app", "layout.tsx"), "export default function Layout() {}");

    await startServer({
      port: testPort,
      projectRoot: tempDir,
      openBrowser: false,
    });

    try {
      const response = await fetch(`http://localhost:${testPort}/api/routes`);
      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data).toHaveProperty("appRoutes");
      expect(data).toHaveProperty("pagesRoutes");
      expect(Array.isArray(data.appRoutes)).toBe(true);
      expect(Array.isArray(data.pagesRoutes)).toBe(true);
      expect(data.appRoutes.length).toBeGreaterThan(0);
    } finally {
      // Server will keep running
    }
  });

  it("should return routes for pages router", async () => {
    await fs.ensureDir(path.join(tempDir, "pages"));
    await fs.writeFile(path.join(tempDir, "pages", "index.tsx"), "export default function Home() {}");
    await fs.writeFile(path.join(tempDir, "pages", "about.tsx"), "export default function About() {}");

    await startServer({
      port: testPort,
      projectRoot: tempDir,
      openBrowser: false,
    });

    try {
      const response = await fetch(`http://localhost:${testPort}/api/routes`);
      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.pagesRoutes.length).toBeGreaterThan(0);
      expect(data.pagesRoutes.some((r: any) => r.path === "/")).toBe(true);
      expect(data.pagesRoutes.some((r: any) => r.path === "/about")).toBe(true);
    } finally {
      // Server will keep running
    }
  });

  it("should return app router tree when app router exists", async () => {
    await fs.ensureDir(path.join(tempDir, "app"));
    await fs.writeFile(path.join(tempDir, "app", "page.tsx"), "export default function Page() {}");

    await startServer({
      port: testPort,
      projectRoot: tempDir,
      openBrowser: false,
    });

    try {
      const response = await fetch(`http://localhost:${testPort}/api/routes`);
      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.appRouterTree).toBeDefined();
      expect(data.appRouterTree).toHaveProperty("segment");
      expect(data.appRouterTree).toHaveProperty("path");
      expect(data.appRouterTree).toHaveProperty("children");
    } finally {
      // Server will keep running
    }
  });

  it("should handle missing app and pages directories gracefully", async () => {
    await startServer({
      port: testPort,
      projectRoot: tempDir,
      openBrowser: false,
    });

    try {
      const response = await fetch(`http://localhost:${testPort}/api/routes`);
      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.appRoutes).toEqual([]);
      expect(data.pagesRoutes).toEqual([]);
    } finally {
      // Server will keep running
    }
  });

  it("should return valid route structure", async () => {
    await fs.ensureDir(path.join(tempDir, "app"));
    await fs.writeFile(path.join(tempDir, "app", "page.tsx"), "export default function Page() {}");

    await startServer({
      port: testPort,
      projectRoot: tempDir,
      openBrowser: false,
    });

    try {
      const response = await fetch(`http://localhost:${testPort}/api/routes`);
      expect(response.ok).toBe(true);
      const data = await response.json();

      if (data.appRoutes.length > 0) {
        const route = data.appRoutes[0];
        expect(route).toHaveProperty("router");
        expect(route).toHaveProperty("path");
        expect(route).toHaveProperty("file");
        expect(route).toHaveProperty("kind");
        expect(route).toHaveProperty("segmentType");
        expect(["app", "pages"]).toContain(route.router);
        expect(typeof route.path).toBe("string");
        expect(typeof route.file).toBe("string");
      }
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

