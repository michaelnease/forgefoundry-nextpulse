/**
 * Utilities for updating next.config.js with webpack DefinePlugin
 */

import { join } from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";
import pc from "picocolors";
import type { MetadataFile } from "./metadata.js";

/**
 * Check if next.config.js or next.config.ts exists
 */
export function findNextConfig(projectRoot: string): string | null {
  const jsPath = join(projectRoot, "next.config.js");
  const tsPath = join(projectRoot, "next.config.ts");
  const mjsPath = join(projectRoot, "next.config.mjs");

  if (existsSync(tsPath)) return tsPath;
  if (existsSync(jsPath)) return jsPath;
  if (existsSync(mjsPath)) return mjsPath;

  return null;
}

/**
 * Generate webpack DefinePlugin code snippet
 */
function generateDefinePluginSnippet(metadata: MetadataFile): string {
  return `
    // NextPulse: Inject metadata as environment variables
    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.DefinePlugin({
        'process.env.NEXT_PUBLIC_NP_APP_NAME': JSON.stringify('${metadata.appName}'),
        'process.env.NEXT_PUBLIC_NP_NEXT_VERSION': JSON.stringify('${metadata.nextVersion}'),
        'process.env.NEXT_PUBLIC_NP_GIT_BRANCH': JSON.stringify('${metadata.gitBranch}'),
        'process.env.NEXT_PUBLIC_NP_GIT_SHA': JSON.stringify('${metadata.gitSha}'),
        'process.env.NEXT_PUBLIC_NP_GIT_DIRTY': JSON.stringify('${metadata.gitDirty}'),
        'process.env.NEXT_PUBLIC_NP_PORT': JSON.stringify('${metadata.port}'),
      })
    );`;
}

/**
 * Check if next.config already has NextPulse webpack config
 */
function hasNextPulseWebpackConfig(content: string): boolean {
  return content.includes("NextPulse: Inject metadata") || content.includes("NEXT_PUBLIC_NP_");
}

/**
 * Update next.config.js with webpack DefinePlugin
 */
export function updateNextConfig(
  projectRoot: string,
  metadata: MetadataFile,
  options?: { dryRun?: boolean; force?: boolean }
): "created" | "updated" | "skipped" | "not_found" {
  const configPath = findNextConfig(projectRoot);

  if (!configPath) {
    return "not_found";
  }

  let content = readFileSync(configPath, "utf-8");

  // Skip if already has NextPulse config and not force
  if (hasNextPulseWebpackConfig(content) && !options?.force) {
    return "skipped";
  }

  // Determine file type
  const isTypeScript = configPath.endsWith(".ts");
  const isESM = configPath.endsWith(".mjs") || content.includes("export default");

  // Check if webpack import exists
  const hasWebpackImport = content.includes("import webpack from") || content.includes("const webpack = require");

  // Add webpack import if needed
  if (!hasWebpackImport) {
    if (isESM || isTypeScript) {
      content = `import webpack from "webpack";\n${content}`;
    } else {
      content = `const webpack = require("webpack");\n${content}`;
    }
  }

  // Find where to inject the DefinePlugin
  // Look for webpack: function or webpack: (config) =>
  const webpackFunctionRegex = /webpack\s*:\s*(?:function\s*)?\(\s*config[^)]*\)\s*(?:=>)?\s*\{/;
  const match = content.match(webpackFunctionRegex);

  if (match) {
    // Inject after the opening brace of webpack function
    const insertPosition = match.index! + match[0].length;
    const snippet = generateDefinePluginSnippet(metadata);
    content = content.slice(0, insertPosition) + snippet + content.slice(insertPosition);
  } else {
    // No webpack function exists, add one
    const snippet = generateDefinePluginSnippet(metadata);

    // Find the config object
    const configObjectRegex = /const\s+\w+Config(?:\s*:\s*\w+)?\s*=\s*\{/;
    const configMatch = content.match(configObjectRegex);

    if (configMatch) {
      // Add webpack function to config object
      const insertPosition = configMatch.index! + configMatch[0].length;
      const webpackFunction = `
  webpack: (config) => {${snippet}
    return config;
  },
  // Silence Next.js 16 Turbopack warning when using webpack config
  turbopack: {},`;
      content = content.slice(0, insertPosition) + webpackFunction + content.slice(insertPosition);
    } else {
      console.warn(pc.yellow("[nextpulse] Could not find config object in next.config. Skipping webpack injection."));
      return "skipped";
    }
  }

  if (options?.dryRun) {
    console.log(pc.dim(`[dry-run] updated ${configPath}`));
    return "updated";
  }

  writeFileSync(configPath, content, "utf-8");
  console.log(pc.green(`[nextpulse] updated ${configPath.replace(projectRoot, ".")}`));

  return "updated";
}

/**
 * Remove NextPulse webpack config from next.config
 */
export function removeNextPulseFromConfig(
  projectRoot: string,
  options?: { dryRun?: boolean }
): "updated" | "skipped" | "not_found" {
  const configPath = findNextConfig(projectRoot);

  if (!configPath) {
    return "not_found";
  }

  let content = readFileSync(configPath, "utf-8");

  if (!hasNextPulseWebpackConfig(content)) {
    return "skipped";
  }

  // Remove the NextPulse DefinePlugin block
  content = content.replace(/\s*\/\/ NextPulse: Inject metadata[\s\S]*?}\);/g, "");

  // Remove webpack import if it's the only one using it
  if (!content.includes("webpack.")) {
    content = content.replace(/import webpack from ["']webpack["'];\n?/g, "");
    content = content.replace(/const webpack = require\(["']webpack["']\);\n?/g, "");
  }

  if (options?.dryRun) {
    console.log(pc.dim(`[dry-run] removed NextPulse config from ${configPath}`));
    return "updated";
  }

  writeFileSync(configPath, content, "utf-8");
  console.log(pc.green(`[nextpulse] removed NextPulse config from ${configPath.replace(projectRoot, ".")}`));

  return "updated";
}
