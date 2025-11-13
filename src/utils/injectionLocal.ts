/**
 * Injection utilities for NextPulse package import
 * Injects import from @forgefoundry/nextpulse with ZERO props
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import type { RouterType } from "./projectDetect.js";

// Import from @forgefoundry/nextpulse package
const PACKAGE_IMPORT = 'import { NextPulse } from "@forgefoundry/nextpulse";';

export function hasPackageImport(src: string): boolean {
  return /from\s+["']@forgefoundry\/nextpulse["']/.test(src);
}

export function hasComponent(src: string): boolean {
  return /<NextPulse\b/.test(src);
}

export function insertPackageImport(src: string): string {
  if (hasPackageImport(src)) return src;

  // Insert after last import (if any), else at top
  const importRe = /(^|\n)(import[\s\S]*?;)(?![\s\S]*\bimport\b)/m;
  const line = `${PACKAGE_IMPORT}\n`;
  if (importRe.test(src)) return src.replace(importRe, (m) => m + "\n" + line);
  return line + src;
}

export function insertComponentZeroProps(src: string, router: "app" | "pages"): string {
  if (hasComponent(src)) return src;

  // Zero props - component auto-detects everything
  const dev = `{process.env.NODE_ENV === "development" && <NextPulse />}`;

  if (router === "app") {
    // Try to place before closing </body>
    const bodyClose = /<\/body>/i;
    if (bodyClose.test(src)) return src.replace(bodyClose, `${dev}\n      </body>`);
  }

  // Pages router: wrap the JSX in a fragment and add the component
  if (router === "pages") {
    // Match: return <Component {...pageProps} />;
    const directJsxReturn = /return\s+(<\w+[^>]*>)/m;
    if (directJsxReturn.test(src)) {
      return src.replace(directJsxReturn, (match, jsx) => {
        return `return (\n    <>\n      ${dev}\n      ${jsx}`;
      }).replace(/(<\/\w+>)\s*;/m, "$1\n    </>\n  );");
    }
  }

  // Generic: append inside the returned JSX with parentheses
  return src.replace(/return\s*\(([\s\S]*?)\)\s*;/m, (full, inner) => {
    return full.replace(inner, `${inner}\n    ${dev}`);
  });
}

/**
 * Inject NextPulse with package import and zero props
 * Idempotent: skips if both import and component already exist
 */
export function injectNextPulse(
  entryFile: string,
  routerType: RouterType
): void {
  if (!existsSync(entryFile)) {
    throw new Error(`Entry file not found: ${entryFile}`);
  }

  let content = readFileSync(entryFile, "utf-8");

  // Idempotency check: if both import and component exist, skip
  if (hasPackageImport(content) && hasComponent(content)) {
    return;
  }

  // Add import if not present
  if (!hasPackageImport(content)) {
    content = insertPackageImport(content);
  }

  // Add component based on router type if not present
  if (!hasComponent(content)) {
    if (routerType === "app") {
      content = insertComponentZeroProps(content, "app");
    } else if (routerType === "pages") {
      content = insertComponentZeroProps(content, "pages");
    }
  }

  writeFileSync(entryFile, content, "utf-8");
}

/**
 * Remove NextPulse import and component (for revert)
 */
export function removeNextPulse(entryFile: string): void {
  if (!existsSync(entryFile)) {
    return;
  }

  let content = readFileSync(entryFile, "utf-8");

  // Remove import (both old local and new package imports)
  content = content.replace(/import\s+\{[^}]*NextPulse[^}]*\}\s+from\s+["'][\.\/]*nextpulse\/NextPulseDev["'];?\n?/g, "");
  content = content.replace(/import\s+\{[^}]*NextPulse[^}]*\}\s+from\s+["']@forgefoundry\/nextpulse["'];?\n?/g, "");

  // Remove component
  content = content.replace(/\s*\{process\.env\.NODE_ENV\s*===\s*["']development["']\s*&&\s*<NextPulse\s*\/>\}/g, "");

  writeFileSync(entryFile, content, "utf-8");
}
