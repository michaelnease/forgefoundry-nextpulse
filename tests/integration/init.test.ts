import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { initCommand } from "../../src/commands/init.js";

describe("nextpulse init", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nextpulse-test-"));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  async function setupAppRouter(ext: "tsx" | "jsx" = "tsx") {
    const appDir = path.join(tempDir, "app");
    await fs.ensureDir(appDir);
    const layoutFile = path.join(appDir, `layout.${ext}`);
    await fs.writeFile(
      layoutFile,
      `export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
      "utf-8"
    );
    await fs.writeFile(
      path.join(tempDir, "package.json"),
      JSON.stringify({ name: "test-app", scripts: { dev: "next dev" } }, null, 2),
      "utf-8"
    );
  }

  async function setupPagesRouter(ext: "tsx" | "jsx" = "tsx") {
    const pagesDir = path.join(tempDir, "pages");
    await fs.ensureDir(pagesDir);
    const appFile = path.join(pagesDir, `_app.${ext}`);
    await fs.writeFile(
      appFile,
      `import type { AppProps } from "next/app";

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
`,
      "utf-8"
    );
    await fs.writeFile(
      path.join(tempDir, "package.json"),
      JSON.stringify({ name: "test-app", scripts: { dev: "next dev" } }, null, 2),
      "utf-8"
    );
  }

  describe("App Router", () => {
    it("should create component and patch layout.tsx", async () => {
      await setupAppRouter();

      await initCommand({ app: tempDir });

      // Check NO component was created in user's project
      const componentPath = path.join(tempDir, "components/nextpulse/NextPulse.tsx");
      expect(await fs.pathExists(componentPath)).toBe(false);

      // Check layout was patched with package import
      const layoutPath = path.join(tempDir, "app/layout.tsx");
      const layoutContent = await fs.readFile(layoutPath, "utf-8");
      expect(layoutContent).toContain('import { NextPulse } from "@forgefoundry/nextpulse"');
      expect(layoutContent).toContain('process.env.NODE_ENV === "development"');
      expect(layoutContent).toContain("<NextPulse />");

      // Check .nextpulse/metadata.json was created
      const metadataPath = path.join(tempDir, ".nextpulse/metadata.json");
      expect(await fs.pathExists(metadataPath)).toBe(true);

      // Check API routes were created
      expect(await fs.pathExists(path.join(tempDir, "app/api/nextpulse/metadata/route.ts"))).toBe(true);
      expect(await fs.pathExists(path.join(tempDir, "app/api/nextpulse/config/route.ts"))).toBe(true);
    });

    it("should be idempotent on re-run", async () => {
      await setupAppRouter();

      // First run
      await initCommand({ app: tempDir });

      const layoutPath = path.join(tempDir, "app/layout.tsx");
      const firstContent = await fs.readFile(layoutPath, "utf-8");

      // Second run
      await initCommand({ app: tempDir });

      const secondContent = await fs.readFile(layoutPath, "utf-8");
      expect(secondContent).toBe(firstContent);

      // Check no duplicate imports or JSX
      const importCount = (secondContent.match(/import\s+\{\s*NextPulse\s*\}/g) || []).length;
      const jsxCount = (secondContent.match(/<NextPulse\s*\/>/g) || []).length;
      expect(importCount).toBe(1);
      expect(jsxCount).toBe(1);
    });

    it("should support --dry-run", async () => {
      await setupAppRouter();

      await initCommand({ app: tempDir, dryRun: true });

      // Nothing should be written
      const componentPath = path.join(tempDir, "components/nextpulse/NextPulse.tsx");
      expect(await fs.pathExists(componentPath)).toBe(false);

      const layoutPath = path.join(tempDir, "app/layout.tsx");
      const layoutContent = await fs.readFile(layoutPath, "utf-8");
      expect(layoutContent).not.toContain("NextPulse");
    });

    it("should support --revert", async () => {
      await setupAppRouter();

      // Init
      await initCommand({ app: tempDir });

      // Verify metadata and API routes were added
      const metadataPath = path.join(tempDir, ".nextpulse/metadata.json");
      expect(await fs.pathExists(metadataPath)).toBe(true);
      expect(await fs.pathExists(path.join(tempDir, "app/api/nextpulse/metadata/route.ts"))).toBe(true);

      // Revert
      await initCommand({ app: tempDir, revert: true });

      // Metadata and API routes should be removed
      expect(await fs.pathExists(metadataPath)).toBe(false);
      expect(await fs.pathExists(path.join(tempDir, "app/api/nextpulse/metadata/route.ts"))).toBe(false);

      // Layout should be clean
      const layoutPath = path.join(tempDir, "app/layout.tsx");
      const layoutContent = await fs.readFile(layoutPath, "utf-8");
      expect(layoutContent).not.toContain("NextPulse");
      expect(layoutContent).not.toContain('import { NextPulse }');
    });

    it("should work with .jsx extension", async () => {
      await setupAppRouter("jsx");

      await initCommand({ app: tempDir });

      // Layout should be patched with package import
      const layoutPath = path.join(tempDir, "app/layout.jsx");
      const layoutContent = await fs.readFile(layoutPath, "utf-8");
      expect(layoutContent).toContain('import { NextPulse } from "@forgefoundry/nextpulse"');
    });

    it("should update package.json with --with-dev-script", async () => {
      await setupAppRouter();

      await initCommand({ app: tempDir, withDevScript: true });

      const pkgPath = path.join(tempDir, "package.json");
      const pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));

      expect(pkg.scripts["dev:next"]).toBe("next dev");
      expect(pkg.scripts["dev:pulse"]).toBe("nextpulse --no-open");
      expect(pkg.scripts.dev).toContain("concurrently");
      expect(pkg.devDependencies?.concurrently).toBeTruthy();
    });
  });

  describe("Pages Router", () => {
    it("should create component and patch _app.tsx", async () => {
      await setupPagesRouter();

      await initCommand({ app: tempDir });

      // Check NO component was created in user's project
      const componentPath = path.join(tempDir, "components/nextpulse/NextPulse.tsx");
      expect(await fs.pathExists(componentPath)).toBe(false);

      // Check _app was patched with package import
      const appPath = path.join(tempDir, "pages/_app.tsx");
      const appContent = await fs.readFile(appPath, "utf-8");
      expect(appContent).toContain('import { NextPulse } from "@forgefoundry/nextpulse"');
      expect(appContent).toContain('process.env.NODE_ENV === "development"');
      expect(appContent).toContain("<NextPulse />");

      // Check API routes were created
      expect(await fs.pathExists(path.join(tempDir, "pages/api/nextpulse/metadata.ts"))).toBe(true);
      expect(await fs.pathExists(path.join(tempDir, "pages/api/nextpulse/config.ts"))).toBe(true);
    });

    it("should be idempotent on re-run", async () => {
      await setupPagesRouter();

      // First run
      await initCommand({ app: tempDir });

      const appPath = path.join(tempDir, "pages/_app.tsx");
      const firstContent = await fs.readFile(appPath, "utf-8");

      // Second run
      await initCommand({ app: tempDir });

      const secondContent = await fs.readFile(appPath, "utf-8");
      expect(secondContent).toBe(firstContent);

      // Check no duplicate imports or JSX
      const importCount = (secondContent.match(/import\s+\{\s*NextPulse\s*\}/g) || []).length;
      const jsxCount = (secondContent.match(/<NextPulse\s*\/>/g) || []).length;
      expect(importCount).toBe(1);
      expect(jsxCount).toBe(1);
    });

    it("should support --revert", async () => {
      await setupPagesRouter();

      // Init
      await initCommand({ app: tempDir });

      // Revert
      await initCommand({ app: tempDir, revert: true });

      // Component should be removed
      const componentPath = path.join(tempDir, "components/nextpulse/NextPulse.tsx");
      expect(await fs.pathExists(componentPath)).toBe(false);

      // _app should be clean
      const appPath = path.join(tempDir, "pages/_app.tsx");
      const appContent = await fs.readFile(appPath, "utf-8");
      expect(appContent).not.toContain("NextPulse");
    });
  });

  describe("Environment", () => {
    it("should not create .env.local (deprecated)", async () => {
      await setupAppRouter();
      const envPath = path.join(tempDir, ".env.local");

      await initCommand({ app: tempDir });

      // .env.local is no longer created by init
      expect(await fs.pathExists(envPath)).toBe(false);
    });
  });

  describe("Error handling", () => {
    it("should throw if no Next.js app detected", async () => {
      // Empty temp dir with no app or pages folder
      await expect(initCommand({ app: tempDir })).rejects.toThrow(
        "Could not detect Next.js app"
      );
    });
  });
});
