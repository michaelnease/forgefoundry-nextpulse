import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import {
  findProjectRoot,
  detectRouterType,
  getEntryFile,
  getNextVersion,
  readPackageJson,
} from "../src/utils/projectDetect.js";

describe("projectDetect", () => {
  const testDir = join(process.cwd(), ".test-tmp");

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("findProjectRoot", () => {
    it("should find project root with package.json and .git", () => {
      const projectRoot = join(testDir, "project");
      mkdirSync(projectRoot, { recursive: true });
      writeFileSync(join(projectRoot, "package.json"), '{"name": "test"}');
      mkdirSync(join(projectRoot, ".git"));

      const found = findProjectRoot(projectRoot);
      expect(found).toBe(projectRoot);
    });

    it("should return null if no project root found", () => {
      const subDir = join(testDir, "subdir");
      mkdirSync(subDir, { recursive: true });

      const found = findProjectRoot(subDir);
      expect(found).toBeNull();
    });
  });

  describe("detectRouterType", () => {
    it("should detect App Router with layout.tsx", () => {
      const projectRoot = join(testDir, "app-router");
      mkdirSync(join(projectRoot, "app"), { recursive: true });
      writeFileSync(join(projectRoot, "app", "layout.tsx"), "export default function Layout() {}");

      const routerType = detectRouterType(projectRoot);
      expect(routerType).toBe("app");
    });

    it("should detect App Router with layout.ts", () => {
      const projectRoot = join(testDir, "app-router-ts");
      mkdirSync(join(projectRoot, "app"), { recursive: true });
      writeFileSync(join(projectRoot, "app", "layout.ts"), "export default function Layout() {}");

      const routerType = detectRouterType(projectRoot);
      expect(routerType).toBe("app");
    });

    it("should detect Pages Router", () => {
      const projectRoot = join(testDir, "pages-router");
      mkdirSync(join(projectRoot, "pages"), { recursive: true });
      writeFileSync(join(projectRoot, "pages", "_app.tsx"), "export default function App() {}");

      const routerType = detectRouterType(projectRoot);
      expect(routerType).toBe("pages");
    });

    it("should return null if no router detected", () => {
      const projectRoot = join(testDir, "no-router");
      mkdirSync(projectRoot, { recursive: true });

      const routerType = detectRouterType(projectRoot);
      expect(routerType).toBeNull();
    });
  });

  describe("getEntryFile", () => {
    it("should get App Router entry file", () => {
      const projectRoot = join(testDir, "app-entry");
      mkdirSync(join(projectRoot, "app"), { recursive: true });
      writeFileSync(join(projectRoot, "app", "layout.tsx"), "export default function Layout() {}");

      const entryFile = getEntryFile(projectRoot, "app");
      expect(entryFile).toBe(join(projectRoot, "app", "layout.tsx"));
    });

    it("should get Pages Router entry file", () => {
      const projectRoot = join(testDir, "pages-entry");
      mkdirSync(join(projectRoot, "pages"), { recursive: true });
      writeFileSync(join(projectRoot, "pages", "_app.tsx"), "export default function App() {}");

      const entryFile = getEntryFile(projectRoot, "pages");
      expect(entryFile).toBe(join(projectRoot, "pages", "_app.tsx"));
    });
  });

  describe("readPackageJson", () => {
    it("should read package.json", () => {
      const projectRoot = join(testDir, "pkg-test");
      mkdirSync(projectRoot, { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ name: "test-app", version: "1.0.0" })
      );

      const pkg = readPackageJson(projectRoot);
      expect(pkg.name).toBe("test-app");
      expect(pkg.version).toBe("1.0.0");
    });

    it("should return empty object if package.json not found", () => {
      const projectRoot = join(testDir, "no-pkg");
      mkdirSync(projectRoot, { recursive: true });

      const pkg = readPackageJson(projectRoot);
      expect(pkg).toEqual({});
    });
  });

  describe("getNextVersion", () => {
    it("should get Next.js version from dependencies", () => {
      const pkg = {
        dependencies: { next: "^14.0.0" },
      };
      const version = getNextVersion(pkg);
      expect(version).toBe("^14.0.0");
    });

    it("should get Next.js version from devDependencies", () => {
      const pkg = {
        devDependencies: { next: "^13.5.0" },
      };
      const version = getNextVersion(pkg);
      expect(version).toBe("^13.5.0");
    });

    it("should return undefined if Next.js not found", () => {
      const pkg = {
        dependencies: { react: "^18.0.0" },
      };
      const version = getNextVersion(pkg);
      expect(version).toBeUndefined();
    });
  });
});

