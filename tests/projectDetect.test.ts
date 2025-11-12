import { describe, it, expect } from "vitest";
import { getGitInfo } from "../src/utils/projectDetect.js";

describe("projectDetect", () => {
  describe("git info fallbacks", () => {
    it("git info returns strings even without repo", () => {
      const { branch, sha } = getGitInfo(process.cwd());
      expect(typeof branch).toBe("string");
      expect(typeof sha).toBe("string");
      // Should return "unknown" if git fails
      expect(branch).toBeTruthy();
      expect(sha).toBeTruthy();
    });
  });
});
