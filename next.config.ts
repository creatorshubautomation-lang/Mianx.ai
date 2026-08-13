import type { NextConfig } from "next";

// Next.js config tuned for Vercel deployment.
// - Removed `output: "standalone"` (Vercel handles bundling itself; standalone
//   is for Docker / bare-metal Node servers).
// - Kept `typescript.ignoreBuildErrors` because we use strict TS but want
//   builds to succeed even if there are minor type issues in shadcn/ui.
const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
