import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { readConfig, writeConfig, isEnabled, CONFIG_FILENAME } from "../src/utils/config.js";

describe("config", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nextpulse-config-test-"));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe("readConfig", () => {
    it("should return defaults when config file doesn't exist", () => {
      const config = readConfig(tempDir);
      expect(config.enabled).toBe(true);
      expect(config.overlayPosition).toBe("bottomRight");
      expect(config.openBrowserOnStart).toBe(false);
    });

    it("should read config from file", async () => {
      const configPath = path.join(tempDir, CONFIG_FILENAME);
      await fs.writeFile(
        configPath,
        JSON.stringify({
          enabled: false,
          overlayPosition: "topLeft",
          openBrowserOnStart: true,
        }),
        "utf-8"
      );

      const config = readConfig(tempDir);
      expect(config.enabled).toBe(false);
      expect(config.overlayPosition).toBe("topLeft");
      expect(config.openBrowserOnStart).toBe(true);
    });

    it("should handle partial config and use defaults", async () => {
      const configPath = path.join(tempDir, CONFIG_FILENAME);
      await fs.writeFile(
        configPath,
        JSON.stringify({ overlayPosition: "topRight" }),
        "utf-8"
      );

      const config = readConfig(tempDir);
      expect(config.enabled).toBe(true); // default
      expect(config.overlayPosition).toBe("topRight");
      expect(config.openBrowserOnStart).toBe(false); // default
    });

    it("should handle invalid JSON gracefully", async () => {
      const configPath = path.join(tempDir, CONFIG_FILENAME);
      await fs.writeFile(configPath, "{ invalid json }", "utf-8");

      const config = readConfig(tempDir);
      // Should fall back to defaults
      expect(config.enabled).toBe(true);
      expect(config.overlayPosition).toBe("bottomRight");
      expect(config.openBrowserOnStart).toBe(false);
    });
  });

  describe("writeConfig", () => {
    it("should write config file", async () => {
      writeConfig(tempDir, {
        enabled: false,
        overlayPosition: "topLeft",
        openBrowserOnStart: true,
      });

      const configPath = path.join(tempDir, CONFIG_FILENAME);
      expect(await fs.pathExists(configPath)).toBe(true);

      const content = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(content);
      expect(config.enabled).toBe(false);
      expect(config.overlayPosition).toBe("topLeft");
      expect(config.openBrowserOnStart).toBe(true);
    });

    it("should merge with defaults when writing partial config", async () => {
      writeConfig(tempDir, { overlayPosition: "bottomLeft" });

      const config = readConfig(tempDir);
      expect(config.enabled).toBe(true); // default
      expect(config.overlayPosition).toBe("bottomLeft");
      expect(config.openBrowserOnStart).toBe(false); // default
    });
  });

  describe("isEnabled", () => {
    it("should return true when enabled is true in config", () => {
      const config = { enabled: true, overlayPosition: "bottomRight" as const, openBrowserOnStart: false };
      expect(isEnabled(config)).toBe(true);
    });

    it("should return false when enabled is false in config", () => {
      const config = { enabled: false, overlayPosition: "bottomRight" as const, openBrowserOnStart: false };
      expect(isEnabled(config)).toBe(false);
    });

    it("should return false when NEXTPULSE_ENABLED=0", () => {
      const originalEnv = process.env.NEXTPULSE_ENABLED;
      process.env.NEXTPULSE_ENABLED = "0";
      
      const config = { enabled: true, overlayPosition: "bottomRight" as const, openBrowserOnStart: false };
      expect(isEnabled(config)).toBe(false);
      
      process.env.NEXTPULSE_ENABLED = originalEnv;
    });

    it("should return false when NEXTPULSE_ENABLED=false", () => {
      const originalEnv = process.env.NEXTPULSE_ENABLED;
      process.env.NEXTPULSE_ENABLED = "false";
      
      const config = { enabled: true, overlayPosition: "bottomRight" as const, openBrowserOnStart: false };
      expect(isEnabled(config)).toBe(false);
      
      process.env.NEXTPULSE_ENABLED = originalEnv;
    });

    it("should return true when NEXTPULSE_ENABLED is not set and enabled is true", () => {
      const originalEnv = process.env.NEXTPULSE_ENABLED;
      delete process.env.NEXTPULSE_ENABLED;
      
      const config = { enabled: true, overlayPosition: "bottomRight" as const, openBrowserOnStart: false };
      expect(isEnabled(config)).toBe(true);
      
      process.env.NEXTPULSE_ENABLED = originalEnv;
    });
  });
});

