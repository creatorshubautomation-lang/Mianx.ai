import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

// Content Security Policy — relaxed for Next.js SPA compatibility.
// Next.js + next-themes + RSC all generate inline <script> tags, so we
// MUST allow 'unsafe-inline' in script-src. Without it, ALL React
// hydration is blocked → blank page with only CSS background visible.
// Other security headers (X-Frame-Options, HSTS, etc.) still protect
// against XSS, clickjacking, and transport-layer attacks.
function getCSPHeader(req: NextRequest): string {
  const isDev = process.env.NODE_ENV === "development";

  const base = [
    `default-src 'self'`,
    // 'unsafe-inline' REQUIRED — Next.js RSC, next-themes, and framer-motion
    // all inject inline scripts. 'unsafe-eval' needed in dev for Turbopack HMR.
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    // 'unsafe-inline' REQUIRED — Tailwind CSS runtime + Radix UI components
    // inject dynamic styles. Google Fonts for Inter + JetBrains Mono.
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `img-src 'self' data: blob: https:`,
    // API calls, WebSocket (SSE), external resources
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

// NOTE: Admin auth guard is handled at the API route level
// (each /api/admin/* route checks the session server-side).
// We keep middleware lightweight to avoid Edge Runtime crashes.
async function handleAdminRoute(
  req: NextRequest,
): Promise<NextResponse> {
  // Pass through — actual auth check happens in the API handler
  const response = NextResponse.next();
  return applySecurityHeaders(response, req);
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
  // Multi-tenancy
  "/dashboard/organizations",
  "/dashboard/billing",
  // Organization extensions
  "/dashboard/workflows",
  "/dashboard/integrations",
  "/dashboard/ai-agents",
  "/dashboard/audit-log",
  // V2 Platform
  "/dashboard/monitoring",
  "/dashboard/security",
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
    /^\/dashboard\/agent-performance\/[^/]+$/.test(pathname) ||
    /^\/dashboard\/organizations\/[^/]+\/settings$/.test(pathname);

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
    "/((?!_next/|favicon.ico|robots.txt|sitemap.xml|sitemap.xsl).*)",
  ],
};
