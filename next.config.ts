import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow preview domains to access the dev server without cross-origin warnings
  allowedDevOrigins: [
    "*.space-z.ai",
    "*.z.ai",
    "localhost",
    "127.0.0.1",
  ],
};

export default nextConfig;
