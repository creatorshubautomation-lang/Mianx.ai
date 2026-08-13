import { PrismaClient } from "@prisma/client";

// Lazy-initialized Prisma client.
// Critical for Vercel/serverless: we must NOT instantiate PrismaClient at
// module load time, because Vercel's build step evaluates every module
// (including API routes) during static generation. If PrismaClient tries
// to connect with an invalid DATABASE_URL at build time, the build fails
// with "TypeError: Invalid URL".
//
// ALSO: Supabase connection pooler (port 6543, Transaction Mode) doesn't
// support prepared statements properly. We need to append
// ?pgbouncer=true&prepare=false to DATABASE_URL if missing.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  let databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.warn(
      "[db] DATABASE_URL not set — database calls will fail. " +
        "Set DATABASE_URL in your Vercel project settings.",
    );
  } else {
    // Auto-fix Supabase pooler connection issues.
    // Supabase Transaction Mode pooler (port 6543) needs:
    //   - pgbouncer=true (tells Prisma to use PgBouncer-compatible mode)
    //   - prepare=false (disables prepared statements that break with pooling)
    //
    // If the URL uses port 6543 (Supabase pooler) and doesn't already have
    // these params, append them automatically.
    const isPoolerUrl =
      databaseUrl.includes(":6543") || databaseUrl.includes("pooler.supabase");

    if (isPoolerUrl) {
      const hasPgbouncer = databaseUrl.includes("pgbouncer=");
      const hasPrepare = databaseUrl.includes("prepare=");

      if (!hasPgbouncer || !hasPrepare) {
        // Add params — handle both ? and & cases
        const separator = databaseUrl.includes("?") ? "&" : "?";
        const params: string[] = [];
        if (!hasPgbouncer) params.push("pgbouncer=true");
        if (!hasPrepare) params.push("prepare=false");

        // Also add connection_limit for serverless
        if (!databaseUrl.includes("connection_limit=")) {
          params.push("connection_limit=1");
        }

        databaseUrl = databaseUrl + separator + params.join("&");
        console.log("[db] Auto-appended pooler params to DATABASE_URL");
      }
    }

    // Set the modified URL back to process.env so Prisma picks it up
    process.env.DATABASE_URL = databaseUrl;
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
