// ============================================================
// MIANX.AI V3 — Security Middleware
// Adds security headers to ALL responses including auth endpoints.
// ============================================================

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Security headers applied to every response.
 * These headers protect against common web vulnerabilities.
 * Safe for all endpoints including NextAuth — no CSP/permissions-policy
 * that could interfere with OAuth redirects.
 */
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value)
  }

  // Add HSTS in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    )
  }

  return response
}

export const config = {
  // Apply to all routes except Next.js static assets
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
}
