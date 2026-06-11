import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        // Static JSON API files under /api/v1/* — served as public static assets.
        // Cache for 12 hours (signals are regenerated once daily by CI).
        // CORS wildcard so browser clients can fetch cross-origin.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=43200, stale-while-revalidate=86400" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, HEAD, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
