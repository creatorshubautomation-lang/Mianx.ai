import type { NextConfig } from "next";

// Next.js config tuned for Vercel deployment.
// - Removed `output: "standalone"` (Vercel handles bundling itself; standalone
//   is for Docker / bare-metal Node servers).
// TODO(security-audit): `ignoreBuildErrors: true` silences TypeScript errors
// for the ENTIRE app, not just shadcn/ui as originally intended — that
// includes auth, payments, and DB code. Run `npx tsc --noEmit` locally,
// fix (or narrowly `@ts-expect-error`-annotate) the real errors, then
// remove this flag. Left enabled here because it couldn't be safely
// re-verified in this environment (Prisma client generation was blocked).
const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
};

export default nextConfig;
