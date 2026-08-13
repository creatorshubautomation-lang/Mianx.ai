import { PrismaClient } from "@prisma/client";

// Lazy-initialized Prisma client.
// Critical for Vercel/serverless: we must NOT instantiate PrismaClient at
// module load time, because Vercel's build step evaluates every module
// (including API routes) during static generation. If PrismaClient tries
// to connect with an invalid DATABASE_URL at build time, the build fails
// with "TypeError: Invalid URL".

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  // Allow builds without a real DB by checking env var presence
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    // During build (no DATABASE_URL), return a stub that throws only when used
    console.warn(
      "[db] DATABASE_URL not set — database calls will fail. " +
        "Set DATABASE_URL in your Vercel project settings.",
    );
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["query", "error"],
  });
}

export const db =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
