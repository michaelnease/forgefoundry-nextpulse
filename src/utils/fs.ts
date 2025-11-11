import fs from "fs-extra";
import path from "path";
import pc from "picocolors";

export async function ensureDir(dir: string): Promise<void> {
  await fs.ensureDir(dir);
}

export async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

export async function writeFileSmart(
  filePath: string,
  content: string,
  options: { dryRun?: boolean; force?: boolean } = {}
): Promise<"created" | "updated" | "skipped"> {
  const exists = await fs.pathExists(filePath);

  if (options.dryRun) {
    return exists ? "updated" : "created";
  }

  if (exists) {
    const current = await fs.readFile(filePath, "utf-8");
    if (current === content) {
      return "skipped";
    }
    if (!options.force) {
      // Content differs but force not specified - skip
      return "skipped";
    }
  }

  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf-8");
  return exists ? "updated" : "created";
}

export function logAction(
  action: "created" | "updated" | "skipped" | "patched" | "removed",
  filePath: string,
  dryRun = false
): void {
  const prefix = dryRun ? "[dry-run] " : "";
  const colorMap = {
    created: pc.green,
    updated: pc.yellow,
    skipped: pc.dim,
    patched: pc.cyan,
    removed: pc.red,
  };
  const color = colorMap[action];
  console.log(`${prefix}${color(action.padEnd(10))} ${filePath}`);
}

export async function removeFileSafe(filePath: string, dryRun = false): Promise<boolean> {
  if (dryRun) {
    const exists = await fs.pathExists(filePath);
    return exists;
  }

  try {
    await fs.remove(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  return await fs.pathExists(filePath);
}
