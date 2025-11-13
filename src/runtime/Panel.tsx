/**
 * Panel component for displaying metadata
 * Part of NextPulse runtime - lives in package
 */

import React from "react";
import { StatusIcon } from "./StatusIcon.js";

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
  // Position the panel near the button (60px offset to account for button + spacing)
  const positionStyles: Record<string, React.CSSProperties> = {
    bottomRight: { position: "fixed", bottom: "70px", right: "20px", zIndex: 9999 },
    bottomLeft: { position: "fixed", bottom: "70px", left: "20px", zIndex: 9999 },
    topRight: { position: "fixed", top: "70px", right: "20px", zIndex: 9999 },
    topLeft: { position: "fixed", top: "70px", left: "20px", zIndex: 9999 },
  };

  const branchColor = metadata.gitDirty ? "#FF5E5E" : "#3CCF4E";

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
        pointerEvents: "none",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: "4px", fontSize: "13px" }}>
        {metadata.appName}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "11px", opacity: 0.9 }}>
        <div>Next.js {metadata.nextVersion}</div>
        <div>Port: {metadata.port}</div>
        <div style={{ color: branchColor }}>
          {metadata.gitBranch}
          <StatusIcon dirty={metadata.gitDirty} />
          {metadata.gitSha && ` (${metadata.gitSha})`}
        </div>
      </div>
    </div>
  );
}
