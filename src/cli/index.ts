#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { readFileSync } from "fs";
import { join, resolve } from "path";
import {
  findProjectRoot,
  detectRouterType,
  getEntryFile,
  getProjectInfo,
  findMonorepoApps,
  type RouterType,
} from "../utils/projectDetect.js";
import { injectIntoEntryFile, createMinimalAppLayout } from "../utils/injection.js";
import { readConfig, writeConfig, isEnabled } from "../utils/config.js";
import { createInterface } from "readline";

const program = new Command();

program
  .name("nextpulse")
  .description("Developer diagnostics and metadata tools for Next.js apps")
  .version(getVersion());

program
  .command("init")
  .description("Inject NextPulseDev into a Next.js app for dev-only runtime visibility")
  .option("--path <appDir>", "path to Next.js app root", ".")
  .option("--yes", "suppress prompts and pick first detected app")
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

async function initCommand(options: { path: string; yes: boolean }) {
  const startPath = resolve(options.path);
  const projectRoot = findProjectRoot(startPath);

  if (!projectRoot) {
    throw new Error("Could not find project root (package.json and .git required)");
  }

  console.log(pc.cyan(`[nextpulse] Found project root: ${projectRoot}`));

  // Check for monorepo
  const monorepoApps = findMonorepoApps(projectRoot);
  let targetRoot = projectRoot;

  if (monorepoApps.length > 0) {
    if (options.yes) {
      targetRoot = monorepoApps[0];
      console.log(pc.dim(`[nextpulse] Using first app: ${targetRoot}`));
    } else {
      const selected = await selectApp(monorepoApps);
      if (selected) {
        targetRoot = selected;
      }
    }
  }

  // Detect router type
  let routerType = detectRouterType(targetRoot);

  if (!routerType) {
    console.log(pc.yellow("[nextpulse] No router detected, creating minimal App Router layout..."));
    const layoutPath = createMinimalAppLayout(targetRoot);
    routerType = "app";
    console.log(pc.green(`[nextpulse] Created ${layoutPath}`));
  } else {
    console.log(pc.dim(`[nextpulse] Detected ${routerType} router`));
  }

  // Get project info
  const projectInfo = getProjectInfo(targetRoot);

  // Read or create config
  const config = readConfig(targetRoot);
  if (!existsSync(join(targetRoot, "nextpulse.config.json"))) {
    writeConfig(targetRoot);
    console.log(pc.green("[nextpulse] Created nextpulse.config.json"));
  }

  // Check if enabled
  if (!isEnabled(config)) {
    console.log(pc.yellow("[nextpulse] NextPulse is disabled in config or NEXTPULSE_ENABLED=0"));
    return;
  }

  // Prepare props for NextPulseDev
  const props: Record<string, string> = {};
  if (projectInfo.packageJson.name) {
    props.appName = projectInfo.packageJson.name;
  }
  if (projectInfo.nextVersion) {
    props.nextVersion = projectInfo.nextVersion;
  }
  if (projectInfo.port) {
    props.port = projectInfo.port;
  }
  if (projectInfo.gitBranch) {
    props.gitBranch = projectInfo.gitBranch;
  }
  if (projectInfo.gitSha) {
    props.gitSha = projectInfo.gitSha;
  }

  // Get entry file
  let entryFile = getEntryFile(targetRoot, routerType);

  if (!entryFile) {
    if (routerType === "app") {
      entryFile = createMinimalAppLayout(targetRoot, props);
      console.log(pc.green(`[nextpulse] Created ${entryFile}`));
    } else {
      throw new Error("Could not find entry file and cannot create one for Pages Router");
    }
  } else {
    console.log(pc.dim(`[nextpulse] Entry file: ${entryFile}`));
  }

  // Inject into entry file
  try {
    injectIntoEntryFile(entryFile, routerType, props);
    console.log(pc.green(`[nextpulse] Injected NextPulseDev into ${entryFile}`));
  } catch (error: any) {
    throw new Error(`Failed to inject into entry file: ${error?.message || error}`);
  }
  console.log(pc.green("\n[nextpulse] ✓ Init complete!"));
  console.log(pc.dim(`  App: ${projectInfo.packageJson.name || "Next.js App"}`));
  console.log(pc.dim(`  Router: ${routerType}`));
  console.log(pc.dim(`  Next.js: ${projectInfo.nextVersion || "unknown"}`));
}

function getVersion(): string {
  try {
    const packageJsonPath = join(__dirname, "../../package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    return packageJson.version || "0.1.0";
  } catch {
    return "0.1.0";
  }
}

function existsSync(path: string): boolean {
  try {
    require("fs").accessSync(path);
    return true;
  } catch {
    return false;
  }
}

async function selectApp(apps: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log(pc.cyan("\n[nextpulse] Multiple Next.js apps found:"));
    apps.forEach((app, index) => {
      console.log(pc.dim(`  ${index + 1}. ${app}`));
    });

    rl.question(pc.cyan("\nSelect app (1-" + apps.length + "): "), (answer) => {
      rl.close();
      const index = parseInt(answer, 10) - 1;
      if (index >= 0 && index < apps.length) {
        resolve(apps[index]);
      } else {
        console.log(pc.yellow("[nextpulse] Invalid selection, using first app"));
        resolve(apps[0]);
      }
    });
  });
}

