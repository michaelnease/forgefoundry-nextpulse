import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { z } from "zod";
import pc from "picocolors";

// Keep in sync with nextpulse.config.schema.ts
export const ConfigSchema = z.object({
  enabled: z.boolean().default(true),
  overlayPosition: z
    .enum(["bottomRight", "bottomLeft", "topRight", "topLeft"])
    .default("bottomRight"),
  openBrowserOnStart: z.boolean().default(false),
});
export type NextPulseConfig = z.infer<typeof ConfigSchema>;

export const CONFIG_FILENAME = "nextpulse.config.json";

/**
 * Normalize config, applying defaults and handling invalid values gracefully
 */
export function normalizeConfig(raw: unknown): NextPulseConfig {
  try {
    return ConfigSchema.parse(raw);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Log warnings for invalid fields but continue with defaults
      const invalidFields = error.errors.map((e) => e.path.join(".")).join(", ");
      console.warn(
        pc.yellow(
          `[nextpulse] warn: Invalid config values for: ${invalidFields}. Using defaults for these fields.`
        )
      );
    }
    // Fall back to defaults
    return ConfigSchema.parse({});
  }
}

/**
 * Read config file with graceful error handling
 */
export function readConfig(root: string): NextPulseConfig {
  const configPath = join(root, CONFIG_FILENAME);

  if (!existsSync(configPath)) {
    return ConfigSchema.parse({});
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const json = JSON.parse(content);
    return normalizeConfig(json);
  } catch (error: any) {
    if (error instanceof SyntaxError) {
      // Malformed JSON
      console.warn(
        pc.yellow(
          `[nextpulse] warn: ${CONFIG_FILENAME} contains invalid JSON. Using default configuration.`
        )
      );
    } else {
      // Other read errors
      console.warn(
        pc.yellow(
          `[nextpulse] warn: Failed to read ${CONFIG_FILENAME}: ${error?.message || "Unknown error"}. Using default configuration.`
        )
      );
    }
    return ConfigSchema.parse({});
  }
}

/**
 * Write config file with normalized values
 */
export function writeConfig(root: string, cfg: Partial<NextPulseConfig>): void {
  const configPath = join(root, CONFIG_FILENAME);
  const normalized = normalizeConfig(cfg);
  // Always write with 2-space indentation for readability
  writeFileSync(configPath, JSON.stringify(normalized, null, 2) + "\n", "utf-8");
}

/**
 * Check if NextPulse is enabled (respects env override)
 */
export function isEnabled(config: NextPulseConfig): boolean {
  if (process.env.NEXTPULSE_ENABLED === "0" || process.env.NEXTPULSE_ENABLED === "false") {
    return false;
  }
  return config.enabled;
}
