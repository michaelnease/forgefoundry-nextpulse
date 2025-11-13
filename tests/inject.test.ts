import { describe, it, expect } from "vitest";
import {
  insertImport,
  insertComponent,
} from "../src/utils/injection.js";

describe("injection snapshots", () => {
  describe("App Router layout injection", () => {
    it("should inject into app/layout.tsx", () => {
      const before = `import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My App",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}`;

      const withImport = insertImport(before);
      const after = insertComponent(withImport, "app", {
        appName: "my-app",
        nextVersion: "^14.0.0",
        port: "3000",
        gitBranch: "main",
        gitSha: "abc123",
      });

      expect(after).toContain('import { NextPulse } from "@forgefoundry/nextpulse";');
      expect(after).toContain("NextPulse");
      expect(after).toContain('NODE_ENV === "development"');
      expect(after).toContain('appName="my-app"');
      expect(after).toContain('nextVersion="^14.0.0"');
      expect(after).toContain('port="3000"');
      expect(after).toContain('gitBranch="main"');
      expect(after).toContain('gitSha="abc123"');
      expect(after).toContain("</body>");
    });

    it("should be idempotent", () => {
      const content = `import { NextPulse } from "@forgefoundry/nextpulse/runtime";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        {process.env.NODE_ENV === "development" && <NextPulse />}
      </body>
    </html>
  );
}`;

      const result = insertComponent(content, "app");
      const matches = result.match(/NextPulse/g);
      expect(matches?.length).toBe(2); // One in import, one in JSX
    });
  });

  describe("Pages Router _app injection", () => {
    it("should inject into pages/_app.tsx", () => {
      // Pages Router injection works when return has parentheses
      const before = `import type { AppProps } from "next/app";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Component {...pageProps} />
  );
}`;

      const withImport = insertImport(before);
      const after = insertComponent(withImport, "pages", {
        appName: "my-pages-app",
        nextVersion: "^13.5.0",
      });

      expect(after).toContain('import { NextPulse } from "@forgefoundry/nextpulse";');
      expect(after).toContain("NextPulse");
      expect(after).toContain('NODE_ENV === "development"');
      expect(after).toContain("<Component");
      expect(after).toContain('appName="my-pages-app"');
      expect(after).toContain('nextVersion="^13.5.0"');
    });

    it("should be idempotent", () => {
      const content = `import { NextPulse } from "@forgefoundry/nextpulse/runtime";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      {process.env.NODE_ENV === "development" && <NextPulse />}
    </>
  );
}`;

      const result = insertComponent(content, "pages");
      const matches = result.match(/NextPulse/g);
      expect(matches?.length).toBe(2);
    });
  });
});

