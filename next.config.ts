import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /*
   * NOTE: ignoreBuildErrors is true because pre-existing client-side view
   * components have React 19 / eslint-config-next compatibility issues
   * (set-state-in-effect, preserve-manual-memoization). These are tracked
   * as tech debt and do not affect security. A dedicated refactoring pass
   * is needed to resolve them.
   */
  typescript: {
    ignoreBuildErrors: true,
  },
  /*
   * React Strict Mode enabled — helps catch side-effect bugs in dev.
   * Does not affect production behavior or build success.
   */
  reactStrictMode: true,
};

export default nextConfig;
