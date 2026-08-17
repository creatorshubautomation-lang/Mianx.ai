import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  canAccessOrganization,
  requirePermission,
} from "@/lib/authorization";
import { formatErrorResponse } from "@/lib/org-context";

// ─────────────────────────────────────────────
//  SCHEMAS
// ─────────────────────────────────────────────

const VALID_INTEGRATION_STATUSES = [
  "CONNECTED",
  "DEGRADED",
  "REAUTH_REQUIRED",
  "DISABLED",
  "FAILED",
] as const;

const createIntegrationSchema = z.object({
  provider: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  scopes: z.array(z.string().max(200)).max(50).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

function maskCredentialRef(credentialRef: string | null): string | null {
  if (!credentialRef) return null;
  if (credentialRef.length <= 8) return "******";
  return credentialRef.slice(0, 4) + "******" + credentialRef.slice(-4);
}

// ─────────────────────────────────────────────
//  GET /api/organizations/[id]/integrations
// ─────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  try {
    const hasAccess = await canAccessOrganization(id, session.user.id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Not a member of this organization" } },
        { status: 403 },
      );
    }
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");
    const providerFilter = searchParams.get("provider");

    const where: Record<string, unknown> = { organizationId: id };

    if (statusFilter && VALID_INTEGRATION_STATUSES.includes(statusFilter as (typeof VALID_INTEGRATION_STATUSES)[number])) {
      where.status = statusFilter;
    }

    if (providerFilter) {
      where.provider = providerFilter;
    }

    const integrations = await db.integrationConnection.findMany({
      where,
      select: {
        id: true,
        provider: true,
        name: true,
        status: true,
        scopes: true,
        lastSyncAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      data: integrations,
      meta: { total: integrations.length },
    });
  } catch (error) {
    console.error("[organizations/:id/integrations] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch integrations" } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  POST /api/organizations/[id]/integrations
// ─────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  try {
    await requirePermission(id, session.user.id, "core.integration.manage");
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    const body = await request.json();
    const parsed = createIntegrationSchema.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: firstIssue ? firstIssue.message : "Invalid input",
          },
        },
        { status: 400 },
      );
    }

    const { provider, name, scopes, metadata } = parsed.data;

    const integration = await db.integrationConnection.create({
      data: {
        organizationId: id,
        provider,
        name,
        status: "CONNECTED",
        scopes: scopes ? JSON.stringify(scopes) : "[]",
        metadata: metadata ? JSON.stringify(metadata) : "{}",
      },
      select: {
        id: true,
        provider: true,
        name: true,
        status: true,
        scopes: true,
        lastSyncAt: true,
        createdAt: true,
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        organizationId: id,
        actorType: "HUMAN",
        actorId: session.user.id,
        action: "integration.create",
        resourceType: "IntegrationConnection",
        resourceId: integration.id,
        metadata: JSON.stringify({ provider, name, scopes: scopes ?? [] }),
      },
    });

    return NextResponse.json({ data: integration }, { status: 201 });
  } catch (error) {
    console.error("[organizations/:id/integrations] POST error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create integration" } },
      { status: 500 },
    );
  }
}