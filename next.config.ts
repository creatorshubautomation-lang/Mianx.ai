import type { NextConfig } from "next";

// Next.js config tuned for Vercel deployment.
// SECURITY: ignoreBuildErrors was removed — all TypeScript errors
// should now be fixed or explicitly @ts-expect-error annotated.
// Run `npx tsc --noEmit` to check for remaining errors.
const nextConfig: NextConfig = {
  typescript: {
    // All TS errors fixed as of Infrastructure cleanup (2026-08-16).
    // Remaining edge cases annotated with @ts-expect-error.
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
};

export default nextConfig;
