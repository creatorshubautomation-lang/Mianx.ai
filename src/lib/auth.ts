import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getAuthSecret } from "@/lib/auth-secret";

// Helper to compute the canonical app URL.
// Handles Vercel preview deployments, production, and local dev.
function getAppUrl(): string {
  // Vercel provides these automatically
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // Explicit override (production)
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }
  // Local development
  return "http://localhost:3000";
}

// Augment NextAuth types to include `role` on User and Session
declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    name?: string | null;
    role?: string;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role?: string;
    email?: string;
    name?: string | null;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          // Normalize email (trim + lowercase) to avoid case issues
          const email = credentials.email.trim().toLowerCase();

          const user = await db.user.findUnique({
            where: { email },
          });

          if (!user) {
            return null;
          }

          const valid = await bcrypt.compare(
            credentials.password,
            user.passwordHash,
          );

          if (!valid) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        } catch (error) {
          console.error("[auth] authorize error:", error);
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/",
  },
  callbacks: {
    // JWT callback — runs on every session check.
    // IMPORTANT: We re-fetch the user's role from DB on each call so that
    // if the role changes (e.g., CLIENT → ADMIN via SQL), the session
    // immediately reflects the new role without requiring logout/login.
    async jwt({ token, user }) {
      // Initial sign-in: store user info in token
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = (user as { role: string }).role;
        return token;
      }

      // Subsequent calls (token already exists): refresh role from DB
      // This ensures role changes in DB are reflected without re-login
      if (token.id) {
        try {
          const dbUser = await db.user.findUnique({
            where: { id: token.id },
            select: { role: true, name: true, email: true },
          });

          if (dbUser) {
            // Always use the latest role from database
            token.role = dbUser.role;
            token.name = dbUser.name;
            token.email = dbUser.email;
          }
        } catch (error) {
          console.error("[auth] jwt refresh error:", error);
          // If DB fails, keep existing token (don't break auth)
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string | null;
        // Use the refreshed role from the jwt callback
        session.user.role = (token.role as string) || "CLIENT";
      }
      return session;
    },
  },
  secret: getAuthSecret(),
  // Explicit URL to prevent "Invalid URL" errors on Vercel
  url: getAppUrl(),
};
