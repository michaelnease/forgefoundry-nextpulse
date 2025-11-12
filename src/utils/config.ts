import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { z } from "zod";

// Keep in sync with nextpulse.config.schema.ts
export const ConfigSchema = z.object({
  enabled: z.boolean().default(true),
  overlayPosition: z.enum(["bottomRight", "bottomLeft", "topRight", "topLeft"]).default("bottomRight"),
  openBrowserOnStart: z.boolean().default(false),
});
export type NextPulseConfig = z.infer<typeof ConfigSchema>;

export const CONFIG_FILENAME = "nextpulse.config.json";

export function readConfig(root: string): NextPulseConfig {
  const path = join(root, CONFIG_FILENAME);
  if (!existsSync(path)) return ConfigSchema.parse({});
  try {
    const json = JSON.parse(readFileSync(path, "utf-8"));
    return ConfigSchema.parse(json);
  } catch {
    // If bad JSON, fall back to defaults
    return ConfigSchema.parse({});
  }
}

export function writeConfig(root: string, cfg: Partial<NextPulseConfig>) {
  const path = join(root, CONFIG_FILENAME);
  const merged = ConfigSchema.parse(cfg);
  writeFileSync(path, JSON.stringify(merged, null, 2) + "\n", "utf-8");
}

export function isEnabled(config: NextPulseConfig): boolean {
  if (process.env.NEXTPULSE_ENABLED === "0" || process.env.NEXTPULSE_ENABLED === "false") {
    return false;
  }
  return config.enabled;
}
