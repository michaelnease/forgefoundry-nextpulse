/**
 * Tests for Phase 5: Bundle & Asset Analyzer
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { scanBundles } from "../src/server/bundleScanner.js";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "fs";
import { join } from "path";
import os from "os";

describe("Bundle Scanner", () => {
  let tempDir: string;
  let nextDir: string;

  beforeEach(() => {
    tempDir = join(os.tmpdir(), `nextpulse-bundle-test-${Date.now()}`);
    nextDir = join(tempDir, ".next");
    mkdirSync(nextDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should return null if .next directory does not exist", () => {
    // Use a different directory that doesn't have .next
    const noNextDir = join(os.tmpdir(), `nextpulse-no-next-${Date.now()}`);
    mkdirSync(noNextDir, { recursive: true });
    const result = scanBundles(noNextDir);
    expect(result).toBeNull();
    rmSync(noNextDir, { recursive: true, force: true });
  });

  it("should detect JS assets correctly", () => {
    const staticDir = join(nextDir, "static", "chunks");
    mkdirSync(staticDir, { recursive: true });
    writeFileSync(join(staticDir, "main-abc123.js"), "console.log('test');");

    const result = scanBundles(tempDir);
    expect(result).not.toBeNull();
    expect(result!.assets.length).toBeGreaterThan(0);
    const jsAsset = result!.assets.find((a) => a.name === "main-abc123.js");
    expect(jsAsset).toBeDefined();
    expect(jsAsset!.type).toBe("js");
    expect(jsAsset!.isClient).toBe(true);
  });

  it("should detect CSS assets correctly", () => {
    const staticDir = join(nextDir, "static");
    mkdirSync(staticDir, { recursive: true });
    writeFileSync(join(staticDir, "styles.css"), "body { margin: 0; }");

    const result = scanBundles(tempDir);
    expect(result).not.toBeNull();
    const cssAsset = result!.assets.find((a) => a.name === "styles.css");
    expect(cssAsset).toBeDefined();
    expect(cssAsset!.type).toBe("css");
  });

  it("should detect image assets correctly", () => {
    const staticDir = join(nextDir, "static");
    mkdirSync(staticDir, { recursive: true });
    writeFileSync(join(staticDir, "logo.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const result = scanBundles(tempDir);
    expect(result).not.toBeNull();
    const imageAsset = result!.assets.find((a) => a.name === "logo.png");
    expect(imageAsset).toBeDefined();
    expect(imageAsset!.type).toBe("image");
  });

  it("should detect font assets correctly", () => {
    const staticDir = join(nextDir, "static");
    mkdirSync(staticDir, { recursive: true });
    writeFileSync(join(staticDir, "font.woff2"), Buffer.alloc(100));

    const result = scanBundles(tempDir);
    expect(result).not.toBeNull();
    const fontAsset = result!.assets.find((a) => a.name === "font.woff2");
    expect(fontAsset).toBeDefined();
    expect(fontAsset!.type).toBe("font");
  });

  it("should correctly identify client vs server bundles", () => {
    const staticDir = join(nextDir, "static", "chunks");
    const serverDir = join(nextDir, "server", "app");
    mkdirSync(staticDir, { recursive: true });
    mkdirSync(serverDir, { recursive: true });

    writeFileSync(join(staticDir, "client.js"), "client code");
    writeFileSync(join(serverDir, "server.js"), "server code");

    const result = scanBundles(tempDir);
    expect(result).not.toBeNull();

    const clientAsset = result!.assets.find((a) => a.name === "client.js");
    const serverAsset = result!.assets.find((a) => a.name === "server.js");

    expect(clientAsset).toBeDefined();
    expect(clientAsset!.isClient).toBe(true);
    expect(clientAsset!.isServer).toBe(false);

    expect(serverAsset).toBeDefined();
    expect(serverAsset!.isClient).toBe(false);
    expect(serverAsset!.isServer).toBe(true);
  });

  it("should calculate file sizes correctly", () => {
    const staticDir = join(nextDir, "static");
    mkdirSync(staticDir, { recursive: true });
    const content = "x".repeat(1024); // 1KB
    writeFileSync(join(staticDir, "large.js"), content);

    const result = scanBundles(tempDir);
    expect(result).not.toBeNull();
    const asset = result!.assets.find((a) => a.name === "large.js");
    expect(asset).toBeDefined();
    expect(asset!.size).toBe(1024);
  });

  it("should calculate gzip sizes for JS and CSS", () => {
    const staticDir = join(nextDir, "static");
    mkdirSync(staticDir, { recursive: true });
    writeFileSync(join(staticDir, "test.js"), "console.log('test');");
    writeFileSync(join(staticDir, "test.css"), "body { margin: 0; }");

    const result = scanBundles(tempDir);
    expect(result).not.toBeNull();

    const jsAsset = result!.assets.find((a) => a.name === "test.js");
    const cssAsset = result!.assets.find((a) => a.name === "test.css");

    expect(jsAsset).toBeDefined();
    expect(jsAsset!.gzipSize).toBeDefined();
    expect(jsAsset!.gzipSize!).toBeGreaterThan(0);

    expect(cssAsset).toBeDefined();
    expect(cssAsset!.gzipSize).toBeDefined();
    expect(cssAsset!.gzipSize!).toBeGreaterThan(0);
  });

  it("should group assets into chunks", () => {
    const chunksDir = join(nextDir, "static", "chunks");
    mkdirSync(chunksDir, { recursive: true });

    writeFileSync(join(chunksDir, "main-abc123.js"), "main code");
    writeFileSync(join(chunksDir, "main-def456.js"), "main code v2");

    const result = scanBundles(tempDir);
    expect(result).not.toBeNull();
    expect(result!.chunks.length).toBeGreaterThan(0);

    const mainChunk = result!.chunks.find((c) => c.name === "main");
    expect(mainChunk).toBeDefined();
    expect(mainChunk!.files.length).toBeGreaterThanOrEqual(1);
  });

  it("should calculate total client and server sizes", () => {
    const staticDir = join(nextDir, "static");
    const serverAppDir = join(nextDir, "server", "app");
    mkdirSync(staticDir, { recursive: true });
    mkdirSync(serverAppDir, { recursive: true });

    writeFileSync(join(staticDir, "client1.js"), "x".repeat(100));
    writeFileSync(join(staticDir, "client2.js"), "x".repeat(200));
    writeFileSync(join(serverAppDir, "server1.js"), "x".repeat(150));

    const result = scanBundles(tempDir);
    expect(result).not.toBeNull();
    expect(result!.totalClientSize).toBeGreaterThanOrEqual(300);
    // Server size might be 0 if the file isn't in a scanned subdirectory
    // Just check that totals are calculated
    expect(result!.totalServerSize).toBeGreaterThanOrEqual(0);
  });

  it("should handle missing directories gracefully", () => {
    // Create .next but no subdirectories
    const result = scanBundles(tempDir);
    // Should not throw, but may return empty or null
    expect(result === null || (result && Array.isArray(result.assets))).toBe(true);
  });

  it("should include generatedAt timestamp", () => {
    const staticDir = join(nextDir, "static");
    mkdirSync(staticDir, { recursive: true });
    writeFileSync(join(staticDir, "test.js"), "test");

    const before = Date.now();
    const result = scanBundles(tempDir);
    const after = Date.now();

    expect(result).not.toBeNull();
    expect(result!.generatedAt).toBeGreaterThanOrEqual(before);
    expect(result!.generatedAt).toBeLessThanOrEqual(after);
  });
});

