// ============================================================
// MIANX.AI V3 — Authentication Configuration
// NextAuth v4 + Credentials Provider + JWT Strategy
// ============================================================

import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { db } from './db'

/**
 * NextAuth configuration for Mianx.ai V3.
 *
 * Strategy: JWT (stateless, no DB sessions)
 * Provider: Credentials (email + password)
 * Callbacks: Resolve user from Profile model, attach org context
 */
export const authOptions: NextAuthOptions = {
  // JWT strategy — no database sessions needed
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // Cookie settings
  cookies: {
    sessionToken: {
      name: `${process.env.NEXTAUTH_URL?.startsWith('https') ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },

  // JWT callbacks
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Initial sign in — attach user info to token
      if (user) {
        token.userId = user.id
        token.email = user.email
        token.displayName = (user as unknown as Record<string, unknown>).displayName as string ?? ''
      }

      // Session update (e.g., after org switch)
      if (trigger === 'update' && session) {
        token = { ...token, ...session }
      }

      return token
    },

    async session({ session, token }) {
      if (session.user && token.userId) {
        (session.user as unknown as Record<string, unknown>).id = token.userId as string
        session.user.email = token.email as string
        (session.user as unknown as Record<string, unknown>).displayName = token.displayName as string
      }
      return session
    },
  },

  // Pages (custom)
  pages: {
    signIn: undefined, // Handled by client-side SPA router
    error: undefined,   // Handled by client-side
  },

  // Providers
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = credentials.email as string
        const password = credentials.password as string

        // Look up user by email
        const profile = await db.profile.findUnique({
          where: { email: email.toLowerCase() },
        })

        if (!profile?.passwordHash) {
          // No account or OAuth-only account (no password set)
          return null
        }

        // Verify password
        const isValid = await compare(password, profile.passwordHash)
        if (!isValid) {
          return null
        }

        // Return user object for JWT callback
        return {
          id: profile.id,
          email: profile.email,
          name: profile.displayName || email.split('@')[0],
        }
      },
    }),
  ],
}
