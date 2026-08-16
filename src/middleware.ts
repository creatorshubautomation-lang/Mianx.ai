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

// Content Security Policy for production security.
// NOTE: We do NOT use nonce-based CSP because Next.js generates nonces
// during SSR independently, and middleware would inject a DIFFERENT nonce,
// causing ALL scripts to be blocked → blank page.
// Instead, we use 'self' + hash-based approach (Next.js handles this).
function getCSPHeader(req: NextRequest): string {
  const isDev = process.env.NODE_ENV === "development";

  const base = [
    `default-src 'self'`,
    // Allow scripts from self (Next.js bundles) and unsafe-eval in dev (HMR)
    `script-src 'self'${isDev ? " 'unsafe-eval' 'unsafe-inline'" : ""}`,
    // Allow inline styles (required by Tailwind CSS runtime + Radix UI)
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `img-src 'self' data: blob: https:`,
    // Allow API calls, WebSocket connections, and external resources
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
//  Page Route — SPA catch-all
// ─────────────────────────────────────────────
//  Mianx.ai is an SPA with a single entry point at `/`
//  (src/app/page.tsx). All views are rendered client-side
//  via Zustand + router.ts. We must rewrite ALL page
//  requests to `/` so Next.js serves our SPA shell,
//  then the client-side router handles the actual view.
// ─────────────────────────────────────────────

const SPA_REWRITE_PATHS = [
  "/",
  "/services",
  "/agents",
  "/pricing",
  "/about",
  "/use-cases",
  "/contact",
  "/templates",
  "/api-docs",
  "/academy",
  "/marketplace",
  "/login",
  "/signup",
  // Dashboard
  "/dashboard",
  "/dashboard/projects",
  "/dashboard/projects/new",
  "/dashboard/deliverables",
  "/dashboard/support",
  "/dashboard/settings",
  "/dashboard/missions",
  "/dashboard/tools",
  "/dashboard/approvals",
  "/dashboard/command-center",
  "/dashboard/budget",
  "/dashboard/trust",
  "/dashboard/agent-performance",
  "/admin",
];

function handlePageRoute(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  // If the request is for the root `/`, let it pass through normally
  if (pathname === "/") {
    return applySecurityHeaders(NextResponse.next(), req);
  }

  // Check if this is a known SPA path or a dynamic route
  const isKnownPath = SPA_REWRITE_PATHS.includes(pathname);

  // Match dynamic routes: /dashboard/projects/:id, /dashboard/missions/:id,
  // /dashboard/agent-performance/:name
  const isDynamicRoute =
    /^\/dashboard\/projects\/[^/]+$/.test(pathname) ||
    /^\/dashboard\/missions\/[^/]+$/.test(pathname) ||
    /^\/dashboard\/agent-performance\/[^/]+$/.test(pathname);

  if (isKnownPath || isDynamicRoute) {
    // Rewrite to `/` so Next.js serves our SPA shell (page.tsx)
    // The client-side router will handle the actual view from the URL
    const url = req.nextUrl.clone();
    url.pathname = "/";
    const response = NextResponse.rewrite(url);
    return applySecurityHeaders(response, req);
  }

  // For any other path (unknown), also rewrite to SPA shell
  // so the client-side 404 handler can take over
  const url = req.nextUrl.clone();
  url.pathname = "/";
  const response = NextResponse.rewrite(url);
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

  // Page routes — SPA rewrite
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
