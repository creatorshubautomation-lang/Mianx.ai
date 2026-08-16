import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthSecret } from "@/lib/auth-secret";

// ─────────────────────────────────────────────
//  Security Headers Configuration
// ─────────────────────────────────────────────

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "X-DNS-Prefetch-Control": "on",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
} as const;

// Content Security Policy for production security
// Allows: self, Next.js assets, Google Fonts, inline styles (for Tailwind/React)
function getCSPHeader(req: NextRequest): string {
  const isDev = process.env.NODE_ENV === "development";
  const nonce = crypto.randomUUID();

  const base = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `img-src 'self' data: blob: https:`,
    `connect-src 'self' https: wss:${isDev ? " ws:" : ""}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
  ].join("; ");

  return base;
}

function applySecurityHeaders(
  response: NextResponse,
  req: NextRequest,
): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  response.headers.set("Content-Security-Policy", getCSPHeader(req));

  // Remove server identifying headers
  response.headers.delete("X-Powered-By");
  response.headers.delete("Server");

  return response;
}

// ─────────────────────────────────────────────
//  API Admin Auth Guard
// ─────────────────────────────────────────────

async function handleAdminRoute(
  req: NextRequest,
): Promise<NextResponse> {
  const token = await getToken({ req, secret: getAuthSecret() });

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (token.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Forbidden — admin role required" },
      { status: 403 },
    );
  }

  return NextResponse.next();
}

// ─────────────────────────────────────────────
//  API Route — Apply security headers to all API responses
// ─────────────────────────────────────────────

async function handleApiRoute(
  req: NextRequest,
): Promise<NextResponse> {
  // Admin routes need auth check
  if (req.nextUrl.pathname.startsWith("/api/admin")) {
    return handleAdminRoute(req);
  }

  // Apply security headers to all API responses
  const response = NextResponse.next();
  return applySecurityHeaders(response, req);
}

// ─────────────────────────────────────────────
//  Page Route — Apply security headers to page responses
// ─────────────────────────────────────────────

function handlePageRoute(req: NextRequest): NextResponse {
  const response = NextResponse.next();
  return applySecurityHeaders(response, req);
}

// ─────────────────────────────────────────────
//  Main Middleware
// ─────────────────────────────────────────────

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // API routes
  if (pathname.startsWith("/api/")) {
    return handleApiRoute(req);
  }

  // Page routes (including _next/static, etc.)
  return handlePageRoute(req);
}

export const config = {
  matcher: [
    // Match all API routes
    "/api/:path*",
    // Match all page routes except Next.js internals and static files
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
