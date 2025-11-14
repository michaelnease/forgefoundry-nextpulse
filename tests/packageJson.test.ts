import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { updateDevScriptForBrowser } from "../src/utils/packageJson.js";

describe("packageJson - openBrowserOnStart", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nextpulse-pkg-test-"));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe("updateDevScriptForBrowser", () => {
    it("should add --open flag when openBrowserOnStart is true", async () => {
      const packageJsonPath = path.join(tempDir, "package.json");
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify({
          name: "test-app",
          scripts: { dev: "next dev" },
        }),
        "utf-8"
      );

      updateDevScriptForBrowser(tempDir, true);

      const pkg = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));
      expect(pkg.scripts.dev).toBe("next dev --open");
    });

    it("should not add --open flag when it already exists", async () => {
      const packageJsonPath = path.join(tempDir, "package.json");
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify({
          name: "test-app",
          scripts: { dev: "next dev --open" },
        }),
        "utf-8"
      );

      updateDevScriptForBrowser(tempDir, true);

      const pkg = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));
      expect(pkg.scripts.dev).toBe("next dev --open");
    });

    it("should remove --open flag when openBrowserOnStart is false", async () => {
      const packageJsonPath = path.join(tempDir, "package.json");
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify({
          name: "test-app",
          scripts: { dev: "next dev --open" },
        }),
        "utf-8"
      );

      updateDevScriptForBrowser(tempDir, false);

      const pkg = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));
      expect(pkg.scripts.dev).toBe("next dev");
    });

    it("should handle dev script with other flags", async () => {
      const packageJsonPath = path.join(tempDir, "package.json");
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify({
          name: "test-app",
          scripts: { dev: "next dev -p 3001" },
        }),
        "utf-8"
      );

      updateDevScriptForBrowser(tempDir, true);

      const pkg = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));
      expect(pkg.scripts.dev).toBe("next dev --open -p 3001");
    });

    it("should handle custom dev script", async () => {
      const packageJsonPath = path.join(tempDir, "package.json");
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify({
          name: "test-app",
          scripts: { dev: "node custom-dev.js" },
        }),
        "utf-8"
      );

      updateDevScriptForBrowser(tempDir, true);

      const pkg = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));
      expect(pkg.scripts.dev).toBe("node custom-dev.js --open");
    });

    it("should create scripts object if it doesn't exist", async () => {
      const packageJsonPath = path.join(tempDir, "package.json");
      await fs.writeFile(packageJsonPath, JSON.stringify({ name: "test-app" }), "utf-8");

      updateDevScriptForBrowser(tempDir, true);

      const pkg = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));
      expect(pkg.scripts).toBeDefined();
      expect(pkg.scripts.dev).toBe("next dev --open");
    });

    it("should handle missing package.json gracefully", () => {
      // Should not throw
      expect(() => {
        updateDevScriptForBrowser(tempDir, true);
      }).not.toThrow();
    });

    it("should handle invalid package.json gracefully", async () => {
      const packageJsonPath = path.join(tempDir, "package.json");
      await fs.writeFile(packageJsonPath, "{ invalid json }", "utf-8");

      // Should not throw
      expect(() => {
        updateDevScriptForBrowser(tempDir, true);
      }).not.toThrow();
    });

    it("should remove --open flag from script with multiple flags", async () => {
      const packageJsonPath = path.join(tempDir, "package.json");
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify({
          name: "test-app",
          scripts: { dev: "next dev --open -p 3001" },
        }),
        "utf-8"
      );

      updateDevScriptForBrowser(tempDir, false);

      const pkg = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));
      expect(pkg.scripts.dev).toBe("next dev -p 3001");
    });
  });
});
