/**
 * NextPulse main component
 * Works with ZERO props - auto-detects all metadata
 * Part of NextPulse runtime - lives in package
 */

"use client";

import { useEffect, useState } from "react";
import { Panel, type Metadata } from "./Panel.js";
import { initializeInstrumentation } from "../instrumentation/index.js";
import { beginSession, endSession, setCurrentRoute } from "../instrumentation/sessions.js";

interface RuntimeConfig {
  overlayPosition?: "bottomRight" | "bottomLeft" | "topRight" | "topLeft";
}

/**
 * Anvil icon button component
 * Toggles the panel visibility on click
 */
function AnvilButton(props: {
  isOpen: boolean;
  onToggle: () => void;
  position: "bottomRight" | "bottomLeft" | "topRight" | "topLeft";
}) {
  // Position styles for the button
  const positionStyles: Record<string, React.CSSProperties> = {
    bottomRight: { bottom: "20px", right: "20px" },
    bottomLeft: { bottom: "20px", left: "20px" },
    topRight: { top: "20px", right: "20px" },
    topLeft: { top: "20px", left: "20px" },
  };

  return (
    <button
      type="button"
      onClick={props.onToggle}
      aria-label={props.isOpen ? "Close NextPulse panel" : "Open NextPulse panel"}
      aria-pressed={props.isOpen}
      style={{
        position: "fixed",
        ...positionStyles[props.position],
        width: "40px",
        height: "40px",
        borderRadius: "50%",
        border: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#111827",
        color: "#E5E7EB",
        boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
        cursor: "pointer",
        zIndex: 99999,
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.05)";
        e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.45)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.35)";
      }}
    >
      {/* Anvil icon SVG */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block" }}
      >
        {/* Simplified anvil shape */}
        <path d="M4 18h16v2H4v-2z" fill="currentColor" />
        <path
          d="M5 16h14c.55 0 1-.45 1-1v-3c0-.55-.45-1-1-1h-2V9c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v2H5c-.55 0-1 .45-1 1v3c0 .55.45 1 1 1z"
          fill="currentColor"
        />
        <path d="M9 7h6v2H9V7z" fill="currentColor" />
      </svg>
    </button>
  );
}

export function NextPulse() {
  const [mounted, setMounted] = useState(false);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [position, setPosition] = useState<"bottomRight" | "bottomLeft" | "topRight" | "topLeft">(
    "bottomRight"
  );
  const [isOpen, setIsOpen] = useState(false);
  const [pathname, setPathnameState] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);

    // Initialize instrumentation in development
    if (process.env.NODE_ENV === "development") {
      initializeInstrumentation();
    }

    // Fetch metadata from API route
    fetch("/api/nextpulse/metadata")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setMetadata(data);
        }
      })
      .catch((error) => {
        console.error("[nextpulse] Failed to load metadata:", error);
      });

    // Fetch runtime config for overlay position
    fetch("/api/nextpulse/config")
      .then((res) => (res.ok ? res.json() : null))
      .then((config: RuntimeConfig | null) => {
        if (config?.overlayPosition) {
          setPosition(config.overlayPosition);
        }
      })
      .catch(() => {
        // Silently fail - use default position
      });
  }, []);

  // Track route changes for session management
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    // Get current pathname from window.location (works in browser)
    const currentPath = typeof window !== "undefined" ? window.location.pathname : null;

    if (currentPath && currentPath !== pathname) {
      // End previous session
      if (pathname) {
        endSession();
      }

      // Begin new session
      setPathnameState(currentPath);
      setCurrentRoute(currentPath);
      beginSession(currentPath);
    }

    // Also listen for popstate events (browser back/forward)
    const handlePopState = () => {
      const newPath = window.location.pathname;
      if (newPath !== pathname) {
        endSession();
        setPathnameState(newPath);
        setCurrentRoute(newPath);
        beginSession(newPath);
      }
    };

    window.addEventListener("popstate", handlePopState);

    // Cleanup: end session on unmount
    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (pathname) {
        endSession();
      }
    };
  }, [pathname]);

  // Only show in development
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  if (!mounted || !metadata) {
    return null;
  }

  return (
    <>
      <AnvilButton
        isOpen={isOpen}
        onToggle={() => setIsOpen((prev) => !prev)}
        position={position}
      />
      {isOpen && <Panel metadata={metadata} position={position} />}
    </>
  );
}
