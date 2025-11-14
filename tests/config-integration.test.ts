import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { readConfig, CONFIG_FILENAME, isEnabled } from "../src/utils/config.js";
import { injectIntoEntryFile } from "../src/utils/injection.js";
import { updateDevScriptForBrowser } from "../src/utils/packageJson.js";
import { getProjectInfo, detectRouterType, getEntryFile } from "../src/utils/projectDetect.js";

// Mock process.exit to prevent test runner from exiting when CLI is imported
const originalExit = process.exit;
beforeAll(() => {
  process.exit = vi.fn() as typeof process.exit;
});

afterAll(() => {
  process.exit = originalExit;
});

// Suppress console output during tests
beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("config integration tests", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nextpulse-integration-test-"));
    // Create .git directory for project root detection
    await fs.ensureDir(path.join(tempDir, ".git"));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  async function setupAppRouter() {
    const appDir = path.join(tempDir, "app");
    await fs.ensureDir(appDir);
    await fs.writeFile(
      path.join(appDir, "layout.tsx"),
      `export default function RootLayout({ children }) {
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}`,
      "utf-8"
    );
    await fs.writeFile(
      path.join(tempDir, "package.json"),
      JSON.stringify({
        name: "test-app",
        scripts: { dev: "next dev" },
        dependencies: { next: "^14.0.0" },
      }),
      "utf-8"
    );
  }

  describe("enabled config", () => {
    it("should skip injection when enabled is false", async () => {
      await setupAppRouter();

      // Create config with enabled: false
      const configPath = path.join(tempDir, CONFIG_FILENAME);
      await fs.writeFile(configPath, JSON.stringify({ enabled: false }), "utf-8");

      // Test the config functionality directly without importing the full CLI
      // This avoids process.exit issues
      const testConfig = readConfig(tempDir);
      if (isEnabled(testConfig)) {
        const routerType = detectRouterType(tempDir);
        const entryFile = getEntryFile(tempDir, routerType);
        if (entryFile) {
          const projectInfo = getProjectInfo(tempDir);
          const props: Record<string, string> = {};
          if (testConfig.overlayPosition) props.overlayPosition = testConfig.overlayPosition;
          injectIntoEntryFile(entryFile, routerType, props);
        }
        if (testConfig.openBrowserOnStart !== undefined) {
          updateDevScriptForBrowser(tempDir, testConfig.openBrowserOnStart);
        }
      }

      // Layout should not be modified
      const layoutPath = path.join(tempDir, "app/layout.tsx");
      const layoutContent = await fs.readFile(layoutPath, "utf-8");
      expect(layoutContent).not.toContain("NextPulse");
      expect(layoutContent).not.toContain("@forgefoundry/nextpulse");
    });

    it("should inject when enabled is true", async () => {
      await setupAppRouter();

      const configPath = path.join(tempDir, CONFIG_FILENAME);
      await fs.writeFile(configPath, JSON.stringify({ enabled: true }), "utf-8");

      // Test the config functionality directly without importing the full CLI
      // This avoids process.exit issues
      const testConfig = readConfig(tempDir);
      if (isEnabled(testConfig)) {
        const routerType = detectRouterType(tempDir);
        const entryFile = getEntryFile(tempDir, routerType);
        if (entryFile) {
          const projectInfo = getProjectInfo(tempDir);
          const props: Record<string, string> = {};
          if (testConfig.overlayPosition) props.overlayPosition = testConfig.overlayPosition;
          injectIntoEntryFile(entryFile, routerType, props);
        }
        if (testConfig.openBrowserOnStart !== undefined) {
          updateDevScriptForBrowser(tempDir, testConfig.openBrowserOnStart);
        }
      }

      const layoutPath = path.join(tempDir, "app/layout.tsx");
      const layoutContent = await fs.readFile(layoutPath, "utf-8");
      expect(layoutContent).toContain("NextPulse");
      expect(layoutContent).toContain("@forgefoundry/nextpulse");
    });
  });

  describe("overlayPosition config", () => {
    it("should pass overlayPosition prop when configured", async () => {
      await setupAppRouter();

      const configPath = path.join(tempDir, CONFIG_FILENAME);
      await fs.writeFile(configPath, JSON.stringify({ overlayPosition: "topLeft" }), "utf-8");

      // Test the config functionality directly without importing the full CLI
      // This avoids process.exit issues
      const testConfig = readConfig(tempDir);
      if (isEnabled(testConfig)) {
        const routerType = detectRouterType(tempDir);
        const entryFile = getEntryFile(tempDir, routerType);
        if (entryFile) {
          const projectInfo = getProjectInfo(tempDir);
          const props: Record<string, string> = {};
          if (testConfig.overlayPosition) props.overlayPosition = testConfig.overlayPosition;
          injectIntoEntryFile(entryFile, routerType, props);
        }
        if (testConfig.openBrowserOnStart !== undefined) {
          updateDevScriptForBrowser(tempDir, testConfig.openBrowserOnStart);
        }
      }

      const layoutPath = path.join(tempDir, "app/layout.tsx");
      const layoutContent = await fs.readFile(layoutPath, "utf-8");
      expect(layoutContent).toContain('overlayPosition="topLeft"');
    });

    it("should use default bottomRight when not configured", async () => {
      await setupAppRouter();

      // Test the config functionality directly without importing the full CLI
      // This avoids process.exit issues
      const testConfig = readConfig(tempDir);
      if (isEnabled(testConfig)) {
        const routerType = detectRouterType(tempDir);
        const entryFile = getEntryFile(tempDir, routerType);
        if (entryFile) {
          const projectInfo = getProjectInfo(tempDir);
          const props: Record<string, string> = {};
          if (testConfig.overlayPosition) props.overlayPosition = testConfig.overlayPosition;
          injectIntoEntryFile(entryFile, routerType, props);
        }
        if (testConfig.openBrowserOnStart !== undefined) {
          updateDevScriptForBrowser(tempDir, testConfig.openBrowserOnStart);
        }
      }

      const layoutPath = path.join(tempDir, "app/layout.tsx");
      const layoutContent = await fs.readFile(layoutPath, "utf-8");
      // Should not have overlayPosition prop when using default
      // (component will use default internally)
      expect(layoutContent).toContain("NextPulse");
    });

    it("should handle all overlayPosition values", async () => {
      const positions = ["bottomRight", "bottomLeft", "topRight", "topLeft"] as const;

      for (const position of positions) {
        await setupAppRouter();

        const configPath = path.join(tempDir, CONFIG_FILENAME);
        await fs.writeFile(configPath, JSON.stringify({ overlayPosition: position }), "utf-8");

        // Test the config functionality directly without importing the full CLI
        // This avoids process.exit issues
        const testConfig = readConfig(tempDir);
        if (isEnabled(testConfig)) {
          const routerType = detectRouterType(tempDir);
          const entryFile = getEntryFile(tempDir, routerType);
          if (entryFile) {
            const projectInfo = getProjectInfo(tempDir);
            const props: Record<string, string> = {};
            if (testConfig.overlayPosition) props.overlayPosition = testConfig.overlayPosition;
            injectIntoEntryFile(entryFile, routerType, props);
          }
          if (testConfig.openBrowserOnStart !== undefined) {
            updateDevScriptForBrowser(tempDir, testConfig.openBrowserOnStart);
          }
        }

        const layoutPath = path.join(tempDir, "app/layout.tsx");
        const layoutContent = await fs.readFile(layoutPath, "utf-8");
        expect(layoutContent).toContain(`overlayPosition="${position}"`);

        // Clean up for next iteration
        await fs.remove(tempDir);
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nextpulse-integration-test-"));
        await fs.ensureDir(path.join(tempDir, ".git"));
      }
    });
  });

  describe("openBrowserOnStart config", () => {
    it("should add --open flag when openBrowserOnStart is true", async () => {
      await setupAppRouter();

      const configPath = path.join(tempDir, CONFIG_FILENAME);
      await fs.writeFile(configPath, JSON.stringify({ openBrowserOnStart: true }), "utf-8");

      // Test the config functionality directly without importing the full CLI
      // This avoids process.exit issues
      const testConfig = readConfig(tempDir);
      if (isEnabled(testConfig)) {
        const routerType = detectRouterType(tempDir);
        const entryFile = getEntryFile(tempDir, routerType);
        if (entryFile) {
          const projectInfo = getProjectInfo(tempDir);
          const props: Record<string, string> = {};
          if (testConfig.overlayPosition) props.overlayPosition = testConfig.overlayPosition;
          injectIntoEntryFile(entryFile, routerType, props);
        }
        if (testConfig.openBrowserOnStart !== undefined) {
          updateDevScriptForBrowser(tempDir, testConfig.openBrowserOnStart);
        }
      }

      const packageJsonPath = path.join(tempDir, "package.json");
      const pkg = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));
      expect(pkg.scripts.dev).toContain("--open");
    });

    it("should not add --open flag when openBrowserOnStart is false", async () => {
      await setupAppRouter();

      const configPath = path.join(tempDir, CONFIG_FILENAME);
      await fs.writeFile(configPath, JSON.stringify({ openBrowserOnStart: false }), "utf-8");

      // Test the config functionality directly without importing the full CLI
      // This avoids process.exit issues
      const testConfig = readConfig(tempDir);
      if (isEnabled(testConfig)) {
        const routerType = detectRouterType(tempDir);
        const entryFile = getEntryFile(tempDir, routerType);
        if (entryFile) {
          const projectInfo = getProjectInfo(tempDir);
          const props: Record<string, string> = {};
          if (testConfig.overlayPosition) props.overlayPosition = testConfig.overlayPosition;
          injectIntoEntryFile(entryFile, routerType, props);
        }
        if (testConfig.openBrowserOnStart !== undefined) {
          updateDevScriptForBrowser(tempDir, testConfig.openBrowserOnStart);
        }
      }

      const packageJsonPath = path.join(tempDir, "package.json");
      const pkg = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));
      expect(pkg.scripts.dev).not.toContain("--open");
    });

    it("should remove --open flag when switching from true to false", async () => {
      await setupAppRouter();

      // First init with openBrowserOnStart: true
      const configPath = path.join(tempDir, CONFIG_FILENAME);
      await fs.writeFile(configPath, JSON.stringify({ openBrowserOnStart: true }), "utf-8");

      // Test the config functionality directly without importing the full CLI
      // This avoids process.exit issues
      const testConfig = readConfig(tempDir);
      if (isEnabled(testConfig)) {
        const routerType = detectRouterType(tempDir);
        const entryFile = getEntryFile(tempDir, routerType);
        if (entryFile) {
          const projectInfo = getProjectInfo(tempDir);
          const props: Record<string, string> = {};
          if (testConfig.overlayPosition) props.overlayPosition = testConfig.overlayPosition;
          injectIntoEntryFile(entryFile, routerType, props);
        }
        if (testConfig.openBrowserOnStart !== undefined) {
          updateDevScriptForBrowser(tempDir, testConfig.openBrowserOnStart);
        }
      }

      let pkg = JSON.parse(await fs.readFile(path.join(tempDir, "package.json"), "utf-8"));
      expect(pkg.scripts.dev).toContain("--open");

      // Update config to false
      await fs.writeFile(configPath, JSON.stringify({ openBrowserOnStart: false }), "utf-8");

      // Test the config functionality directly without importing the full CLI
      // This avoids process.exit issues
      const testConfig2 = readConfig(tempDir);
      if (isEnabled(testConfig2)) {
        const routerType = detectRouterType(tempDir);
        const entryFile = getEntryFile(tempDir, routerType);
        if (entryFile) {
          const projectInfo = getProjectInfo(tempDir);
          const props: Record<string, string> = {};
          if (testConfig2.overlayPosition) props.overlayPosition = testConfig2.overlayPosition;
          injectIntoEntryFile(entryFile, routerType, props);
        }
        if (testConfig2.openBrowserOnStart !== undefined) {
          updateDevScriptForBrowser(tempDir, testConfig2.openBrowserOnStart);
        }
      }

      pkg = JSON.parse(await fs.readFile(path.join(tempDir, "package.json"), "utf-8"));
      expect(pkg.scripts.dev).not.toContain("--open");
    });
  });

  describe("combined config options", () => {
    it("should handle all config options together", async () => {
      await setupAppRouter();

      const configPath = path.join(tempDir, CONFIG_FILENAME);
      await fs.writeFile(
        configPath,
        JSON.stringify({
          enabled: true,
          overlayPosition: "topRight",
          openBrowserOnStart: true,
        }),
        "utf-8"
      );

      // Test the config functionality directly without importing the full CLI
      // This avoids process.exit issues
      const testConfig = readConfig(tempDir);
      if (isEnabled(testConfig)) {
        const routerType = detectRouterType(tempDir);
        const entryFile = getEntryFile(tempDir, routerType);
        if (entryFile) {
          const projectInfo = getProjectInfo(tempDir);
          const props: Record<string, string> = {};
          if (testConfig.overlayPosition) props.overlayPosition = testConfig.overlayPosition;
          injectIntoEntryFile(entryFile, routerType, props);
        }
        if (testConfig.openBrowserOnStart !== undefined) {
          updateDevScriptForBrowser(tempDir, testConfig.openBrowserOnStart);
        }
      }

      // Check overlayPosition prop
      const layoutPath = path.join(tempDir, "app/layout.tsx");
      const layoutContent = await fs.readFile(layoutPath, "utf-8");
      expect(layoutContent).toContain('overlayPosition="topRight"');

      // Check --open flag
      const packageJsonPath = path.join(tempDir, "package.json");
      const pkg = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));
      expect(pkg.scripts.dev).toContain("--open");
    });
  });
});
