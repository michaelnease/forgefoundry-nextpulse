/**
 * Generate Next.js API route code that serves the nextpulse config
 * For App Router: returns route.ts format
 * For Pages Router: returns pages/api format (handled in CLI)
 */
export function generateConfigApiRoute(projectRoot: string): string {
  return `import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export async function GET() {
  try {
    // Try to read from project root (works in dev and build)
    const configPath = join(process.cwd(), "nextpulse.config.json");
    
    if (!existsSync(configPath)) {
      return NextResponse.json({ overlayPosition: "bottomRight" }, { status: 200 });
    }

    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    
    // Only return safe config values (client-side safe)
    // overlayPosition is the only runtime-configurable option
    return NextResponse.json({
      overlayPosition: config.overlayPosition || "bottomRight",
    });
  } catch (error) {
    // Return defaults on error
    return NextResponse.json({ overlayPosition: "bottomRight" }, { status: 200 });
  }
}
`;
}

/**
 * Generate Pages Router API route code
 */
export function generatePagesRouterApiRoute(projectRoot: string): string {
  return `import type { NextApiRequest, NextApiResponse } from "next";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).end();
  }

  try {
    // Try to read from project root (works in dev and build)
    const configPath = join(process.cwd(), "nextpulse.config.json");
    
    if (!existsSync(configPath)) {
      return res.json({ overlayPosition: "bottomRight" });
    }

    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    
    // Only return safe config values (client-side safe)
    // overlayPosition is the only runtime-configurable option
    return res.json({
      overlayPosition: config.overlayPosition || "bottomRight",
    });
  } catch (error) {
    // Return defaults on error
    return res.json({ overlayPosition: "bottomRight" });
  }
}
`;
}
