import type { NextConfig } from "next";

export default {
  async rewrites() {
    return [
      {
        source: "/.well-known/:path*",
        destination: "/api/well-known/:path*",
      },
    ];
  },
} satisfies NextConfig;
