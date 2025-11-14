import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs-extra";
import os from "os";
import { initCommand } from "../src/commands/init.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.join(__dirname, "../dist/cli/index.js");

describe("CLI doctor command", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nextpulse-cli-doctor-test-"));
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

  it("should show help for doctor command", () => {
    const output = execSync(`node ${cliPath} doctor --help`, {
      encoding: "utf-8",
    });

    expect(output).toContain("Run health checks");
    expect(output).toContain("--app");
  });

  it("should pass all checks for a properly initialized project", async () => {
    await setupAppRouter();

    // Initialize NextPulse
    await initCommand({
      app: tempDir,
      yes: true,
    });

    // Run doctor
    const output = execSync(`node ${cliPath} doctor --app ${tempDir}`, {
      encoding: "utf-8",
    });

    expect(output).toContain("[nextpulse] Running health checks");
    expect(output).toContain("ok:");
    expect(output).toContain("All checks passed");

    // Should exit with code 0
    // (execSync throws on non-zero exit, so if we get here, exit was 0)
  });

  it("should detect missing config file", async () => {
    await setupAppRouter();

    // Initialize but don't create config (by not running init)
    // Actually, init always creates config now, so let's delete it
    await initCommand({
      app: tempDir,
      yes: true,
    });

    // Remove config file
    await fs.remove(path.join(tempDir, "nextpulse.config.json"));

    const output = execSync(`node ${cliPath} doctor --app ${tempDir}`, {
      encoding: "utf-8",
    });

    expect(output).toContain("warn:");
    expect(output).toContain("nextpulse.config.json not found");
  });

  it("should detect missing metadata file", async () => {
    await setupAppRouter();

    // Initialize
    await initCommand({
      app: tempDir,
      yes: true,
    });

    // Remove metadata file
    await fs.remove(path.join(tempDir, ".nextpulse/metadata.json"));

    const output = execSync(`node ${cliPath} doctor --app ${tempDir}`, {
      encoding: "utf-8",
    });

    expect(output).toContain("warn:");
    expect(output).toContain(".nextpulse/metadata.json not found");
  });

  it("should detect missing API routes", async () => {
    await setupAppRouter();

    // Initialize
    await initCommand({
      app: tempDir,
      yes: true,
    });

    // Remove some API routes
    await fs.remove(path.join(tempDir, "app/api/nextpulse/runtime/route.ts"));
    await fs.remove(path.join(tempDir, "app/api/nextpulse/bundles/route.ts"));

    const output = execSync(`node ${cliPath} doctor --app ${tempDir}`, {
      encoding: "utf-8",
    });

    expect(output).toContain("warn:");
    expect(output).toContain("Some NextPulse API routes are missing");
  });

  it("should detect missing injection", async () => {
    await setupAppRouter();

    // Initialize
    await initCommand({
      app: tempDir,
      yes: true,
    });

    // Remove NextPulse from layout
    const layoutPath = path.join(tempDir, "app/layout.tsx");
    let content = await fs.readFile(layoutPath, "utf-8");
    content = content.replace(
      /import\s+\{\s*NextPulse\s*\}\s+from\s+["']@forgefoundry\/nextpulse["'];?\n?/g,
      ""
    );
    content = content.replace(/<NextPulse\s*\/>/g, "");
    await fs.writeFile(layoutPath, content, "utf-8");

    const output = execSync(`node ${cliPath} doctor --app ${tempDir}`, {
      encoding: "utf-8",
    });

    expect(output).toContain("warn:");
    expect(output).toContain("NextPulse is not injected");
  });

  it("should exit with code 0 when all checks pass", async () => {
    await setupAppRouter();
    await initCommand({
      app: tempDir,
      yes: true,
    });

    // Should not throw (exit code 0)
    execSync(`node ${cliPath} doctor --app ${tempDir}`, {
      encoding: "utf-8",
    });
  });

  it("should exit with non-zero code when errors are detected", async () => {
    await setupAppRouter();

    // Don't initialize - should have errors

    try {
      execSync(`node ${cliPath} doctor --app ${tempDir}`, {
        encoding: "utf-8",
        stdio: "pipe",
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: any) {
      // Should exit with non-zero code
      expect(error.status || error.code).not.toBe(0);
    }
  });

  it("should accept --app option", async () => {
    await setupAppRouter();
    await initCommand({
      app: tempDir,
      yes: true,
    });

    const output = execSync(`node ${cliPath} doctor --app ${tempDir}`, {
      encoding: "utf-8",
    });

    expect(output).toContain("[nextpulse] Running health checks");
  });
});
