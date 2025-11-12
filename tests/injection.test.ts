import { describe, it, expect } from "vitest";
import {
  hasImport,
  hasComponent,
  injectImport,
  injectIntoAppLayout,
  injectIntoPagesApp,
} from "../src/utils/injection.js";

describe("injection", () => {
  describe("hasImport", () => {
    it("should detect existing import", () => {
      const content = 'import { NextPulseDev } from "@forged/nextpulse/runtime";';
      expect(hasImport(content)).toBe(true);
    });

    it("should detect import with single quotes", () => {
      const content = "import { NextPulseDev } from '@forged/nextpulse/runtime';";
      expect(hasImport(content)).toBe(true);
    });

    it("should return false if import not found", () => {
      const content = "import React from 'react';";
      expect(hasImport(content)).toBe(false);
    });
  });

  describe("hasComponent", () => {
    it("should detect existing component", () => {
      const content = '{process.env.NODE_ENV === "development" && <NextPulseDev />}';
      expect(hasComponent(content)).toBe(true);
    });

    it("should return false if component not found", () => {
      const content = "<div>Hello</div>";
      expect(hasComponent(content)).toBe(false);
    });
  });

  describe("injectImport", () => {
    it("should add import if not present", () => {
      const content = "import React from 'react';\n\nexport default function App() {}";
      const result = injectImport(content);
      expect(result).toContain('from "@forged/nextpulse/runtime"');
      expect(result).toContain("import React");
    });

    it("should not duplicate import", () => {
      const content = 'import { NextPulseDev } from "@forged/nextpulse/runtime";\nexport default function App() {}';
      const result = injectImport(content);
      const matches = result.match(/@forged\/nextpulse\/runtime/g);
      expect(matches?.length).toBe(1);
    });
  });

  describe("injectIntoAppLayout", () => {
    it("should inject component before </body>", () => {
      const content = `export default function Layout({ children }) {
  return (
    <html>
      <body>
        {children}
      </body>
    </html>
  );
}`;
      const result = injectIntoAppLayout(content);
      expect(result).toContain("NextPulseDev");
      expect(result).toContain('NODE_ENV === "development"');
      expect(result).toContain("</body>");
    });

    it("should not duplicate component", () => {
      const content = `export default function Layout() {
  return (
    <html>
      <body>
        {process.env.NODE_ENV === "development" && <NextPulseDev />}
      </body>
    </html>
  );
}`;
      const result = injectIntoAppLayout(content);
      const matches = result.match(/NextPulseDev/g);
      expect(matches?.length).toBe(1);
    });
  });

  describe("injectIntoPagesApp", () => {
    it("should inject component after <Component />", () => {
      const content = `export default function App({ Component, pageProps }) {
  return (
    <Component {...pageProps} />
  );
}`;
      const result = injectIntoPagesApp(content);
      expect(result).toContain("NextPulseDev");
      expect(result).toContain("<Component");
    });

    it("should not duplicate component", () => {
      const content = `export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      {process.env.NODE_ENV === "development" && <NextPulseDev />}
    </>
  );
}`;
      const result = injectIntoPagesApp(content);
      const matches = result.match(/NextPulseDev/g);
      expect(matches?.length).toBe(1);
    });
  });
});

