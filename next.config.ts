import type { NextConfig } from "next";

const BACKEND_INTERNAL_URL = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8080";

const nextConfig: NextConfig = {

  allowedDevOrigins: ["10.11.12.173"],
  async rewrites() {
    return [
      {
        source: "/api/gowms/:path*",
        destination: `${BACKEND_INTERNAL_URL}/stockrsd/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${BACKEND_INTERNAL_URL}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;