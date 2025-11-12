import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import type { RouterType } from "./projectDetect.js";

const IMPORT_STATEMENT = 'import { NextPulseDev } from "@forged/nextpulse/runtime";';

function getComponentJSX(props: {
  appName?: string;
  nextVersion?: string;
  port?: string;
  gitBranch?: string;
  gitSha?: string;
}): string {
  const propsStr = Object.entries(props)
    .filter(([_, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => {
      // Escape quotes and use single quotes for JSX attributes
      const escaped = String(v).replace(/'/g, "\\'").replace(/"/g, '\\"');
      return `${k}="${escaped}"`;
    })
    .join(" ");
  return `{process.env.NODE_ENV === "development" && <NextPulseDev ${propsStr} />}`;
}

/**
 * Check if file already has the import
 */
export function hasImport(content: string): boolean {
  return content.includes('from "@forged/nextpulse/runtime"') || 
         content.includes("from '@forged/nextpulse/runtime'");
}

/**
 * Check if file already has the component JSX
 */
export function hasComponent(content: string): boolean {
  return content.includes("NextPulseDev") && 
         content.includes("NODE_ENV === \"development\"");
}

/**
 * Inject import into file content
 */
export function injectImport(content: string): string {
  if (hasImport(content)) {
    return content;
  }

  // Try to find existing imports and add after them
  const lines = content.split("\n");
  let lastImportIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("import ") || line.startsWith("import{")) {
      lastImportIndex = i;
    } else if (lastImportIndex >= 0 && line.length === 0) {
      // Found empty line after imports
      break;
    }
  }

  if (lastImportIndex >= 0) {
    lines.splice(lastImportIndex + 1, 0, IMPORT_STATEMENT);
    return lines.join("\n");
  }

  // No imports found, add at the top
  return IMPORT_STATEMENT + "\n" + content;
}

/**
 * Inject component JSX into App Router layout
 */
export function injectIntoAppLayout(content: string, props?: Record<string, string>): string {
  if (hasComponent(content)) {
    return content;
  }

  const componentJSX = getComponentJSX(props || {});

  // Look for <body> tag and inject before closing </body>
  const bodyCloseMatch = content.match(/<\/body>/);
  if (bodyCloseMatch && bodyCloseMatch.index !== undefined) {
    const insertPos = bodyCloseMatch.index;
    const indent = getIndentBefore(content, insertPos);
    return (
      content.slice(0, insertPos) +
      `\n${indent}        ${componentJSX}\n${indent}      ` +
      content.slice(insertPos)
    );
  }

  // Fallback: look for closing tag of root element (html, div, etc.)
  const rootTagMatch = content.match(/<(\w+)[^>]*>[\s\S]*?<\/\1>/);
  if (rootTagMatch) {
    const beforeClose = content.lastIndexOf(`</${rootTagMatch[1]}>`);
    if (beforeClose > 0) {
      const indent = getIndentBefore(content, beforeClose);
      return (
        content.slice(0, beforeClose) +
        `\n${indent}        ${componentJSX}\n${indent}      ` +
        content.slice(beforeClose)
      );
    }
  }

  // Last resort: append before closing brace of return
  const returnMatch = content.match(/return\s*\([\s\S]*?\)/);
  if (returnMatch && returnMatch.index !== undefined) {
    const returnEnd = returnMatch.index + returnMatch[0].length - 1;
    const indent = getIndentBefore(content, returnEnd);
    return (
      content.slice(0, returnEnd) +
      `\n${indent}        ${componentJSX}\n${indent}      ` +
      content.slice(returnEnd)
    );
  }

  return content;
}

/**
 * Inject component JSX into Pages Router _app
 */
export function injectIntoPagesApp(content: string, props?: Record<string, string>): string {
  if (hasComponent(content)) {
    return content;
  }

  const componentJSX = getComponentJSX(props || {});

  // Find <Component ... /> and add after it
  const componentMatch = content.match(/<Component[^/>]*\/>/);
  if (componentMatch && componentMatch.index !== undefined) {
    const insertPos = componentMatch.index + componentMatch[0].length;
    const indent = getIndentBefore(content, insertPos);
    return (
      content.slice(0, insertPos) +
      `\n${indent}        ${componentJSX}\n${indent}      ` +
      content.slice(insertPos)
    );
  }

  // Fallback: find return statement with JSX
  const returnMatch = content.match(/return\s*\([\s\S]*?\)/);
  if (returnMatch && returnMatch.index !== undefined) {
    const returnEnd = returnMatch.index + returnMatch[0].length - 1;
    const indent = getIndentBefore(content, returnEnd);
    return (
      content.slice(0, returnEnd) +
      `\n${indent}        ${componentJSX}\n${indent}      ` +
      content.slice(returnEnd)
    );
  }

  return content;
}

/**
 * Get indentation before a position in content
 */
function getIndentBefore(content: string, pos: number): string {
  const lineStart = content.lastIndexOf("\n", pos - 1) + 1;
  const line = content.slice(lineStart, pos);
  const match = line.match(/^(\s*)/);
  return match ? match[1] : "";
}

/**
 * Inject NextPulseDev into entry file
 */
export function injectIntoEntryFile(
  entryFile: string,
  routerType: RouterType,
  props?: Record<string, string>
): void {
  if (!existsSync(entryFile)) {
    throw new Error(`Entry file not found: ${entryFile}`);
  }

  let content = readFileSync(entryFile, "utf-8");

  // Add import if not present
  if (!hasImport(content)) {
    content = injectImport(content);
  }

  // Add component based on router type if not present
  if (!hasComponent(content)) {
    if (routerType === "app") {
      content = injectIntoAppLayout(content, props);
    } else if (routerType === "pages") {
      content = injectIntoPagesApp(content, props);
    }
  }

  writeFileSync(entryFile, content, "utf-8");
}

/**
 * Create minimal App Router layout if it doesn't exist
 */
export function createMinimalAppLayout(projectRoot: string, props?: Record<string, string>): string {
  const layoutPath = join(projectRoot, "app", "layout.tsx");
  const layoutDir = join(projectRoot, "app");

  if (!existsSync(layoutDir)) {
    require("fs").mkdirSync(layoutDir, { recursive: true });
  }

  const componentJSX = getComponentJSX(props || {});

  const content = `import type { Metadata } from "next";
${IMPORT_STATEMENT}

export const metadata: Metadata = {
  title: "Next.js App",
  description: "Generated by Next.js",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        ${componentJSX}
      </body>
    </html>
  );
}
`;

  writeFileSync(layoutPath, content, "utf-8");
  return layoutPath;
}

