import type { NextConfig } from "next";

/**
 * The desktop app (Tauri) loads the screens as static files and has no
 * server: build them with `output: "export"`, and leave out every `.ts`
 * special file — the /api route handlers and the PWA manifest — by accepting
 * only `.tsx` pages and layouts. Redirects and headers need a server too.
 */
const desktopConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  pageExtensions: ["tsx"],
};

const nextConfig: NextConfig = process.env.NEXT_TARGET === "desktop" ? desktopConfig : {
  // Addresses from before the navigation was restructured (screens sprint 1).
  redirects() {
    return Promise.resolve([
      { source: "/daily", destination: "/", permanent: true },
      { source: "/manage", destination: "/notes", permanent: true },
    ]);
  },
  headers() {
    return Promise.resolve([
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // The service worker must never be served stale, or updates stall.
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ]);
  },
};

export default nextConfig;
