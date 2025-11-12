import { describe, it, expect } from "vitest";
import { insertImport, insertComponent } from "../src/utils/injection.js";

const pagesApp = `import React from "react";

export default function MyApp({ Component, pageProps }) {
  return (<main><Component {...pageProps} /></main>);
}`;

describe("injection", () => {
  describe("idempotency", () => {
    it("should be idempotent for import", () => {
      const once = insertImport(pagesApp);
      const twice = insertImport(once);
      expect(twice).toBe(once);
    });

    it("should be idempotent for component", () => {
      const withImport = insertImport(pagesApp);
      const once = insertComponent(withImport, "pages");
      const twice = insertComponent(once, "pages");
      expect(twice).toBe(once);
    });
  });

  describe("component injection", () => {
    it("injects component inside return", () => {
      const withComp = insertComponent(pagesApp, "pages");
      expect(withComp).toMatch(/NextPulseDev/);
      expect(withComp).toMatch(/NODE_ENV === "development"/);
    });

    it("injects before </body> for app router", () => {
      const appLayout = `export default function Layout({ children }) {
  return (
    <html>
      <body>
        {children}
      </body>
    </html>
  );
}`;
      const withComp = insertComponent(appLayout, "app");
      expect(withComp).toMatch(/NextPulseDev/);
      expect(withComp).toMatch(/<\/body>/);
    });
  });
});
