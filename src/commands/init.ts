import path from "path";
import fs from "fs-extra";
import pc from "picocolors";
import {
  detectRouterType,
  findEntryFile,
  getExtensionForEntry,
  patchAppRouterLayout,
  patchPagesRouterApp,
  revertAppRouterLayout,
  revertPagesRouterApp,
  getImportPath,
} from "../utils/ast.js";
import {
  readFileSafe,
  writeFileSmart,
  logAction,
  removeFileSafe,
  ensureDir,
  fileExists,
} from "../utils/fs.js";

interface InitOptions {
  app: string;
  dryRun?: boolean;
  revert?: boolean;
  withDevScript?: boolean;
  force?: boolean;
}

const COMPONENT_TEMPLATE = `"use client";

import { useEffect } from "react";

export default function NextPulseDev() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const port = process.env.NEXT_PUBLIC_NEXTPULSE_PORT || "4000";
    const url = \`http://127.0.0.1:\${port}/api/meta\`;

    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch(url).catch(() => null);
        if (!res || !res.ok) return;
        const meta = await res.json();
        if (!cancelled) {
          window.dispatchEvent(new CustomEvent("nextpulse:meta", { detail: meta }));
          // eslint-disable-next-line no-console
          console.debug("[nextpulse] meta", meta);
        }
      } catch {
        // silent in dev
      }
    }

    tick();
    const id = setInterval(tick, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return null;
}
`;

export async function initCommand(options: InitOptions): Promise<void> {
  const appRoot = path.resolve(options.app);

  if (options.dryRun) {
    console.log(pc.cyan("[nextpulse] Dry run mode - no changes will be written\n"));
  }

  // Detect router type
  const routerType = await detectRouterType(appRoot);
  if (!routerType) {
    throw new Error(
      "Could not detect Next.js app. No app/layout.tsx or pages/_app.tsx found."
    );
  }

  console.log(pc.dim(`Detected ${routerType} router`));

  // Find entry file
  const entryFile = await findEntryFile(appRoot, routerType);
  if (!entryFile) {
    throw new Error(`Could not find entry file for ${routerType} router`);
  }

  const ext = getExtensionForEntry(entryFile);
  const componentFile = path.join(appRoot, `components/nextpulse/NextPulseDev.${ext}`);
  const importPath = getImportPath(entryFile, componentFile);

  if (options.revert) {
    await revertInit(appRoot, entryFile, componentFile, routerType, importPath, options);
    console.log(pc.green("\n[nextpulse] revert complete"));
    return;
  }

  // Create component
  await createComponent(componentFile, ext, options);

  // Patch entry file
  await patchEntryFile(entryFile, routerType, importPath, options);

  // Update env
  await updateEnvFile(appRoot, options);

  // Update dev script if requested
  if (options.withDevScript) {
    await updateDevScript(appRoot, options);
  }

  console.log(pc.green("\n[nextpulse] init complete"));
}

async function createComponent(
  componentFile: string,
  ext: string,
  options: InitOptions
): Promise<void> {
  const action = await writeFileSmart(componentFile, COMPONENT_TEMPLATE, {
    dryRun: options.dryRun,
    force: options.force,
  });
  logAction(action, componentFile, options.dryRun);
}

async function patchEntryFile(
  entryFile: string,
  routerType: "app" | "pages",
  importPath: string,
  options: InitOptions
): Promise<void> {
  const code = await readFileSafe(entryFile);
  if (!code) {
    throw new Error(`Could not read entry file: ${entryFile}`);
  }

  const patchFn = routerType === "app" ? patchAppRouterLayout : patchPagesRouterApp;
  const result = patchFn(code, importPath);

  if (!result.success) {
    // Try string fallback
    console.log(pc.yellow(`AST patching failed (${result.error}), using string fallback`));
    await stringFallbackPatch(entryFile, routerType, importPath, code, options);
    return;
  }

  if (result.alreadyPatched) {
    logAction("skipped", entryFile, options.dryRun);
    return;
  }

  if (result.code && !options.dryRun) {
    await fs.writeFile(entryFile, result.code, "utf-8");
  }

  logAction("patched", entryFile, options.dryRun);
}

async function stringFallbackPatch(
  entryFile: string,
  routerType: "app" | "pages",
  importPath: string,
  code: string,
  options: InitOptions
): Promise<void> {
  const markerStart = "// nextpulse:start";
  const markerEnd = "// nextpulse:end";

  // Check if already patched
  if (code.includes(markerStart)) {
    logAction("skipped", entryFile, options.dryRun);
    return;
  }

  const importLine = `import NextPulseDev from "${importPath}";\n`;
  const jsxBlock = `${markerStart}\n{process.env.NODE_ENV === "development" && <NextPulseDev />}\n${markerEnd}\n`;

  let patched = code;

  // Add import at the top
  if (!code.includes(importLine.trim())) {
    const lines = code.split("\n");
    let insertIndex = 0;
    // Find last import or "use client"
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("import ") || lines[i].includes('"use client"') || lines[i].includes("'use client'")) {
        insertIndex = i + 1;
      }
    }
    lines.splice(insertIndex, 0, importLine.trim());
    patched = lines.join("\n");
  }

  // Add JSX
  if (routerType === "app") {
    // Insert before {children}
    patched = patched.replace(/(\s*)(\{children\})/, `$1${jsxBlock}$1$2`);
  } else {
    // Insert at beginning of return for pages router
    // Handle both: return (...) and return <...>
    if (patched.includes("return (")) {
      patched = patched.replace(/(return\s*\(\s*)/, `$1\n    ${jsxBlock}    `);
    } else {
      // Wrap in fragment if return is direct JSX
      patched = patched.replace(
        /(return\s+)(<[^;]+;)/,
        `$1(\n    <>\n      ${jsxBlock}      $2\n    </>\n  )`
      );
    }
  }

  if (!options.dryRun) {
    await fs.writeFile(entryFile, patched, "utf-8");
  }

  logAction("patched", entryFile, options.dryRun);
}

async function updateEnvFile(appRoot: string, options: InitOptions): Promise<void> {
  const envPath = path.join(appRoot, ".env.local");
  const envExists = await fileExists(envPath);

  if (!envExists) {
    // Create new .env.local
    const content = "NEXT_PUBLIC_NEXTPULSE_PORT=4000\n";
    if (!options.dryRun) {
      await fs.writeFile(envPath, content, "utf-8");
    }
    logAction("created", envPath, options.dryRun);
    return;
  }

  const envContent = await readFileSafe(envPath);
  if (!envContent) return;

  if (envContent.includes("NEXT_PUBLIC_NEXTPULSE_PORT")) {
    logAction("skipped", envPath, options.dryRun);
    return;
  }

  const updated = envContent.endsWith("\n")
    ? envContent + "NEXT_PUBLIC_NEXTPULSE_PORT=4000\n"
    : envContent + "\nNEXT_PUBLIC_NEXTPULSE_PORT=4000\n";

  if (!options.dryRun) {
    await fs.writeFile(envPath, updated, "utf-8");
  }

  logAction("updated", envPath, options.dryRun);
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
  componentFile: string,
  routerType: "app" | "pages",
  importPath: string,
  options: InitOptions
): Promise<void> {
  console.log(pc.cyan("Reverting nextpulse init...\n"));

  // Remove component file
  const removed = await removeFileSafe(componentFile, options.dryRun);
  if (removed) {
    logAction("removed", componentFile, options.dryRun);
  }

  // Revert entry file
  const code = await readFileSafe(entryFile);
  if (code) {
    const revertFn = routerType === "app" ? revertAppRouterLayout : revertPagesRouterApp;
    const result = revertFn(code, importPath);

    if (result.success && result.code) {
      if (!options.dryRun) {
        await fs.writeFile(entryFile, result.code, "utf-8");
      }
      logAction("patched", entryFile, options.dryRun);
    } else if (code.includes("// nextpulse:start")) {
      // String fallback revert
      let reverted = code;
      // Remove import
      const importLine = `import NextPulseDev from "${importPath}";`;
      reverted = reverted.replace(new RegExp(`${importLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`, "g"), "");

      // Remove marked block and unwrap fragment if needed
      reverted = reverted.replace(
        /\/\/ nextpulse:start\n.*?\n\/\/ nextpulse:end\n?/gs,
        ""
      );

      // Unwrap fragment if it was added (for pages router)
      // return (
      //   <>
      //     <Component {...pageProps} />
      //   </>
      // )
      // Should become: return <Component {...pageProps} />
      reverted = reverted.replace(
        /return\s*\(\s*<>\s*(<[^>]+\s+\{\.\.\.pageProps\}\s*\/?>)\s*<\/>\s*\)/s,
        "return $1"
      );

      if (!options.dryRun) {
        await fs.writeFile(entryFile, reverted, "utf-8");
      }
      logAction("patched", entryFile, options.dryRun);
    } else {
      logAction("skipped", entryFile, options.dryRun);
    }
  }

  // Remove empty component directory if it exists
  const componentDir = path.dirname(componentFile);
  if (!options.dryRun) {
    try {
      const files = await fs.readdir(componentDir);
      if (files.length === 0) {
        await fs.remove(componentDir);
        // Also remove components dir if empty
        const componentsDir = path.dirname(componentDir);
        const componentsFiles = await fs.readdir(componentsDir);
        if (componentsFiles.length === 0) {
          await fs.remove(componentsDir);
        }
      }
    } catch {
      // Ignore errors
    }
  }
}
