/**
 * HTTP client for fetching runtime data from Next.js app
 * Bridges the dashboard server to the Next.js dev server's runtime API
 */

import type { RuntimeSnapshot } from "../types/runtime.js";
import type { ErrorLogSnapshot } from "../types/errors.js";
import type { BundlesSnapshot } from "../types/bundles.js";
import pc from "picocolors";

/**
 * Fetch runtime snapshot from Next.js app
 */
export async function fetchAppRuntimeSnapshot(baseUrl: string): Promise<RuntimeSnapshot | null> {
  try {
    const url = `${baseUrl}/api/nextpulse/runtime`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data as RuntimeSnapshot;
  } catch (error: any) {
    // Log warning but don't throw - graceful degradation
    if (
      error.code === "ECONNREFUSED" ||
      error.code === "ENOTFOUND" ||
      error.name === "AbortError" ||
      error.message.includes("ECONNREFUSED") ||
      error.message.includes("fetch failed")
    ) {
      console.warn(
        pc.yellow(
          `[nextpulse] warn: failed to fetch runtime from ${baseUrl}/api/nextpulse/runtime (${error.message || "connection refused"})`
        )
      );
      return null;
    }
    console.warn(
      pc.yellow(
        `[nextpulse] warn: failed to fetch runtime from ${baseUrl}/api/nextpulse/runtime (${error.message || "unknown error"})`
      )
    );
    return null;
  }
}

/**
 * Fetch bundles data from Next.js app
 */
export async function fetchAppBundles(baseUrl: string): Promise<BundlesSnapshot | null> {
  try {
    const url = `${baseUrl}/api/nextpulse/bundles`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data as BundlesSnapshot;
  } catch (error: any) {
    if (
      error.code === "ECONNREFUSED" ||
      error.code === "ENOTFOUND" ||
      error.name === "AbortError" ||
      error.message.includes("ECONNREFUSED") ||
      error.message.includes("fetch failed")
    ) {
      console.warn(
        pc.yellow(
          `[nextpulse] warn: failed to fetch bundles from ${baseUrl}/api/nextpulse/bundles (${error.message || "connection refused"})`
        )
      );
      return null;
    }
    console.warn(
      pc.yellow(
        `[nextpulse] warn: failed to fetch bundles from ${baseUrl}/api/nextpulse/bundles (${error.message || "unknown error"})`
      )
    );
    return null;
  }
}

/**
 * Fetch errors data from Next.js app
 */
export async function fetchAppErrors(baseUrl: string): Promise<ErrorLogSnapshot | null> {
  try {
    const url = `${baseUrl}/api/nextpulse/errors`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data as ErrorLogSnapshot;
  } catch (error: any) {
    if (
      error.code === "ECONNREFUSED" ||
      error.code === "ENOTFOUND" ||
      error.name === "AbortError" ||
      error.message.includes("ECONNREFUSED") ||
      error.message.includes("fetch failed")
    ) {
      console.warn(
        pc.yellow(
          `[nextpulse] warn: failed to fetch errors from ${baseUrl}/api/nextpulse/errors (${error.message || "connection refused"})`
        )
      );
      return null;
    }
    console.warn(
      pc.yellow(
        `[nextpulse] warn: failed to fetch errors from ${baseUrl}/api/nextpulse/errors (${error.message || "unknown error"})`
      )
    );
    return null;
  }
}
