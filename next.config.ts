import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["ssh2"],
  devIndicators: false,
};

export default nextConfig;
