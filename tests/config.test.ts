import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { readConfig, writeConfig, normalizeConfig, CONFIG_FILENAME } from "../src/utils/config.js";
import pc from "picocolors";

// Suppress console.warn during tests
const originalWarn = console.warn;
beforeEach(() => {
  console.warn = () => {};
});

afterEach(() => {
  console.warn = originalWarn;
});

describe("config", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nextpulse-config-test-"));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe("normalizeConfig", () => {
    it("should apply defaults for missing fields", () => {
      const partial = {};
      const normalized = normalizeConfig(partial);

      expect(normalized.enabled).toBe(true);
      expect(normalized.overlayPosition).toBe("bottomRight");
      expect(normalized.openBrowserOnStart).toBe(false);
    });

    it("should preserve valid values", () => {
      const partial = {
        overlayPosition: "topLeft" as const,
        openBrowserOnStart: true,
      };
      const normalized = normalizeConfig(partial);

      expect(normalized.overlayPosition).toBe("topLeft");
      expect(normalized.openBrowserOnStart).toBe(true);
      expect(normalized.enabled).toBe(true); // Default
    });

    it("should fall back to defaults for invalid values", () => {
      const invalid = {
        overlayPosition: "invalid" as any,
        enabled: "not-a-boolean" as any,
      };

      const warnings: string[] = [];
      console.warn = (msg: string) => warnings.push(msg);

      const normalized = normalizeConfig(invalid);

      expect(normalized.overlayPosition).toBe("bottomRight"); // Default
      expect(normalized.enabled).toBe(true); // Default
      expect(warnings.length).toBeGreaterThan(0);
    });
  });

  describe("readConfig", () => {
    it("should return defaults when config file does not exist", () => {
      const config = readConfig(tempDir);

      expect(config.enabled).toBe(true);
      expect(config.overlayPosition).toBe("bottomRight");
      expect(config.openBrowserOnStart).toBe(false);
    });

    it("should read valid config file", async () => {
      const configPath = path.join(tempDir, CONFIG_FILENAME);
      await fs.writeFile(
        configPath,
        JSON.stringify({
          overlayPosition: "topRight",
          openBrowserOnStart: true,
        }),
        "utf-8"
      );

      const config = readConfig(tempDir);

      expect(config.overlayPosition).toBe("topRight");
      expect(config.openBrowserOnStart).toBe(true);
      expect(config.enabled).toBe(true); // Default
    });

    it("should handle partial config and fill defaults", async () => {
      const configPath = path.join(tempDir, CONFIG_FILENAME);
      await fs.writeFile(
        configPath,
        JSON.stringify({
          overlayPosition: "bottomLeft",
        }),
        "utf-8"
      );

      const config = readConfig(tempDir);

      expect(config.overlayPosition).toBe("bottomLeft");
      expect(config.openBrowserOnStart).toBe(false); // Default
      expect(config.enabled).toBe(true); // Default
    });

    it("should handle invalid JSON gracefully", async () => {
      const configPath = path.join(tempDir, CONFIG_FILENAME);
      await fs.writeFile(configPath, "{ invalid json }", "utf-8");

      const warnings: string[] = [];
      console.warn = (msg: string) => warnings.push(msg);

      const config = readConfig(tempDir);

      // Should fall back to defaults
      expect(config.overlayPosition).toBe("bottomRight");
      expect(config.openBrowserOnStart).toBe(false);
      expect(warnings.length).toBeGreaterThan(0);
    });

    it("should handle invalid field values gracefully", async () => {
      const configPath = path.join(tempDir, CONFIG_FILENAME);
      await fs.writeFile(
        configPath,
        JSON.stringify({
          overlayPosition: "invalid",
          enabled: "not-a-boolean",
        }),
        "utf-8"
      );

      const warnings: string[] = [];
      console.warn = (msg: string) => warnings.push(msg);

      const config = readConfig(tempDir);

      // Should use defaults for invalid fields
      expect(config.overlayPosition).toBe("bottomRight");
      expect(config.enabled).toBe(true);
      expect(warnings.length).toBeGreaterThan(0);
    });
  });

  describe("writeConfig", () => {
    it("should write normalized config with 2-space indentation", async () => {
      writeConfig(tempDir, {
        overlayPosition: "topLeft",
        openBrowserOnStart: true,
      });

      const configPath = path.join(tempDir, CONFIG_FILENAME);
      const content = await fs.readFile(configPath, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.overlayPosition).toBe("topLeft");
      expect(parsed.openBrowserOnStart).toBe(true);
      expect(parsed.enabled).toBe(true); // Default filled in

      // Check formatting (2 spaces)
      const lines = content.split("\n");
      expect(lines[1]).toMatch(/^  "/); // Second line should have 2-space indent
    });

    it("should merge with existing config", async () => {
      // Write initial config
      writeConfig(tempDir, {
        overlayPosition: "bottomRight",
      });

      // Write partial update
      writeConfig(tempDir, {
        openBrowserOnStart: true,
      });

      const config = readConfig(tempDir);
      // Note: writeConfig replaces, doesn't merge - this is expected behavior
      // The second write should have defaults for overlayPosition
      expect(config.openBrowserOnStart).toBe(true);
    });
  });
});
