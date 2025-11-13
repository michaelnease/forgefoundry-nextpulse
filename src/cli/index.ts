#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";
import { initCommand } from "../commands/init.js";

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
