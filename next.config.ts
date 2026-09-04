const BACKEND_INTERNAL_URL =
  (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.BACKEND_INTERNAL_URL ?? "http://localhost:8080";

const nextConfig = {

  allowedDevOrigins: ["10.11.12.173"],
  async rewrites() {
    return [
      {
        source: "/api/inventory-backend/:path*",
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