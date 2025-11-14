import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchAppRuntimeSnapshot,
  fetchAppBundles,
  fetchAppErrors,
} from "../src/server/appRuntimeClient.js";
import type { RuntimeSnapshot } from "../src/types/runtime.js";

// Mock fetch globally
const originalFetch = global.fetch;

describe("appRuntimeClient", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("fetchAppRuntimeSnapshot", () => {
    it("should return runtime snapshot on successful fetch", async () => {
      const mockSnapshot: RuntimeSnapshot = {
        sessions: [],
        activeSessionId: null,
        lastUpdated: Date.now(),
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshot,
      });

      const result = await fetchAppRuntimeSnapshot("http://localhost:3000");

      expect(result).toEqual(mockSnapshot);
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/nextpulse/runtime",
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it("should return null on connection error", async () => {
      (global.fetch as any).mockRejectedValueOnce({
        code: "ECONNREFUSED",
        message: "Connection refused",
      });

      const result = await fetchAppRuntimeSnapshot("http://localhost:3000");

      expect(result).toBeNull();
    });

    it("should return null on 404", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const result = await fetchAppRuntimeSnapshot("http://localhost:3000");

      expect(result).toBeNull();
    });

    it("should return null on timeout", async () => {
      (global.fetch as any).mockRejectedValueOnce({
        name: "AbortError",
        message: "Timeout",
      });

      const result = await fetchAppRuntimeSnapshot("http://localhost:3000");

      expect(result).toBeNull();
    });
  });

  describe("fetchAppBundles", () => {
    it("should return bundles on successful fetch", async () => {
      const mockBundles = { assets: [], totalClientSize: 0, totalServerSize: 0 };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockBundles,
      });

      const result = await fetchAppBundles("http://localhost:3000");

      expect(result).toEqual(mockBundles);
    });

    it("should return null on connection error", async () => {
      (global.fetch as any).mockRejectedValueOnce({
        code: "ECONNREFUSED",
      });

      const result = await fetchAppBundles("http://localhost:3000");

      expect(result).toBeNull();
    });
  });

  describe("fetchAppErrors", () => {
    it("should return errors on successful fetch", async () => {
      const mockErrors = { errors: [], logs: [] };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockErrors,
      });

      const result = await fetchAppErrors("http://localhost:3000");

      expect(result).toEqual(mockErrors);
    });

    it("should return null on connection error", async () => {
      (global.fetch as any).mockRejectedValueOnce({
        code: "ECONNREFUSED",
      });

      const result = await fetchAppErrors("http://localhost:3000");

      expect(result).toBeNull();
    });
  });
});
