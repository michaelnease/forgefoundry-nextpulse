/**
 * Status icon component for git dirty state
 * Part of NextPulse runtime - lives in package
 */

import React from "react";

interface StatusIconProps {
  dirty: boolean;
}

export function StatusIcon({ dirty }: StatusIconProps) {
  if (dirty) {
    // Red warning icon
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "inline-block", verticalAlign: "middle", marginLeft: "4px" }}
      >
        <path d="M7 0L0 12h14L7 0z" fill="#FF5E5E" />
        <path d="M7 5v3M7 9.5v1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  // Green checkmark
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "inline-block", verticalAlign: "middle", marginLeft: "4px" }}
    >
      <circle cx="7" cy="7" r="7" fill="#3CCF4E" />
      <path
        d="M4 7l2 2 4-4"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
