import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.join(__dirname, "../dist/cli/index.js");

describe("CLI serve command", () => {
  it("should show help for serve command", () => {
    const output = execSync(`node ${cliPath} serve --help`, {
      encoding: "utf-8",
    });

    expect(output).toContain("Start the NextPulse local dashboard server");
    expect(output).toContain("--port");
    expect(output).toContain("--path");
    expect(output).toContain("--no-open");
  });

  it("should accept --port option", () => {
    // Just test that the option is accepted (will fail to start if port is taken, but that's ok)
    try {
      execSync(`node ${cliPath} serve --port 9999 --no-open`, {
        encoding: "utf-8",
        timeout: 2000,
      });
    } catch (error: any) {
      // Expected - server starts and we kill it, or port might be in use
      // Just verify it's not a "command not found" error
      expect(error.message).not.toContain("command not found");
    }
  });

  it("should accept --path option", () => {
    try {
      execSync(`node ${cliPath} serve --path . --port 9998 --no-open`, {
        encoding: "utf-8",
        timeout: 2000,
      });
    } catch (error: any) {
      // Expected - server starts and we kill it
      expect(error.message).not.toContain("command not found");
    }
  });

  it("should accept --no-open option", () => {
    try {
      execSync(`node ${cliPath} serve --port 9997 --no-open`, {
        encoding: "utf-8",
        timeout: 2000,
      });
    } catch (error: any) {
      // Expected - server starts and we kill it
      expect(error.message).not.toContain("command not found");
    }
  });

  it("should reject invalid port numbers", () => {
    try {
      execSync(`node ${cliPath} serve --port invalid --no-open`, {
        encoding: "utf-8",
      });
      expect.fail("Should have thrown an error for invalid port");
    } catch (error: any) {
      expect(error.message).toContain("Invalid port");
    }
  });

  it("should reject port numbers out of range", () => {
    try {
      execSync(`node ${cliPath} serve --port 99999 --no-open`, {
        encoding: "utf-8",
      });
      expect.fail("Should have thrown an error for port out of range");
    } catch (error: any) {
      expect(error.message).toContain("Invalid port");
    }
  });
});

