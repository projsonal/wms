import type { NextConfig } from "next";

const BACKEND_ORIGIN = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/stockrsd";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/gowms/:path*",
        destination: `${BACKEND_ORIGIN}/:path*`,
      },
    ];
  },
};

export default nextConfig;
