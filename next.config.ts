import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Addresses from before the navigation was restructured (screens sprint 1).
  redirects() {
    return Promise.resolve([
      { source: "/daily", destination: "/", permanent: true },
      { source: "/manage", destination: "/notes", permanent: true },
    ]);
  },
};

export default nextConfig;
