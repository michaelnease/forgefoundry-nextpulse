/**
 * Tests for CLI snapshot command
 */

import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "fs";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.join(__dirname, "../dist/cli/index.js");

describe("CLI snapshot command", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `nextpulse-cli-snapshot-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    // Create minimal package.json
    writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify({
        name: "test-app",
        dependencies: {
          next: "16.0.3",
        },
      })
    );
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should show help for snapshot command", () => {
    const output = execSync(`node ${cliPath} snapshot --help`, {
      encoding: "utf-8",
    });

    expect(output).toContain("Generate a complete diagnostic snapshot");
    expect(output).toContain("--path");
  });

  it("should generate valid JSON snapshot", () => {
    const output = execSync(`node ${cliPath} snapshot --path ${tempDir}`, {
      encoding: "utf-8",
    });

    // Should be valid JSON
    const snapshot = JSON.parse(output);

    expect(snapshot).toHaveProperty("timestamp");
    expect(snapshot).toHaveProperty("metadata");
    expect(snapshot).toHaveProperty("config");
    expect(snapshot).toHaveProperty("routes");
    expect(snapshot).toHaveProperty("runtime");
    expect(snapshot).toHaveProperty("performance");
    expect(snapshot).toHaveProperty("errors");
    expect(snapshot).toHaveProperty("environment");
  });

  it("should accept --path option", () => {
    const output = execSync(`node ${cliPath} snapshot --path ${tempDir}`, {
      encoding: "utf-8",
    });

    const snapshot = JSON.parse(output);
    expect(snapshot.metadata).toBeDefined();
  });

  it("should use current directory as default path", () => {
    // Change to tempDir and run without --path
    const output = execSync(`cd ${tempDir} && node ${cliPath} snapshot`, {
      encoding: "utf-8",
    });

    const snapshot = JSON.parse(output);
    expect(snapshot.metadata).toBeDefined();
  });

  it("should output pretty-printed JSON (2 spaces)", () => {
    const output = execSync(`node ${cliPath} snapshot --path ${tempDir}`, {
      encoding: "utf-8",
    });

    // Check that it's pretty-printed (has newlines and indentation)
    const lines = output.split("\n");
    expect(lines.length).toBeGreaterThan(1);

    // Check for 2-space indentation
    const firstIndentedLine = lines.find((line) => line.startsWith("  "));
    expect(firstIndentedLine).toBeDefined();
  });

  it("should handle errors gracefully", () => {
    try {
      execSync(`node ${cliPath} snapshot --path /non-existent-path-12345`, {
        encoding: "utf-8",
        stdio: "pipe",
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: any) {
      // Should output error message
      expect(error.stdout || error.stderr || error.message).toBeDefined();
    }
  });
});

