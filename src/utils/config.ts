import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { nextpulseConfigSchema, defaultConfig, type NextPulseConfig } from "../nextpulse.config.schema.js";

const CONFIG_FILE = "nextpulse.config.json";

/**
 * Read config file from project root
 */
export function readConfig(projectRoot: string): NextPulseConfig {
  const configPath = join(projectRoot, CONFIG_FILE);

  if (!existsSync(configPath)) {
    return defaultConfig;
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(content);
    return nextpulseConfigSchema.parse(parsed);
  } catch (error) {
    console.warn(`Failed to parse ${CONFIG_FILE}, using defaults:`, error);
    return defaultConfig;
  }
}

/**
 * Write config file to project root
 */
export function writeConfig(projectRoot: string, config: Partial<NextPulseConfig> = {}): void {
  const configPath = join(projectRoot, CONFIG_FILE);
  const currentConfig = existsSync(configPath) ? readConfig(projectRoot) : defaultConfig;
  const mergedConfig = { ...currentConfig, ...config };
  const validated = nextpulseConfigSchema.parse(mergedConfig);

  writeFileSync(configPath, JSON.stringify(validated, null, 2) + "\n", "utf-8");
}

/**
 * Check if NextPulse is enabled (respects env var)
 */
export function isEnabled(config: NextPulseConfig): boolean {
  if (process.env.NEXTPULSE_ENABLED === "0" || process.env.NEXTPULSE_ENABLED === "false") {
    return false;
  }
  return config.enabled;
}

