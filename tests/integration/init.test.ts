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

      // Check component was created
      const componentPath = path.join(tempDir, "components/nextpulse/NextPulseDev.tsx");
      expect(await fs.pathExists(componentPath)).toBe(true);

      const componentContent = await fs.readFile(componentPath, "utf-8");
      expect(componentContent).toContain('"use client"');
      expect(componentContent).toContain("export default function NextPulseDev()");

      // Check layout was patched
      const layoutPath = path.join(tempDir, "app/layout.tsx");
      const layoutContent = await fs.readFile(layoutPath, "utf-8");
      expect(layoutContent).toContain('import NextPulseDev from "../components/nextpulse/NextPulseDev"');
      expect(layoutContent).toContain('process.env.NODE_ENV === "development"');
      expect(layoutContent).toContain("<NextPulseDev />");

      // Check env was created
      const envPath = path.join(tempDir, ".env.local");
      const envContent = await fs.readFile(envPath, "utf-8");
      expect(envContent).toContain("NEXT_PUBLIC_NEXTPULSE_PORT=4000");
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
      const importCount = (secondContent.match(/import NextPulseDev/g) || []).length;
      const jsxCount = (secondContent.match(/<NextPulseDev \/>/g) || []).length;
      expect(importCount).toBe(1);
      expect(jsxCount).toBe(1);
    });

    it("should support --dry-run", async () => {
      await setupAppRouter();

      await initCommand({ app: tempDir, dryRun: true });

      // Nothing should be written
      const componentPath = path.join(tempDir, "components/nextpulse/NextPulseDev.tsx");
      expect(await fs.pathExists(componentPath)).toBe(false);

      const layoutPath = path.join(tempDir, "app/layout.tsx");
      const layoutContent = await fs.readFile(layoutPath, "utf-8");
      expect(layoutContent).not.toContain("NextPulseDev");
    });

    it("should support --revert", async () => {
      await setupAppRouter();

      // Init
      await initCommand({ app: tempDir });

      // Verify it was added
      const componentPath = path.join(tempDir, "components/nextpulse/NextPulseDev.tsx");
      expect(await fs.pathExists(componentPath)).toBe(true);

      // Revert
      await initCommand({ app: tempDir, revert: true });

      // Component should be removed
      expect(await fs.pathExists(componentPath)).toBe(false);

      // Layout should be clean
      const layoutPath = path.join(tempDir, "app/layout.tsx");
      const layoutContent = await fs.readFile(layoutPath, "utf-8");
      expect(layoutContent).not.toContain("NextPulseDev");
      expect(layoutContent).not.toContain('import NextPulseDev');
    });

    it("should work with .jsx extension", async () => {
      await setupAppRouter("jsx");

      await initCommand({ app: tempDir });

      // Component should be .jsx
      const componentPath = path.join(tempDir, "components/nextpulse/NextPulseDev.jsx");
      expect(await fs.pathExists(componentPath)).toBe(true);

      // Layout should be patched
      const layoutPath = path.join(tempDir, "app/layout.jsx");
      const layoutContent = await fs.readFile(layoutPath, "utf-8");
      expect(layoutContent).toContain('import NextPulseDev from "../components/nextpulse/NextPulseDev"');
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

      // Check component was created
      const componentPath = path.join(tempDir, "components/nextpulse/NextPulseDev.tsx");
      expect(await fs.pathExists(componentPath)).toBe(true);

      // Check _app was patched
      const appPath = path.join(tempDir, "pages/_app.tsx");
      const appContent = await fs.readFile(appPath, "utf-8");
      expect(appContent).toContain('import NextPulseDev from "../components/nextpulse/NextPulseDev"');
      expect(appContent).toContain('process.env.NODE_ENV === "development"');
      expect(appContent).toContain("<NextPulseDev />");
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
      const importCount = (secondContent.match(/import NextPulseDev/g) || []).length;
      const jsxCount = (secondContent.match(/<NextPulseDev \/>/g) || []).length;
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
      const componentPath = path.join(tempDir, "components/nextpulse/NextPulseDev.tsx");
      expect(await fs.pathExists(componentPath)).toBe(false);

      // _app should be clean
      const appPath = path.join(tempDir, "pages/_app.tsx");
      const appContent = await fs.readFile(appPath, "utf-8");
      expect(appContent).not.toContain("NextPulseDev");
    });
  });

  describe("Environment", () => {
    it("should append to existing .env.local if port not set", async () => {
      await setupAppRouter();
      const envPath = path.join(tempDir, ".env.local");
      await fs.writeFile(envPath, "SOME_VAR=value\n", "utf-8");

      await initCommand({ app: tempDir });

      const envContent = await fs.readFile(envPath, "utf-8");
      expect(envContent).toContain("SOME_VAR=value");
      expect(envContent).toContain("NEXT_PUBLIC_NEXTPULSE_PORT=4000");
    });

    it("should not duplicate port if already set", async () => {
      await setupAppRouter();
      const envPath = path.join(tempDir, ".env.local");
      await fs.writeFile(envPath, "NEXT_PUBLIC_NEXTPULSE_PORT=5000\n", "utf-8");

      await initCommand({ app: tempDir });

      const envContent = await fs.readFile(envPath, "utf-8");
      expect(envContent).toBe("NEXT_PUBLIC_NEXTPULSE_PORT=5000\n");
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
