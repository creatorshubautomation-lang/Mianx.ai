// ============================================================
// MIANX.AI V3 — NextAuth API Route Handler
// With rate limiting on sign-in attempts
//
// Rate limiting is FAIL-CLOSED: if the rate-limit DB operation
// fails, the request is rejected with 429. This prevents brute-
// force attacks from exploiting DB unavailability.
// ============================================================

import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { AuthErrors } from '@/lib/auth-errors'

const LOGIN_RATE_LIMIT = 10
const LOGIN_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

const handler = async (req: Request, context: { params: Promise<{ nextauth: string[] }> }) => {
  // Rate limit sign-in attempts
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') ?? 'callback'

  if (action === 'callback' && req.method === 'POST') {
    const clientIp = getClientIp(req)
    // failClosed: true — auth endpoint, reject on DB failure
    const rateResult = await rateLimit(`login:${clientIp}`, LOGIN_RATE_LIMIT, LOGIN_WINDOW_MS, true)
    if (!rateResult.success) {
      return new Response(
        JSON.stringify({ error: AuthErrors.RATE_LIMITED }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': String(Math.ceil((rateResult.resetAt - Date.now()) / 1000)) },
        },
      )
    }
  }

  // Delegate to NextAuth handler
  return NextAuth(authOptions)(req, context)
}

export { handler as GET, handler as POST }
