/**
 * Interactive wizard utilities for NextPulse init
 */

import readline from "readline";
import pc from "picocolors";
import type { NextPulseConfig } from "./config.js";

export interface WizardAnswers {
  appRoot: string;
  overlayPosition: NextPulseConfig["overlayPosition"];
  openBrowserOnStart: boolean;
}

/**
 * Check if we're in an interactive terminal
 */
export function isInteractive(): boolean {
  return process.stdout.isTTY && process.stdin.isTTY;
}

/**
 * Create a readline interface for user input
 */
function createInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Ask a yes/no question
 */
function askYesNo(question: string, defaultValue: boolean = true): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface();
    const defaultText = defaultValue ? "Y/n" : "y/N";
    rl.question(pc.cyan(`[nextpulse] ${question} (${defaultText}): `), (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      if (normalized === "") {
        resolve(defaultValue);
      } else {
        resolve(normalized === "y" || normalized === "yes");
      }
    });
  });
}

/**
 * Ask a multiple choice question
 */
function askChoice<T>(
  question: string,
  choices: Array<{ value: T; label: string; default?: boolean }>
): Promise<T> {
  return new Promise((resolve) => {
    const rl = createInterface();

    // Find default choice
    const defaultChoice = choices.findIndex((c) => c.default);
    const defaultIndex = defaultChoice >= 0 ? defaultChoice + 1 : 1;

    // Print question and choices
    console.log(pc.cyan(`[nextpulse] ${question}`));
    choices.forEach((choice, index) => {
      const marker = index + 1 === defaultIndex ? pc.dim("(default)") : "";
      console.log(pc.dim(`  ${index + 1}) ${choice.label} ${marker}`));
    });

    rl.question(pc.cyan(`[nextpulse] Enter choice (1-${choices.length}): `), (answer) => {
      rl.close();
      const choiceIndex = parseInt(answer.trim(), 10) - 1;

      if (isNaN(choiceIndex) || choiceIndex < 0 || choiceIndex >= choices.length) {
        // Invalid choice, use default
        resolve(choices[defaultIndex - 1].value);
      } else {
        resolve(choices[choiceIndex].value);
      }
    });
  });
}

/**
 * Ask for text input
 */
function askText(question: string, defaultValue: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface();
    rl.question(pc.cyan(`[nextpulse] ${question} (default: ${defaultValue}): `), (answer) => {
      rl.close();
      const trimmed = answer.trim();
      resolve(trimmed || defaultValue);
    });
  });
}

/**
 * Run the init wizard
 */
export async function runInitWizard(
  detectedAppRoot: string,
  detectedRouterType: "app" | "pages" | null,
  existingConfig: Partial<NextPulseConfig> | null
): Promise<WizardAnswers> {
  console.log(pc.cyan("\n[nextpulse] Welcome to NextPulse setup!\n"));

  // Question 1: Confirm app root and router type
  let appRoot = detectedAppRoot;
  if (detectedRouterType) {
    const routerName = detectedRouterType === "app" ? "App Router" : "Pages Router";
    const useDetected = await askYesNo(
      `Detected Next.js app at ${detectedAppRoot} using ${routerName}. Use this location?`,
      true
    );

    if (!useDetected) {
      appRoot = await askText("Enter the path to your Next.js app root", detectedAppRoot);
    }
  } else {
    appRoot = await askText(
      "Could not auto-detect your Next.js app. Enter the path to your app root",
      "."
    );
  }

  // Question 2: Overlay position
  const overlayPosition = await askChoice<NextPulseConfig["overlayPosition"]>(
    "Where should the NextPulse overlay appear by default?",
    [
      { value: "bottomRight", label: "Bottom right", default: true },
      { value: "bottomLeft", label: "Bottom left" },
      { value: "topRight", label: "Top right" },
      { value: "topLeft", label: "Top left" },
    ]
  );

  // Question 3: Open browser on start
  const openBrowserOnStart = await askYesNo(
    "When you run `nextpulse serve`, should it try to open your browser automatically?",
    false
  );

  console.log(); // Empty line for spacing

  return {
    appRoot,
    overlayPosition,
    openBrowserOnStart,
  };
}
