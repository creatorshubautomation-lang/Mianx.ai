// Shared NextAuth secret resolution — deliberately has ZERO heavy
// dependencies (no bcrypt, no Prisma) so it can be safely imported from
// both `src/lib/auth.ts` (Node runtime) and `src/middleware.ts` (Edge
// runtime). Keeping this logic in one place also guarantees both sides
// agree on the same secret, which is required for `getToken()` in
// middleware to be able to verify JWTs signed by NextAuth.

// NextAuth requires a secret to sign JWTs/session cookies. A predictable
// fallback value here would mean anyone could forge valid session tokens
// if the env var is ever missing in production — so we fail loudly instead.
export function getAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[auth] NEXTAUTH_SECRET is not set. Refusing to start with a " +
        "predictable fallback secret in production — set NEXTAUTH_SECRET " +
        "in your environment variables (min 32 random chars).",
    );
  }

  // Local/dev-only fallback so `next dev` doesn't hard-fail without setup.
  console.warn(
    "[auth] NEXTAUTH_SECRET is not set — using an insecure development-only " +
      "fallback. Set NEXTAUTH_SECRET in .env before deploying.",
  );
  return "dev-only-insecure-secret-do-not-use-in-production";
}
