/**
 * Panel component for displaying metadata
 * Part of NextPulse runtime - lives in package
 */

import React, { useEffect, useState, useMemo } from "react";
import { StatusIcon } from "./StatusIcon.js";
import type { RuntimeSnapshot } from "../types/runtime.js";
import { buildOverlayView } from "../diagnostics/index.js";

export interface Metadata {
  appName: string;
  nextVersion: string;
  gitBranch: string;
  gitSha: string;
  gitDirty: boolean;
  port: string;
}

interface PanelProps {
  metadata: Metadata;
  position?: "bottomRight" | "bottomLeft" | "topRight" | "topLeft";
}

export function Panel({ metadata, position = "bottomRight" }: PanelProps) {
  const [runtimeData, setRuntimeData] = useState<RuntimeSnapshot | null>(null);
  const [showActivity, setShowActivity] = useState(false);
  const [showPerf, setShowPerf] = useState(false);
  const [showBundles, setShowBundles] = useState(false);
  const [bundlesData, setBundlesData] = useState<any>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [errorsData, setErrorsData] = useState<any>(null);

  // Fetch runtime data in development
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    const fetchRuntime = async () => {
      try {
        // Note: This requires an API route at /api/nextpulse/runtime in the Next.js app
        // For now, this will only work if the route exists
        const response = await fetch("/api/nextpulse/runtime");
        if (response.ok) {
          const data = await response.json();
          setRuntimeData(data);
        }
      } catch {
        // Silently fail - API route may not exist yet
      }
    };

    fetchRuntime();
    const interval = setInterval(fetchRuntime, 2000); // Poll every 2 seconds

    // Fetch bundle data
    const fetchBundles = async () => {
      try {
        const response = await fetch("/api/nextpulse/bundles");
        if (response.ok) {
          const data = await response.json();
          setBundlesData(data);
        }
      } catch {
        // Silently fail - API route may not exist yet
      }
    };

    fetchBundles();
    const bundlesInterval = setInterval(fetchBundles, 5000); // Poll every 5 seconds

    // Fetch error data
    const fetchErrors = async () => {
      try {
        const response = await fetch("/api/nextpulse/errors");
        if (response.ok) {
          const data = await response.json();
          setErrorsData(data);
        }
      } catch {
        // Silently fail - API route may not exist yet
      }
    };

    fetchErrors();
    const errorsInterval = setInterval(fetchErrors, 2000); // Poll every 2 seconds

    return () => {
      clearInterval(interval);
      clearInterval(bundlesInterval);
      clearInterval(errorsInterval);
    };
  }, []);

  // Position the panel near the button (60px offset to account for button + spacing)
  const positionStyles: Record<string, React.CSSProperties> = {
    bottomRight: { position: "fixed", bottom: "70px", right: "20px", zIndex: 9999 },
    bottomLeft: { position: "fixed", bottom: "70px", left: "20px", zIndex: 9999 },
    topRight: { position: "fixed", top: "70px", right: "20px", zIndex: 9999 },
    topLeft: { position: "fixed", top: "70px", left: "20px", zIndex: 9999 },
  };

  const branchColor = metadata.gitDirty ? "#FF5E5E" : "#3CCF4E";

  // Build overlay view from runtime data using shared diagnostics module
  const overlayView = useMemo(() => {
    if (!runtimeData) {
      return null;
    }
    return buildOverlayView(runtimeData);
  }, [runtimeData]);

  // Update hasErrors when errors data is available
  const overlayViewWithErrors = useMemo(() => {
    if (!overlayView) return null;
    return {
      ...overlayView,
      hasErrors: errorsData?.errors?.length > 0 || false,
    };
  }, [overlayView, errorsData]);

  const activeSession = overlayViewWithErrors?.activeSession || null;
  const recentFetches = overlayViewWithErrors?.recentFetches || [];
  const lastAction =
    overlayViewWithErrors?.recentServerActions[
      overlayViewWithErrors.recentServerActions.length - 1
    ];
  const slowestRsc = overlayViewWithErrors?.slowestRscRender || null;
  const suspenseCount = overlayViewWithErrors?.suspenseCount || 0;
  const streamingCount = overlayViewWithErrors?.streamingCount || 0;
  const recentFetchDurations = recentFetches.map((f) => f.durationMs);

  return (
    <div
      role="status"
      aria-label={`NextPulse: ${metadata.appName}, Next.js ${metadata.nextVersion}, Branch ${metadata.gitBranch}`}
      style={{
        ...positionStyles[position],
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: "12px",
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        color: "#fff",
        padding: "8px 12px",
        borderRadius: "6px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        lineHeight: "1.5",
        maxWidth: "280px",
        pointerEvents: "auto",
        cursor: "default",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: "4px", fontSize: "13px" }}>
        {metadata.appName}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          fontSize: "11px",
          opacity: 0.9,
        }}
      >
        <div>Next.js {metadata.nextVersion}</div>
        <div>Port: {metadata.port}</div>
        <div style={{ color: branchColor }}>
          {metadata.gitBranch}
          <StatusIcon dirty={metadata.gitDirty} />
          {metadata.gitSha && ` (${metadata.gitSha})`}
        </div>
      </div>

      {/* Activity Section */}
      {process.env.NODE_ENV === "development" && activeSession && (
        <div
          style={{
            marginTop: "12px",
            paddingTop: "12px",
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <button
            onClick={() => setShowActivity(!showActivity)}
            style={{
              background: "transparent",
              border: "none",
              color: "#60a5fa",
              cursor: "pointer",
              fontSize: "11px",
              padding: "4px 0",
              textAlign: "left",
              width: "100%",
            }}
          >
            {showActivity ? "▼" : "▶"} Activity
          </button>
          {showActivity && (
            <div style={{ marginTop: "8px", fontSize: "10px" }}>
              <div style={{ marginBottom: "6px" }}>
                <strong>Fetches:</strong> {activeSession.fetches.length}
              </div>
              {recentFetches.length > 0 && (
                <div style={{ marginBottom: "6px", maxHeight: "100px", overflowY: "auto" }}>
                  {recentFetches.map((fetch, idx) => (
                    <div key={idx} style={{ marginBottom: "4px", opacity: 0.8 }}>
                      <div style={{ fontFamily: "monospace", fontSize: "9px" }}>
                        {fetch.method} {fetch.statusCode || "..."}
                      </div>
                      <div
                        style={{
                          fontSize: "9px",
                          color: "#94a3b8",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {fetch.url.length > 30 ? fetch.url.substring(0, 30) + "..." : fetch.url}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginBottom: "6px" }}>
                <strong>Actions:</strong> {activeSession.actions.length}
              </div>
              {lastAction && (
                <div style={{ fontSize: "9px", opacity: 0.8 }}>
                  <div>{lastAction.name}</div>
                  <div style={{ color: lastAction.status === "error" ? "#FF5E5E" : "#3CCF4E" }}>
                    {lastAction.status} ({lastAction.executionTimeMs}ms)
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Performance Section */}
      {process.env.NODE_ENV === "development" && activeSession && (
        <div
          style={{
            marginTop: "12px",
            paddingTop: "12px",
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <button
            onClick={() => setShowPerf(!showPerf)}
            style={{
              background: "transparent",
              border: "none",
              color: "#60a5fa",
              cursor: "pointer",
              fontSize: "11px",
              padding: "4px 0",
              textAlign: "left",
              width: "100%",
            }}
          >
            {showPerf ? "▼" : "▶"} Perf
          </button>
          {showPerf && (
            <div style={{ marginTop: "8px", fontSize: "10px" }}>
              {slowestRsc && (
                <div style={{ marginBottom: "6px" }}>
                  <strong>Slowest RSC:</strong> {slowestRsc.componentName || "Unknown"} (
                  {slowestRsc.durationMs}ms)
                </div>
              )}
              <div style={{ marginBottom: "6px" }}>
                <strong>Suspense:</strong> {suspenseCount}
              </div>
              <div style={{ marginBottom: "6px" }}>
                <strong>Streaming:</strong> {streamingCount}
              </div>
              {recentFetchDurations.length > 0 && (
                <div style={{ marginBottom: "6px" }}>
                  <strong>Last 5 Fetches:</strong>
                  <div style={{ fontSize: "9px", color: "#94a3b8", marginTop: "2px" }}>
                    {recentFetchDurations.map((duration, idx) => (
                      <div key={idx}>{duration}ms</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bundles Section */}
      {process.env.NODE_ENV === "development" && bundlesData && (
        <div
          style={{
            marginTop: "12px",
            paddingTop: "12px",
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <button
            onClick={() => setShowBundles(!showBundles)}
            style={{
              background: "transparent",
              border: "none",
              color: "#60a5fa",
              cursor: "pointer",
              fontSize: "11px",
              padding: "4px 0",
              textAlign: "left",
              width: "100%",
            }}
          >
            {showBundles ? "▼" : "▶"} Bundles
          </button>
          {showBundles && (
            <div style={{ marginTop: "8px", fontSize: "10px" }}>
              <div style={{ marginBottom: "6px" }}>
                <strong>Client:</strong> {formatBytes(bundlesData.totalClientSize || 0)}
              </div>
              <div style={{ marginBottom: "6px" }}>
                <strong>Server:</strong> {formatBytes(bundlesData.totalServerSize || 0)}
              </div>
              {bundlesData.chunks && bundlesData.chunks.length > 0 && (
                <div style={{ marginBottom: "6px" }}>
                  <strong>Largest Chunk:</strong>{" "}
                  {formatBytes(Math.max(...bundlesData.chunks.map((c: any) => c.size || 0)))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Errors Section */}
      {process.env.NODE_ENV === "development" && errorsData && (
        <div
          style={{
            marginTop: "12px",
            paddingTop: "12px",
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <button
            onClick={() => setShowErrors(!showErrors)}
            style={{
              background: "transparent",
              border: "none",
              color: "#60a5fa",
              cursor: "pointer",
              fontSize: "11px",
              padding: "4px 0",
              textAlign: "left",
              width: "100%",
            }}
          >
            {showErrors ? "▼" : "▶"} Errors
            {errorsData.errors && errorsData.errors.length > 0 && (
              <span
                style={{
                  marginLeft: "8px",
                  padding: "2px 6px",
                  background: "#ef4444",
                  borderRadius: "10px",
                  fontSize: "9px",
                }}
              >
                {errorsData.errors.length}
              </span>
            )}
          </button>
          {showErrors && errorsData.errors && errorsData.errors.length > 0 && (
            <div style={{ marginTop: "8px", fontSize: "10px" }}>
              <div style={{ marginBottom: "6px" }}>
                <strong>Last Error:</strong>
                <div
                  style={{
                    fontSize: "9px",
                    color: "#cbd5e1",
                    marginTop: "2px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {errorsData.errors[0].message.length > 50
                    ? errorsData.errors[0].message.substring(0, 50) + "..."
                    : errorsData.errors[0].message}
                </div>
              </div>
              <div style={{ marginTop: "8px" }}>
                <a
                  href="http://localhost:4337"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#60a5fa",
                    textDecoration: "none",
                    fontSize: "9px",
                  }}
                >
                  Open in NextPulse Dashboard →
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
