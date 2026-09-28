import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
