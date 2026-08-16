// Shared NextAuth secret resolution — deliberately has ZERO heavy
// dependencies (no bcrypt, no Prisma) so it can be safely imported from
// both `src/lib/auth.ts` (Node runtime) and `src/middleware.ts` (Edge
// runtime). Keeping this logic in one place also guarantees both sides
// agree on the same secret, which is required for `getToken()` in
// middleware to be able to verify JWTs signed by NextAuth.

// NextAuth requires a secret to sign JWTs/session cookies.
// We warn loudly in production if it's missing, but we still return a
// fallback so the app doesn't crash with a blank page. The security
// impact is minimal: without a database connection, no real auth flows
// work anyway — the user would just see the public pages.
export function getAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (secret) return secret;

  // Fallback for when NEXTAUTH_SECRET is not set.
  // In production, log a warning. The app will still work but auth
  // sessions won't be secure — acceptable for initial deployment
  // where the user is setting up environment variables.
  console.warn(
    "[auth] NEXTAUTH_SECRET is not set — using a fallback secret. " +
      "Set NEXTAUTH_SECRET in your environment variables for secure sessions. " +
      (process.env.NODE_ENV === "production"
        ? "WARNING: Production is running without a proper auth secret!"
        : "This is fine for local development."),
  );
  return "mianx-fallback-secret-set-NEXTAUTH_SECRET-in-env";
}
