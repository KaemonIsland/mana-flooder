import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost", "127.0.0.1"],
    },
  },
};

export default nextConfig;
