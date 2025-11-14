import path from "path";
import fs from "fs-extra";
import pc from "picocolors";
import { detectRouterType, findEntryFile } from "../utils/ast.js";
import { logAction, fileExists, readFileSafe } from "../utils/fs.js";
import { generateAndWriteMetadata } from "../utils/metadata.js";
import { generateApiRoutes, removeApiRoutes } from "../utils/generateFiles.js";
import { injectNextPulse, removeNextPulse } from "../utils/injectionLocal.js";
import { updateNextConfig } from "../utils/nextConfig.js";
import { readConfig, writeConfig, type NextPulseConfig } from "../utils/config.js";
import { runInitWizard, isInteractive } from "../utils/wizard.js";

interface InitOptions {
  app?: string;
  dryRun?: boolean;
  revert?: boolean;
  withDevScript?: boolean;
  withWebpack?: boolean;
  force?: boolean;
  yes?: boolean;
  nonInteractive?: boolean;
  overlayPosition?: NextPulseConfig["overlayPosition"];
  openBrowser?: boolean;
  noOpenBrowser?: boolean;
}

export async function initCommand(options: InitOptions): Promise<void> {
  // Determine if we should run interactively
  const shouldRunWizard =
    !options.nonInteractive && !options.yes && isInteractive() && !options.revert;

  // Start with detected or provided app root
  let appRoot = path.resolve(options.app || ".");

  // Run wizard if interactive
  let configOverrides: Partial<NextPulseConfig> = {};
  if (shouldRunWizard) {
    try {
      const detectedRouterType = await detectRouterType(appRoot);
      let existingConfig: Partial<NextPulseConfig> | null = null;
      try {
        const configContent = await readFileSafe(path.join(appRoot, "nextpulse.config.json"));
        if (configContent) {
          existingConfig = JSON.parse(configContent);
        }
      } catch {
        // Ignore parse errors, use null
      }

      const wizardAnswers = await runInitWizard(appRoot, detectedRouterType, existingConfig);

      appRoot = path.resolve(wizardAnswers.appRoot);
      configOverrides = {
        overlayPosition: wizardAnswers.overlayPosition,
        openBrowserOnStart: wizardAnswers.openBrowserOnStart,
      };
    } catch (error: any) {
      // If wizard fails, continue with defaults
      console.warn(
        pc.yellow(`[nextpulse] warn: Wizard failed: ${error?.message || error}. Using defaults.`)
      );
    }
  } else {
    // Non-interactive: apply flags
    if (options.overlayPosition) {
      configOverrides.overlayPosition = options.overlayPosition;
    }
    if (options.openBrowser !== undefined) {
      configOverrides.openBrowserOnStart = options.openBrowser;
    } else if (options.noOpenBrowser !== undefined) {
      configOverrides.openBrowserOnStart = false;
    }
  }

  if (options.dryRun) {
    console.log(pc.cyan("[nextpulse] Dry run mode - no changes will be written\n"));
  }

  // Detect router type
  const routerType = await detectRouterType(appRoot);
  if (!routerType) {
    throw new Error(
      `[nextpulse] error: Could not find a Next.js app. Please run \`nextpulse init\` from your Next.js project root or provide \`--app <appDir>\`.\n` +
        `  Expected to find either:\n` +
        `    - app/layout.tsx (App Router)\n` +
        `    - pages/_app.tsx (Pages Router)`
    );
  }

  console.log(pc.dim(`[nextpulse] info: Detected ${routerType} router`));

  // Find entry file
  const entryFile = await findEntryFile(appRoot, routerType);
  if (!entryFile) {
    const expectedPath =
      routerType === "app"
        ? path.join(appRoot, "app/layout.tsx") + " or " + path.join(appRoot, "app/layout.jsx")
        : path.join(appRoot, "pages/_app.tsx") + " or " + path.join(appRoot, "pages/_app.jsx");
    throw new Error(
      `[nextpulse] error: Expected to find a ${routerType === "app" ? "layout.tsx" : "_app.tsx"} at ${expectedPath}.\n` +
        `  Please check your app directory or pass \`--app\` to point to the correct location.`
    );
  }

  if (options.revert) {
    await revertInit(appRoot, entryFile, routerType, options);
    console.log(pc.green("\n[nextpulse] revert complete"));
    return;
  }

  // 1. Generate .nextpulse/metadata.json
  const { metadata } = generateAndWriteMetadata(appRoot, {
    dryRun: options.dryRun,
    force: options.force,
  });

  // 2. Generate API routes
  const routeResults = generateApiRoutes(appRoot, routerType, {
    dryRun: options.dryRun,
    force: options.force,
  });

  // Check for conflicts (skipped files without force)
  const conflicts = routeResults.filter((r) => r.action === "skipped");
  if (conflicts.length > 0 && !options.force) {
    console.warn(
      pc.yellow(
        `[nextpulse] warn: Found ${conflicts.length} existing API route file(s) that would be overwritten:\n` +
          conflicts.map((r) => `    - ${r.file}`).join("\n") +
          `\n  Pass \`--force\` to overwrite these files, or manually remove them first.`
      )
    );
  }

  // 3. Inject <NextPulse /> into entry file
  if (!options.dryRun) {
    try {
      injectNextPulse(entryFile, routerType);
      logAction("patched", entryFile, false);
    } catch (error) {
      console.error(pc.red(`[nextpulse] Failed to inject into ${entryFile}: ${error}`));
    }
  } else {
    console.log(pc.dim(`[dry-run] patched ${entryFile}`));
  }

  // 4. Optional: Update next.config.js with webpack DefinePlugin
  if (options.withWebpack) {
    try {
      updateNextConfig(appRoot, metadata, { dryRun: options.dryRun });
    } catch (error) {
      console.log(pc.yellow(`[nextpulse] Failed to update next.config.js: ${error}`));
    }
  }

  // 5. Update dev script if requested
  if (options.withDevScript) {
    await updateDevScript(appRoot, options);
  }

  // 6. Write config file with user choices or defaults
  if (!options.dryRun) {
    const existingConfig = readConfig(appRoot);
    const finalConfig = { ...existingConfig, ...configOverrides };
    const configPath = path.join(appRoot, "nextpulse.config.json");
    const configExists = await fileExists(configPath);

    writeConfig(appRoot, finalConfig);

    if (!configExists) {
      console.log(pc.green(`[nextpulse] created ${configPath}`));
    }
  }

  console.log(pc.green("\n[nextpulse] init complete"));
}

async function updateDevScript(appRoot: string, options: InitOptions): Promise<void> {
  const pkgPath = path.join(appRoot, "package.json");
  const pkgContent = await readFileSafe(pkgPath);

  if (!pkgContent) {
    console.log(pc.yellow("package.json not found, skipping dev script update"));
    return;
  }

  const pkg = JSON.parse(pkgContent);

  if (!pkg.scripts) {
    pkg.scripts = {};
  }

  // Check if already configured
  if (pkg.scripts["dev:pulse"] && pkg.scripts["dev:next"]) {
    logAction("skipped", pkgPath, options.dryRun);
    return;
  }

  // Move existing dev to dev:next if exists
  if (pkg.scripts.dev && !pkg.scripts["dev:next"]) {
    pkg.scripts["dev:next"] = pkg.scripts.dev;
  } else if (!pkg.scripts["dev:next"]) {
    pkg.scripts["dev:next"] = "next dev";
  }

  // Add dev:pulse
  pkg.scripts["dev:pulse"] = "nextpulse --no-open";

  // Set dev to use concurrently
  pkg.scripts.dev = 'concurrently -n next,pulse -c auto "npm:dev:next" "npm:dev:pulse"';

  // Ensure concurrently is in devDependencies
  if (!pkg.devDependencies) {
    pkg.devDependencies = {};
  }
  if (!pkg.devDependencies.concurrently && !pkg.dependencies?.concurrently) {
    pkg.devDependencies.concurrently = "^8.2.2";
  }

  if (!options.dryRun) {
    await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
  }

  logAction("updated", pkgPath, options.dryRun);
}

async function revertInit(
  appRoot: string,
  entryFile: string,
  routerType: "app" | "pages",
  options: InitOptions
): Promise<void> {
  console.log(pc.cyan("Reverting nextpulse init...\n"));

  // Remove NextPulse injection from entry file
  if (!options.dryRun) {
    try {
      removeNextPulse(entryFile);
      logAction("patched", entryFile, false);
    } catch (error) {
      console.error(pc.red(`[nextpulse] Failed to remove injection from ${entryFile}: ${error}`));
    }
  } else {
    console.log(pc.dim(`[dry-run] patched ${entryFile}`));
  }

  // Remove API routes
  removeApiRoutes(appRoot, routerType, { dryRun: options.dryRun });

  // Remove .nextpulse/metadata.json
  const metadataPath = path.join(appRoot, ".nextpulse/metadata.json");
  if (await fileExists(metadataPath)) {
    if (!options.dryRun) {
      await fs.remove(metadataPath);
    }
    logAction("removed", metadataPath, options.dryRun);

    // Try to remove .nextpulse directory if empty
    if (!options.dryRun) {
      try {
        const nextpulseDir = path.dirname(metadataPath);
        const files = await fs.readdir(nextpulseDir);
        if (files.length === 0) {
          await fs.remove(nextpulseDir);
          console.log(pc.red(`[nextpulse] removed .nextpulse/ directory`));
        }
      } catch {
        // Ignore errors
      }
    }
  }
}
