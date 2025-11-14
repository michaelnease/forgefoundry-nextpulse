#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";
import { initCommand } from "../commands/init.js";
import { startServer } from "../server/startServer.js";
import { generateDiagnosticSnapshot } from "../server/snapshot.js";
import { resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const program = new Command();

program
  .name("nextpulse")
  .description("Developer diagnostics and metadata tools for Next.js apps")
  .version(getVersion());

program
  .command("init")
  .description(
    "Setup NextPulse in a Next.js app with auto-detection (zero-config)"
  )
  .option("--app <appDir>", "path to Next.js app root", ".")
  .option("--dry-run", "show what would be done without making changes")
  .option("--revert", "remove NextPulse from the project")
  .option("--force", "overwrite existing files")
  .option("--with-webpack", "inject metadata into next.config.js via webpack DefinePlugin")
  .option("--with-dev-script", "update package.json dev script to include NextPulse")
  .action(async (options) => {
    try {
      await initCommand(options);
      process.exit(0);
    } catch (error: any) {
      console.error(pc.red(`[nextpulse] Error: ${error?.message || error}`));
      process.exit(1);
    }
  });

program
  .command("serve")
  .description("Start the NextPulse local dashboard server")
  .option("--port <port>", "port to run the server on", "4337")
  .option("--path <path>", "path to Next.js project root", ".")
  .option("--no-open", "do not automatically open the browser")
  .action(async (options) => {
    try {
      const port = parseInt(options.port, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        throw new Error(`Invalid port: ${options.port}. Must be between 1 and 65535.`);
      }

      await startServer({
        port,
        projectRoot: options.path,
        openBrowser: options.open === undefined ? true : options.open,
      });

      // Keep the process alive
      process.on("SIGINT", () => {
        console.log(pc.dim("\n[nextpulse] Shutting down..."));
        process.exit(0);
      });

      process.on("SIGTERM", () => {
        console.log(pc.dim("\n[nextpulse] Shutting down..."));
        process.exit(0);
      });
    } catch (error: any) {
      console.error(pc.red(`[nextpulse] Error: ${error?.message || error}`));
      process.exit(1);
    }
  });

program
  .command("snapshot")
  .description("Generate a complete diagnostic snapshot (AI-readable JSON)")
  .option("--path <path>", "path to Next.js project root", ".")
  .action(async (options) => {
    try {
      const projectRoot = resolve(options.path);
      const snapshot = await generateDiagnosticSnapshot(projectRoot);
      
      // Print JSON to stdout (pretty-printed, 2 spaces)
      console.log(JSON.stringify(snapshot, null, 2));
    } catch (error: any) {
      console.error(pc.red(`[nextpulse] Error: ${error?.message || error}`));
      process.exit(1);
    }
  });

program.parseAsync().catch((err) => {
  console.error(pc.red(`[nextpulse] ${err?.message || err}`));
  process.exit(1);
});

function getVersion(): string {
  // Try a direct read relative to compiled dist structure
  try {
    const p = join(__dirname, "../../package.json");
    const json = JSON.parse(readFileSync(p, "utf-8"));
    return json.version || "0.1.0";
  } catch {
    return "0.1.0";
  }
}
