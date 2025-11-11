#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { initCommand } from "./commands/init.js";

const program = new Command();
program.name("nextpulse").description("Developer diagnostics and metadata tools for Next.js apps");

program
  .command("init")
  .description("Inject NextPulseDev into a Next.js app for dev-only runtime visibility")
  .option("--app <path>", "path to Next.js app root", ".")
  .option("--dry-run", "print planned changes without writing")
  .option("--revert", "undo patches and remove NextPulseDev")
  .option("--with-dev-script", "add a dev script that runs nextpulse with next dev")
  .action(initCommand);

program.parseAsync().catch((err) => {
  console.error(pc.red(`[nextpulse] ${err?.message || err}`));
  process.exit(1);
});
