import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { generateApiRoutes, removeApiRoutes } from "../src/utils/generateFiles.js";

describe("generateFiles", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nextpulse-gen-test-"));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it("should generate App Router API routes", async () => {
    const results = generateApiRoutes(tempDir, "app");

    expect(results).toHaveLength(6);
    expect(results.every((r) => r.action === "created")).toBe(true);

    // Check files exist
    expect(await fs.pathExists(path.join(tempDir, "app/api/nextpulse/metadata/route.ts"))).toBe(
      true
    );
    expect(await fs.pathExists(path.join(tempDir, "app/api/nextpulse/config/route.ts"))).toBe(true);
    expect(await fs.pathExists(path.join(tempDir, "app/api/nextpulse/runtime/route.ts"))).toBe(
      true
    );
    expect(await fs.pathExists(path.join(tempDir, "app/api/nextpulse/bundles/route.ts"))).toBe(
      true
    );
    expect(await fs.pathExists(path.join(tempDir, "app/api/nextpulse/errors/route.ts"))).toBe(true);
    expect(await fs.pathExists(path.join(tempDir, "app/api/nextpulse/diagnostics/route.ts"))).toBe(
      true
    );
  });

  it("should generate Pages Router API routes", async () => {
    const results = generateApiRoutes(tempDir, "pages");

    expect(results).toHaveLength(6);
    expect(results.every((r) => r.action === "created")).toBe(true);

    // Check files exist
    expect(await fs.pathExists(path.join(tempDir, "pages/api/nextpulse/metadata.ts"))).toBe(true);
    expect(await fs.pathExists(path.join(tempDir, "pages/api/nextpulse/config.ts"))).toBe(true);
    expect(await fs.pathExists(path.join(tempDir, "pages/api/nextpulse/runtime.ts"))).toBe(true);
    expect(await fs.pathExists(path.join(tempDir, "pages/api/nextpulse/bundles.ts"))).toBe(true);
    expect(await fs.pathExists(path.join(tempDir, "pages/api/nextpulse/errors.ts"))).toBe(true);
    expect(await fs.pathExists(path.join(tempDir, "pages/api/nextpulse/diagnostics.ts"))).toBe(
      true
    );
  });

  it("should skip existing files without force", async () => {
    // First generation
    generateApiRoutes(tempDir, "app");

    // Second generation
    const results = generateApiRoutes(tempDir, "app");

    expect(results.every((r) => r.action === "skipped")).toBe(true);
  });

  it("should overwrite with force option", async () => {
    // First generation
    generateApiRoutes(tempDir, "app");

    // Modify a file
    await fs.writeFile(
      path.join(tempDir, "app/api/nextpulse/metadata/route.ts"),
      "// modified content",
      "utf-8"
    );

    // Second generation with force
    const results = generateApiRoutes(tempDir, "app", { force: true });

    const metadataResult = results.find((r) => r.file === "app/api/nextpulse/metadata/route.ts");
    expect(metadataResult?.action).toBe("updated");

    // File should be restored
    const content = await fs.readFile(
      path.join(tempDir, "app/api/nextpulse/metadata/route.ts"),
      "utf-8"
    );
    expect(content).not.toBe("// modified content");
  });

  it("should remove App Router API routes", async () => {
    generateApiRoutes(tempDir, "app");

    expect(await fs.pathExists(path.join(tempDir, "app/api/nextpulse/metadata/route.ts"))).toBe(
      true
    );
    expect(await fs.pathExists(path.join(tempDir, "app/api/nextpulse/config/route.ts"))).toBe(true);
    expect(await fs.pathExists(path.join(tempDir, "app/api/nextpulse/runtime/route.ts"))).toBe(
      true
    );
    expect(await fs.pathExists(path.join(tempDir, "app/api/nextpulse/bundles/route.ts"))).toBe(
      true
    );
    expect(await fs.pathExists(path.join(tempDir, "app/api/nextpulse/errors/route.ts"))).toBe(true);
    expect(await fs.pathExists(path.join(tempDir, "app/api/nextpulse/diagnostics/route.ts"))).toBe(
      true
    );

    const results = removeApiRoutes(tempDir, "app");

    expect(results).toHaveLength(6);
    expect(await fs.pathExists(path.join(tempDir, "app/api/nextpulse/metadata/route.ts"))).toBe(
      false
    );
    expect(await fs.pathExists(path.join(tempDir, "app/api/nextpulse/config/route.ts"))).toBe(
      false
    );
    expect(await fs.pathExists(path.join(tempDir, "app/api/nextpulse/runtime/route.ts"))).toBe(
      false
    );
    expect(await fs.pathExists(path.join(tempDir, "app/api/nextpulse/bundles/route.ts"))).toBe(
      false
    );
    expect(await fs.pathExists(path.join(tempDir, "app/api/nextpulse/errors/route.ts"))).toBe(
      false
    );
    expect(await fs.pathExists(path.join(tempDir, "app/api/nextpulse/diagnostics/route.ts"))).toBe(
      false
    );
  });

  it("should verify App Router metadata route template", async () => {
    generateApiRoutes(tempDir, "app");

    const metadataContent = await fs.readFile(
      path.join(tempDir, "app/api/nextpulse/metadata/route.ts"),
      "utf-8"
    );

    expect(metadataContent).toContain("export async function GET()");
    expect(metadataContent).toContain(".nextpulse/metadata.json");
    expect(metadataContent).toContain("NextResponse");
  });

  it("should verify App Router config route template", async () => {
    generateApiRoutes(tempDir, "app");

    const configContent = await fs.readFile(
      path.join(tempDir, "app/api/nextpulse/config/route.ts"),
      "utf-8"
    );

    expect(configContent).toContain("export async function GET()");
    expect(configContent).toContain("nextpulse.config.json");
    expect(configContent).toContain("overlayPosition");
  });

  it("should verify Pages Router metadata route template", async () => {
    generateApiRoutes(tempDir, "pages");

    const metadataContent = await fs.readFile(
      path.join(tempDir, "pages/api/nextpulse/metadata.ts"),
      "utf-8"
    );

    expect(metadataContent).toContain("export default async function handler");
    expect(metadataContent).toContain(".nextpulse/metadata.json");
    expect(metadataContent).toContain("NextApiRequest");
    expect(metadataContent).toContain("NextApiResponse");
  });

  it("should verify App Router runtime route template", async () => {
    generateApiRoutes(tempDir, "app");

    const runtimeContent = await fs.readFile(
      path.join(tempDir, "app/api/nextpulse/runtime/route.ts"),
      "utf-8"
    );

    expect(runtimeContent).toContain("export async function GET()");
    expect(runtimeContent).toContain("getRuntimeSnapshot");
    expect(runtimeContent).toContain("@forgefoundry/nextpulse/instrumentation");
  });

  it("should verify App Router bundles route template", async () => {
    generateApiRoutes(tempDir, "app");

    const bundlesContent = await fs.readFile(
      path.join(tempDir, "app/api/nextpulse/bundles/route.ts"),
      "utf-8"
    );

    expect(bundlesContent).toContain("export async function GET()");
    expect(bundlesContent).toContain("scanBundles");
    expect(bundlesContent).toContain("@forgefoundry/nextpulse/instrumentation");
  });

  it("should verify App Router errors route template", async () => {
    generateApiRoutes(tempDir, "app");

    const errorsContent = await fs.readFile(
      path.join(tempDir, "app/api/nextpulse/errors/route.ts"),
      "utf-8"
    );

    expect(errorsContent).toContain("export async function GET()");
    expect(errorsContent).toContain("getErrorLogSnapshot");
    expect(errorsContent).toContain("@forgefoundry/nextpulse/instrumentation");
  });

  it("should verify Pages Router runtime route template", async () => {
    generateApiRoutes(tempDir, "pages");

    const runtimeContent = await fs.readFile(
      path.join(tempDir, "pages/api/nextpulse/runtime.ts"),
      "utf-8"
    );

    expect(runtimeContent).toContain("export default async function handler");
    expect(runtimeContent).toContain("getRuntimeSnapshot");
    expect(runtimeContent).toContain("@forgefoundry/nextpulse/instrumentation");
  });

  it("should verify Pages Router bundles route template", async () => {
    generateApiRoutes(tempDir, "pages");

    const bundlesContent = await fs.readFile(
      path.join(tempDir, "pages/api/nextpulse/bundles.ts"),
      "utf-8"
    );

    expect(bundlesContent).toContain("export default async function handler");
    expect(bundlesContent).toContain("scanBundles");
    expect(bundlesContent).toContain("@forgefoundry/nextpulse/instrumentation");
  });

  it("should verify Pages Router errors route template", async () => {
    generateApiRoutes(tempDir, "pages");

    const errorsContent = await fs.readFile(
      path.join(tempDir, "pages/api/nextpulse/errors.ts"),
      "utf-8"
    );

    expect(errorsContent).toContain("export default async function handler");
    expect(errorsContent).toContain("getErrorLogSnapshot");
    expect(errorsContent).toContain("@forgefoundry/nextpulse/instrumentation");
  });
});
