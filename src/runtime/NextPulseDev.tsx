"use client";

import { useEffect, useState } from "react";

interface NextPulseDevProps {
  appName?: string;
  nextVersion?: string;
  port?: string;
  gitBranch?: string;
  gitSha?: string;
}

// Helper to safely get props from string attributes
function getStringProp(value: string | undefined): string | undefined {
  return value && value !== "undefined" ? value : undefined;
}

export function NextPulseDev(props: NextPulseDevProps) {
  // Get props with safe defaults
  const appName = getStringProp(props.appName) || "Next.js App";
  const nextVersion = getStringProp(props.nextVersion) || "unknown";
  const port = getStringProp(props.port) || process.env.PORT || process.env.NEXT_PUBLIC_PORT || "3000";
  const gitBranch = getStringProp(props.gitBranch) || "unknown";
  const gitSha = getStringProp(props.gitSha) || "unknown";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const position = "bottomRight"; // Will be configurable via config

  const positionStyles: Record<string, React.CSSProperties> = {
    bottomRight: {
      position: "fixed",
      bottom: "16px",
      right: "16px",
      zIndex: 9999,
    },
    bottomLeft: {
      position: "fixed",
      bottom: "16px",
      left: "16px",
      zIndex: 9999,
    },
    topRight: {
      position: "fixed",
      top: "16px",
      right: "16px",
      zIndex: 9999,
    },
    topLeft: {
      position: "fixed",
      top: "16px",
      left: "16px",
      zIndex: 9999,
    },
  };

  return (
    <div
      role="status"
      aria-label={`NextPulse: ${appName}, Next.js ${nextVersion}, Port ${port}, Branch ${gitBranch}`}
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
        {appName}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "11px", opacity: 0.9 }}>
        <div>Next.js {nextVersion}</div>
        <div>Port: {port}</div>
        <div>
          {gitBranch} {gitSha && `(${gitSha})`}
        </div>
      </div>
    </div>
  );
}

