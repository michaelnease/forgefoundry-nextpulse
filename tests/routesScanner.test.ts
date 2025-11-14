import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import {
  detectRouterKind,
  scanAppRouter,
  scanPagesRouter,
  scanAllRoutes,
} from "../src/server/routesScanner.js";
import type { RouteInfo, AppRouteTreeNode } from "../src/types/routes.js";

describe("routesScanner", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nextpulse-routes-test-"));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe("detectRouterKind", () => {
    it("should detect app router", async () => {
      await fs.ensureDir(path.join(tempDir, "app"));
      await fs.writeFile(
        path.join(tempDir, "app", "layout.tsx"),
        "export default function Layout() {}"
      );

      const kind = detectRouterKind(tempDir);
      expect(kind).toBe("app");
    });

    it("should detect pages router", async () => {
      await fs.ensureDir(path.join(tempDir, "pages"));
      await fs.writeFile(
        path.join(tempDir, "pages", "_app.tsx"),
        "export default function App() {}"
      );

      const kind = detectRouterKind(tempDir);
      expect(kind).toBe("pages");
    });

    it("should detect mixed router", async () => {
      await fs.ensureDir(path.join(tempDir, "app"));
      await fs.ensureDir(path.join(tempDir, "pages"));
      await fs.writeFile(
        path.join(tempDir, "app", "layout.tsx"),
        "export default function Layout() {}"
      );
      await fs.writeFile(
        path.join(tempDir, "pages", "_app.tsx"),
        "export default function App() {}"
      );

      const kind = detectRouterKind(tempDir);
      expect(kind).toBe("mixed");
    });

    it("should return none when no router found", () => {
      const kind = detectRouterKind(tempDir);
      expect(kind).toBe("none");
    });
  });

  describe("scanAppRouter", () => {
    it("should scan simple app router structure", async () => {
      await fs.ensureDir(path.join(tempDir, "app"));
      await fs.writeFile(
        path.join(tempDir, "app", "page.tsx"),
        "export default function Page() {}"
      );
      await fs.writeFile(
        path.join(tempDir, "app", "layout.tsx"),
        "export default function Layout() {}"
      );

      const result = scanAppRouter(tempDir);

      expect(result.routes.length).toBeGreaterThan(0);
      expect(result.routes.some((r) => r.path === "/" && r.kind === "page")).toBe(true);
      expect(result.routes.some((r) => r.path === "/" && r.kind === "layout")).toBe(true);
      expect(result.tree).toBeDefined();
      expect(result.tree?.hasPage).toBe(true);
      expect(result.tree?.hasLayout).toBe(true);
    });

    it("should handle nested routes", async () => {
      await fs.ensureDir(path.join(tempDir, "app", "about"));
      await fs.writeFile(
        path.join(tempDir, "app", "page.tsx"),
        "export default function Page() {}"
      );
      await fs.writeFile(
        path.join(tempDir, "app", "about", "page.tsx"),
        "export default function About() {}"
      );

      const result = scanAppRouter(tempDir);

      expect(result.routes.some((r) => r.path === "/about" && r.kind === "page")).toBe(true);
    });

    it("should handle dynamic routes", async () => {
      await fs.ensureDir(path.join(tempDir, "app", "[slug]"));
      await fs.writeFile(
        path.join(tempDir, "app", "page.tsx"),
        "export default function Page() {}"
      );
      await fs.writeFile(
        path.join(tempDir, "app", "[slug]", "page.tsx"),
        "export default function Slug() {}"
      );

      const result = scanAppRouter(tempDir);

      const dynamicRoute = result.routes.find((r) => r.path === "/[slug]");
      expect(dynamicRoute).toBeDefined();
      expect(dynamicRoute?.segmentType).toBe("dynamic");
    });

    it("should handle catch-all routes", async () => {
      await fs.ensureDir(path.join(tempDir, "app", "[...slug]"));
      await fs.writeFile(
        path.join(tempDir, "app", "[...slug]", "page.tsx"),
        "export default function CatchAll() {}"
      );

      const result = scanAppRouter(tempDir);

      const catchAllRoute = result.routes.find((r) => r.path === "/[...slug]");
      expect(catchAllRoute).toBeDefined();
      expect(catchAllRoute?.segmentType).toBe("catchAll");
    });

    it("should handle route groups", async () => {
      await fs.ensureDir(path.join(tempDir, "app", "(marketing)", "about"));
      await fs.writeFile(
        path.join(tempDir, "app", "(marketing)", "about", "page.tsx"),
        "export default function About() {}"
      );

      const result = scanAppRouter(tempDir);

      const route = result.routes.find((r) => r.path === "/about");
      expect(route).toBeDefined();
      // Route groups should not appear in the path
      expect(route?.path).not.toContain("(marketing)");
    });

    it("should detect route handlers", async () => {
      await fs.ensureDir(path.join(tempDir, "app", "api"));
      await fs.writeFile(
        path.join(tempDir, "app", "api", "route.ts"),
        "export async function GET() {}"
      );

      const result = scanAppRouter(tempDir);

      const routeHandler = result.routes.find((r) => r.kind === "routeHandler");
      expect(routeHandler).toBeDefined();
    });

    it("should return empty result when app directory doesn't exist", () => {
      const result = scanAppRouter(tempDir);
      expect(result.routes).toEqual([]);
      expect(result.tree).toBeUndefined();
    });
  });

  describe("scanPagesRouter", () => {
    it("should scan simple pages router structure", async () => {
      await fs.ensureDir(path.join(tempDir, "pages"));
      await fs.writeFile(
        path.join(tempDir, "pages", "index.tsx"),
        "export default function Home() {}"
      );
      await fs.writeFile(
        path.join(tempDir, "pages", "about.tsx"),
        "export default function About() {}"
      );

      const routes = scanPagesRouter(tempDir);

      expect(routes.length).toBe(2);
      expect(routes.some((r) => r.path === "/" && r.kind === "page")).toBe(true);
      expect(routes.some((r) => r.path === "/about" && r.kind === "page")).toBe(true);
    });

    it("should handle nested routes", async () => {
      await fs.ensureDir(path.join(tempDir, "pages", "blog"));
      await fs.writeFile(
        path.join(tempDir, "pages", "blog", "index.tsx"),
        "export default function Blog() {}"
      );
      await fs.writeFile(
        path.join(tempDir, "pages", "blog", "[slug].tsx"),
        "export default function Post() {}"
      );

      const routes = scanPagesRouter(tempDir);

      expect(routes.some((r) => r.path === "/blog")).toBe(true);
      expect(routes.some((r) => r.path === "/blog/[slug]")).toBe(true);
    });

    it("should handle API routes", async () => {
      await fs.ensureDir(path.join(tempDir, "pages", "api"));
      await fs.writeFile(
        path.join(tempDir, "pages", "api", "posts.ts"),
        "export default function handler() {}"
      );

      const routes = scanPagesRouter(tempDir);

      const apiRoute = routes.find((r) => r.path === "/api/posts" && r.kind === "apiRoute");
      expect(apiRoute).toBeDefined();
    });

    it("should ignore special files", async () => {
      await fs.ensureDir(path.join(tempDir, "pages"));
      await fs.writeFile(
        path.join(tempDir, "pages", "_app.tsx"),
        "export default function App() {}"
      );
      await fs.writeFile(
        path.join(tempDir, "pages", "_document.tsx"),
        "export default function Document() {}"
      );
      await fs.writeFile(
        path.join(tempDir, "pages", "index.tsx"),
        "export default function Home() {}"
      );

      const routes = scanPagesRouter(tempDir);

      expect(routes.length).toBe(1);
      expect(routes[0].path).toBe("/");
    });

    it("should handle dynamic routes", async () => {
      await fs.ensureDir(path.join(tempDir, "pages"));
      await fs.writeFile(
        path.join(tempDir, "pages", "[id].tsx"),
        "export default function Dynamic() {}"
      );

      const routes = scanPagesRouter(tempDir);

      const dynamicRoute = routes.find((r) => r.path === "/[id]");
      expect(dynamicRoute).toBeDefined();
      expect(dynamicRoute?.segmentType).toBe("dynamic");
    });

    it("should return empty array when pages directory doesn't exist", () => {
      const routes = scanPagesRouter(tempDir);
      expect(routes).toEqual([]);
    });
  });

  describe("scanAllRoutes", () => {
    it("should scan both app and pages routers", async () => {
      await fs.ensureDir(path.join(tempDir, "app"));
      await fs.ensureDir(path.join(tempDir, "pages"));
      await fs.writeFile(
        path.join(tempDir, "app", "page.tsx"),
        "export default function AppPage() {}"
      );
      await fs.writeFile(
        path.join(tempDir, "pages", "index.tsx"),
        "export default function PagesPage() {}"
      );

      const snapshot = scanAllRoutes(tempDir);

      expect(snapshot.appRoutes.length).toBeGreaterThan(0);
      expect(snapshot.pagesRoutes.length).toBeGreaterThan(0);
    });

    it("should handle missing project root gracefully", () => {
      const snapshot = scanAllRoutes("/non-existent-path");
      expect(snapshot.appRoutes).toEqual([]);
      expect(snapshot.pagesRoutes).toEqual([]);
    });

    it("should return app router tree when app router exists", async () => {
      await fs.ensureDir(path.join(tempDir, "app"));
      await fs.writeFile(
        path.join(tempDir, "app", "page.tsx"),
        "export default function Page() {}"
      );

      const snapshot = scanAllRoutes(tempDir);

      expect(snapshot.appRouterTree).toBeDefined();
      expect(snapshot.appRouterTree?.hasPage).toBe(true);
    });
  });
});
