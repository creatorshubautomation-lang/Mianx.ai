import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessOrganization } from "@/lib/authorization";

// ─────────────────────────────────────────────
//  ORGANIZATION CONTEXT HELPERS
//  Extract orgId and userId from incoming requests.
// ─────────────────────────────────────────────

/**
 * Extract organization ID from a request.
 * Checks (in order):
 *   1. Query parameter `orgId`
 *   2. Header `X-Organization-Id`
 */
export function getOrgIdFromRequest(request: NextRequest): string | null {
  const { searchParams } = new URL(request.url);
  const fromQuery = searchParams.get("orgId");
  if (fromQuery) return fromQuery;

  const fromHeader = request.headers.get("x-organization-id");
  if (fromHeader) return fromHeader;

  return null;
}

/**
 * Get the authenticated user from the session.
 * Returns the user object or null.
 */
export async function getAuthUser(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session.user;
}

export interface OrgContext {
  orgId: string;
  userId: string;
}

/**
 * Extract org context (orgId + userId) from the request.
 * Throws a 401 if not authenticated, or 400 if orgId is missing.
 */
export async function getOrgContext(request: NextRequest): Promise<OrgContext> {
  const user = await getAuthUser(request);
  if (!user) {
    throw new OrgContextError("UNAUTHORIZED", "Authentication required", 401);
  }

  const orgId = getOrgIdFromRequest(request);
  if (!orgId) {
    throw new OrgContextError("BAD_REQUEST", "Organization ID is required (query param or X-Organization-Id header)", 400);
  }

  return { orgId, userId: user.id };
}

/**
 * Ensures the authenticated user has an active membership in the
 * organization specified in the request.
 * Returns the org context or throws.
 */
export async function requireOrgMembership(request: NextRequest): Promise<OrgContext> {
  const ctx = await getOrgContext(request);

  const hasAccess = await canAccessOrganization(ctx.orgId, ctx.userId);
  if (!hasAccess) {
    throw new OrgContextError(
      "FORBIDDEN",
      "You don't have an active membership in this organization",
      403,
    );
  }

  return ctx;
}

/**
 * Custom error class for organization context errors.
 * API routes can catch this and format the response.
 */
export class OrgContextError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = "OrgContextError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Helper to format an OrgContextError or AuthorizationError into a
 * standard JSON error response.
 */
export function formatErrorResponse(error: unknown): NextResponse {
  if (error instanceof OrgContextError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode },
    );
  }

  // Handle AuthorizationError from authorization.ts
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    "statusCode" in error &&
    "message" in error
  ) {
    const e = error as { code: string; statusCode: number; message: string };
    return NextResponse.json(
      { error: { code: e.code, message: e.message } },
      { status: e.statusCode },
    );
  }

  // Fallback for unexpected errors
  console.error("[org-context] unexpected error:", error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
    { status: 500 },
  );
}
