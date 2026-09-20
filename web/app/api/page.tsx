"use client";

import { useEffect } from "react";
import Script from "next/script";

// ponytail: CDN-loaded swagger-ui-dist instead of the swagger-ui-react npm
// package — no new dependency, no React-version peer-dep juggling.
export default function ApiDocsPage() {
  useEffect(() => {
    function init() {
      window.SwaggerUIBundle?.({
        url: "/openapi.json",
        dom_id: "#swagger-ui",
        presets: [window.SwaggerUIBundle.presets.apis],
      });
    }
    if (window.SwaggerUIBundle) init();
    else document.addEventListener("swagger-ui-ready", init, { once: true });
    return () => document.removeEventListener("swagger-ui-ready", init);
  }, []);

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css"
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"
        strategy="afterInteractive"
        onLoad={() => document.dispatchEvent(new Event("swagger-ui-ready"))}
      />
      <div id="swagger-ui" />
    </>
  );
}

declare global {
  interface Window {
    SwaggerUIBundle?: {
      (config: { url: string; dom_id: string; presets: unknown[] }): void;
      presets: { apis: unknown };
    };
  }
}
