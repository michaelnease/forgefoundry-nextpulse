#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { readFileSync, existsSync as fsExists } from "fs";
import { fileURLToPath } from "url";
import { join, resolve, dirname } from "path";
import { createInterface } from "readline";

import {
  findProjectRoot,
  detectRouterType,
  getEntryFile,
  getProjectInfo,
  findMonorepoApps,
  type RouterType,
} from "../utils/projectDetect.js";
import {
  injectIntoEntryFile,
  createMinimalAppLayout,
} from "../utils/injection.js";
import { readConfig, writeConfig, isEnabled } from "../utils/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type InitOptions = {
  path: string;
  yes?: boolean;
};

const program = new Command();

program
  .name("nextpulse")
  .description("Developer diagnostics and metadata tools for Next.js apps")
  .version(getVersion());

program
  .command("init")
  .description(
    "Inject NextPulseDev into a Next.js app for dev-only runtime visibility"
  )
  .option("--path <appDir>", "path to Next.js app root", ".")
  .option("--yes", "suppress prompts and pick first detected app")
  .action(async (options: InitOptions) => {
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

async function initCommand(options: InitOptions) {
  const startPath = resolve(options.path ?? ".");
  const projectRoot = findProjectRoot(startPath);

  if (!projectRoot) {
    throw new Error(
      "Could not find project root (package.json and .git required)"
    );
  }

  console.log(pc.cyan(`[nextpulse] Found project root: ${projectRoot}`));

  // Pick target app root (monorepo aware)
  const monorepoApps = findMonorepoApps(projectRoot);
  const nonInteractive =
    process.env.CI === "true" || !process.stdin.isTTY || !!options.yes;

  let targetRoot = projectRoot;
  if (monorepoApps.length > 0) {
    if (nonInteractive) {
      targetRoot = monorepoApps[0];
      console.log(pc.dim(`[nextpulse] Using first app: ${targetRoot}`));
    } else {
      const selected = await selectApp(monorepoApps);
      targetRoot = selected ?? monorepoApps[0];
      console.log(pc.dim(`[nextpulse] Selected: ${targetRoot}`));
    }
  }

  // Detect router type, scaffold if missing
  let routerType: RouterType = detectRouterType(targetRoot);
  if (!routerType) {
    console.log(
      pc.yellow("[nextpulse] No router detected, creating minimal App Router layout...")
    );
    const layoutRel = createMinimalAppLayout(targetRoot, {});
    routerType = "app";
    console.log(pc.green(`[nextpulse] Created ${layoutRel}`));
  } else {
    console.log(pc.dim(`[nextpulse] Detected ${routerType} router`));
  }

  // Project info and config
  const projectInfo = getProjectInfo(targetRoot);

  const configPath = join(targetRoot, "nextpulse.config.json");
  let config = readConfig(targetRoot);
  if (!fsExists(configPath)) {
    writeConfig(targetRoot, config);
    console.log(pc.green("[nextpulse] Created nextpulse.config.json"));
    // read back to normalize defaults
    config = readConfig(targetRoot);
  }

  if (!isEnabled(config)) {
    console.log(
      pc.yellow(
        "[nextpulse] NextPulse is disabled in config or NEXTPULSE_ENABLED=0. Skipping injection."
      )
    );
    return;
  }

  // Props for the Dev overlay
  const props: Record<string, string> = {};
  if (projectInfo.packageJson.name) props.appName = projectInfo.packageJson.name;
  if (projectInfo.nextVersion) props.nextVersion = projectInfo.nextVersion;
  if (projectInfo.port) props.port = projectInfo.port;
  if (projectInfo.gitBranch) props.gitBranch = projectInfo.gitBranch;
  if (projectInfo.gitSha) props.gitSha = projectInfo.gitSha;

  // Locate or create entry file, resolve to absolute path for injection
  let entryRel = getEntryFile(targetRoot, routerType);
  let entryAbs: string | null = entryRel ? resolve(targetRoot, entryRel) : null;

  if (!entryAbs) {
    if (routerType === "app") {
      const createdRel = createMinimalAppLayout(targetRoot, props);
      entryAbs = resolve(targetRoot, createdRel);
      entryRel = createdRel;
      console.log(pc.green(`[nextpulse] Created ${createdRel}`));
    } else {
      throw new Error(
        "Could not find entry file and cannot create one for Pages Router"
      );
    }
  } else {
    console.log(pc.dim(`[nextpulse] Entry file: ${entryRel}`));
  }

  // Inject import + guarded component
  try {
    injectIntoEntryFile(entryAbs, routerType, props);
    console.log(pc.green(`[nextpulse] Injected NextPulseDev into ${entryRel}`));
    console.log(
      pc.dim(
        `  Guard: process.env.NODE_ENV === "development" && <NextPulseDev />`
      )
    );
  } catch (error: any) {
    throw new Error(
      `Failed to inject into entry file: ${error?.message || error}`
    );
  }

  console.log(pc.green("\n[nextpulse] ✓ Init complete!"));
  console.log(pc.dim(`  App: ${projectInfo.packageJson.name || "Next.js App"}`));
  console.log(pc.dim(`  Router: ${routerType}`));
  console.log(pc.dim(`  Next.js: ${projectInfo.nextVersion || "unknown"}`));
}

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

async function selectApp(apps: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log(pc.cyan("\n[nextpulse] Multiple Next.js apps found:"));
    apps.forEach((app, idx) => {
      console.log(pc.dim(`  ${idx + 1}. ${app}`));
    });

    rl.question(pc.cyan(`\nSelect app (1-${apps.length}): `), (answer) => {
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
