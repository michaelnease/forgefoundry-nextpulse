import { describe, it, expect } from "vitest";
import {
  hasPackageImport,
  hasComponent,
  insertPackageImport,
  insertComponentZeroProps,
} from "../src/utils/injectionLocal.js";

describe("injectionLocal", () => {
  describe("hasPackageImport", () => {
    it("should detect package import", () => {
      const code = `import { NextPulse } from "@forgefoundry/nextpulse";`;
      expect(hasPackageImport(code)).toBe(true);
    });

    it("should return false for no import", () => {
      const code = `import React from "react";`;
      expect(hasPackageImport(code)).toBe(false);
    });

    it("should return false for local import", () => {
      const code = `import { NextPulse } from "../nextpulse/NextPulseDev";`;
      expect(hasPackageImport(code)).toBe(false);
    });
  });

  describe("hasComponent", () => {
    it("should detect NextPulse component", () => {
      const code = `<NextPulse />`;
      expect(hasComponent(code)).toBe(true);
    });

    it("should detect guarded NextPulse", () => {
      const code = `{process.env.NODE_ENV === "development" && <NextPulse />}`;
      expect(hasComponent(code)).toBe(true);
    });

    it("should return false for no component", () => {
      const code = `<div>Hello</div>`;
      expect(hasComponent(code)).toBe(false);
    });
  });

  describe("insertPackageImport", () => {
    it("should insert import after existing imports", () => {
      const code = `import React from "react";
import { useState } from "react";

export default function App() {
  return <div>App</div>;
}`;

      const result = insertPackageImport(code);

      expect(result).toContain('import { NextPulse } from "@forgefoundry/nextpulse";');
      expect(result.indexOf('from "@forgefoundry/nextpulse"')).toBeGreaterThan(
        result.indexOf('from "react"')
      );
    });

    it("should insert import at top if no imports", () => {
      const code = `export default function App() {
  return <div>App</div>;
}`;

      const result = insertPackageImport(code);

      expect(result).toMatch(/^import { NextPulse }/);
    });

    it("should skip if import already exists", () => {
      const code = `import { NextPulse } from "@forgefoundry/nextpulse";

export default function App() {
  return <div>App</div>;
}`;

      const result = insertPackageImport(code);

      expect(result).toBe(code);
    });
  });

  describe("insertComponentZeroProps", () => {
    it("should insert component before </body> in app router", () => {
      const code = `export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
      </body>
    </html>
  );
}`;

      const result = insertComponentZeroProps(code, "app");

      expect(result).toContain('{process.env.NODE_ENV === "development" && <NextPulse />}');
      expect(result).toContain("</body>");
      expect(result.indexOf("<NextPulse />")).toBeLessThan(result.indexOf("</body>"));
    });

    it("should insert component with NO props", () => {
      const code = `export default function RootLayout({ children }) {
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}`;

      const result = insertComponentZeroProps(code, "app");

      expect(result).toContain("<NextPulse />");
      expect(result).not.toContain("<NextPulse appName");
      expect(result).not.toContain("<NextPulse nextVersion");
    });

    it("should skip if component already exists", () => {
      const code = `export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        {process.env.NODE_ENV === "development" && <NextPulse />}
      </body>
    </html>
  );
}`;

      const result = insertComponentZeroProps(code, "app");

      expect(result).toBe(code);
    });

    it("should handle pages router", () => {
      const code = `export default function App({ Component, pageProps }) {
  return (
    <Component {...pageProps} />
  );
}`;

      const result = insertComponentZeroProps(code, "pages");

      expect(result).toContain("<NextPulse />");
    });
  });
});
