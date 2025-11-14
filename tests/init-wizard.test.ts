import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { initCommand } from "../src/commands/init.js";
import { readConfig } from "../src/utils/config.js";

describe("init wizard", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nextpulse-init-wizard-test-"));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  async function setupAppRouter() {
    const appDir = path.join(tempDir, "app");
    await fs.ensureDir(appDir);
    await fs.writeFile(
      path.join(appDir, "layout.tsx"),
      `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html><body>{children}</body></html>;
}`,
      "utf-8"
    );
    await fs.writeFile(
      path.join(tempDir, "package.json"),
      JSON.stringify({ name: "test-app", scripts: { dev: "next dev" } }, null, 2),
      "utf-8"
    );
  }

  it("should create config with defaults when using --yes flag", async () => {
    await setupAppRouter();

    await initCommand({
      app: tempDir,
      yes: true,
    });

    const config = readConfig(tempDir);
    expect(config.overlayPosition).toBe("bottomRight");
    expect(config.openBrowserOnStart).toBe(false);
    expect(config.enabled).toBe(true);
  });

  it("should create config with specified overlay position", async () => {
    await setupAppRouter();

    await initCommand({
      app: tempDir,
      yes: true,
      overlayPosition: "topLeft",
    });

    const config = readConfig(tempDir);
    expect(config.overlayPosition).toBe("topLeft");
  });

  it("should create config with openBrowser flag", async () => {
    await setupAppRouter();

    await initCommand({
      app: tempDir,
      yes: true,
      openBrowser: true,
    });

    const config = readConfig(tempDir);
    expect(config.openBrowserOnStart).toBe(true);
  });

  it("should create config with noOpenBrowser flag", async () => {
    await setupAppRouter();

    await initCommand({
      app: tempDir,
      yes: true,
      noOpenBrowser: true,
    });

    const config = readConfig(tempDir);
    expect(config.openBrowserOnStart).toBe(false);
  });

  it("should create config file even without wizard", async () => {
    await setupAppRouter();

    await initCommand({
      app: tempDir,
      nonInteractive: true,
    });

    const configPath = path.join(tempDir, "nextpulse.config.json");
    expect(await fs.pathExists(configPath)).toBe(true);

    const config = readConfig(tempDir);
    expect(config.overlayPosition).toBe("bottomRight");
    expect(config.openBrowserOnStart).toBe(false);
  });

  it("should handle non-interactive mode with flags", async () => {
    await setupAppRouter();

    await initCommand({
      app: tempDir,
      nonInteractive: true,
      overlayPosition: "bottomLeft",
      openBrowser: true,
    });

    const config = readConfig(tempDir);
    expect(config.overlayPosition).toBe("bottomLeft");
    expect(config.openBrowserOnStart).toBe(true);
  });

  it("should provide helpful error when Next.js app not found", async () => {
    await expect(
      initCommand({
        app: tempDir,
        yes: true,
      })
    ).rejects.toThrow(/Could not find a Next.js app/);
  });

  it("should provide helpful error when Next.js app structure is incomplete", async () => {
    // Create app directory but no layout file
    await fs.ensureDir(path.join(tempDir, "app"));
    await fs.writeFile(
      path.join(tempDir, "package.json"),
      JSON.stringify({ name: "test-app" }, null, 2),
      "utf-8"
    );

    await expect(
      initCommand({
        app: tempDir,
        yes: true,
      })
    ).rejects.toThrow(/Could not find a Next.js app/);
  });
});
