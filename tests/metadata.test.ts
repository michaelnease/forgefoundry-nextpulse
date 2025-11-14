import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import {
  generateMetadata,
  writeMetadataFile,
  readMetadataFile,
  generateAndWriteMetadata,
} from "../src/utils/metadata.js";

describe("metadata generation", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nextpulse-metadata-test-"));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it("should generate metadata from package.json", async () => {
    // Create a package.json
    await fs.writeFile(
      path.join(tempDir, "package.json"),
      JSON.stringify({
        name: "test-app",
        dependencies: {
          next: "^14.0.0",
        },
      }),
      "utf-8"
    );

    const metadata = generateMetadata(tempDir);

    expect(metadata.appName).toBe("test-app");
    expect(metadata.nextVersion).toBe("14.0.0");
    expect(metadata.port).toBe("3000"); // default
  });

  it("should handle missing package.json gracefully", () => {
    const metadata = generateMetadata(tempDir);

    expect(metadata.appName).toBe("Next.js App");
    expect(metadata.nextVersion).toBe("unknown");
    expect(metadata.gitBranch).toBe("unknown");
    expect(metadata.gitSha).toBe("unknown");
    expect(metadata.gitDirty).toBe(false);
  });

  it("should write metadata.json file", async () => {
    const metadata = {
      appName: "test-app",
      nextVersion: "14.0.0",
      gitBranch: "main",
      gitSha: "abc1234",
      gitDirty: false,
      port: "3000",
    };

    const action = writeMetadataFile(tempDir, metadata);

    expect(action).toBe("created");
    expect(await fs.pathExists(path.join(tempDir, ".nextpulse/metadata.json"))).toBe(true);

    const written = await fs.readJSON(path.join(tempDir, ".nextpulse/metadata.json"));
    expect(written).toEqual(metadata);
  });

  it("should skip writing if content unchanged", async () => {
    const metadata = {
      appName: "test-app",
      nextVersion: "14.0.0",
      gitBranch: "main",
      gitSha: "abc1234",
      gitDirty: false,
      port: "3000",
    };

    writeMetadataFile(tempDir, metadata);
    const action = writeMetadataFile(tempDir, metadata);

    expect(action).toBe("skipped");
  });

  it("should update if content changed", async () => {
    const metadata1 = {
      appName: "test-app",
      nextVersion: "14.0.0",
      gitBranch: "main",
      gitSha: "abc1234",
      gitDirty: false,
      port: "3000",
    };

    const metadata2 = {
      ...metadata1,
      gitSha: "def5678",
    };

    writeMetadataFile(tempDir, metadata1);
    const action = writeMetadataFile(tempDir, metadata2);

    expect(action).toBe("updated");

    const written = await fs.readJSON(path.join(tempDir, ".nextpulse/metadata.json"));
    expect(written.gitSha).toBe("def5678");
  });

  it("should read existing metadata.json", async () => {
    const metadata = {
      appName: "test-app",
      nextVersion: "14.0.0",
      gitBranch: "main",
      gitSha: "abc1234",
      gitDirty: false,
      port: "3000",
    };

    await fs.ensureDir(path.join(tempDir, ".nextpulse"));
    await fs.writeJSON(path.join(tempDir, ".nextpulse/metadata.json"), metadata);

    const read = readMetadataFile(tempDir);

    expect(read).toEqual(metadata);
  });

  it("should return null for missing metadata.json", () => {
    const read = readMetadataFile(tempDir);
    expect(read).toBeNull();
  });

  it("should generate and write metadata", async () => {
    await fs.writeFile(
      path.join(tempDir, "package.json"),
      JSON.stringify({
        name: "my-app",
        dependencies: { next: "^15.0.0" },
      }),
      "utf-8"
    );

    const { metadata, action } = generateAndWriteMetadata(tempDir);

    expect(action).toBe("created");
    expect(metadata.appName).toBe("my-app");
    expect(metadata.nextVersion).toBe("15.0.0");
    expect(await fs.pathExists(path.join(tempDir, ".nextpulse/metadata.json"))).toBe(true);
  });
});
