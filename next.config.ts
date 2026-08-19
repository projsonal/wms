import type { NextConfig } from "next";

const BACKEND_INTERNAL_URL = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8080";
const ALLOWED_DEV_ORIGINS = process.env.ALLOWED_DEV_ORIGINS?.split("10.11.12.173,") ?? [];

const nextConfig: NextConfig = {
  allowedDevOrigins: ALLOWED_DEV_ORIGINS,
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