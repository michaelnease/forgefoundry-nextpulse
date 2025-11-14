import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Update the dev script in package.json to include --open flag if openBrowserOnStart is true
 */
export function updateDevScriptForBrowser(projectRoot: string, openBrowserOnStart: boolean): void {
  const packageJsonPath = join(projectRoot, "package.json");

  if (!existsSync(packageJsonPath)) {
    return; // No package.json, skip
  }

  try {
    const content = readFileSync(packageJsonPath, "utf-8");
    const pkg = JSON.parse(content);

    if (!pkg.scripts) {
      pkg.scripts = {};
    }

    const devScript = pkg.scripts.dev || "next dev";

    // Check if --open is already present (as a separate flag, not part of another word)
    const hasOpenFlag = /\s--open(\s|$)/.test(devScript);

    if (openBrowserOnStart && !hasOpenFlag) {
      // Add --open flag after "next dev" or at the end
      if (devScript.includes("next dev")) {
        // Insert --open after "next dev"
        pkg.scripts.dev = devScript.replace(/(next dev)(\s|$)/, "$1 --open$2");
      } else {
        // Append --open at the end
        pkg.scripts.dev = `${devScript} --open`;
      }
    } else if (!openBrowserOnStart && hasOpenFlag) {
      // Remove --open flag (as a separate word)
      pkg.scripts.dev = devScript.replace(/\s--open(\s|$)/g, "$1").trim();
    }

    writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
  } catch (error) {
    // Silently fail if we can't update package.json
    // This is not critical functionality
  }
}
