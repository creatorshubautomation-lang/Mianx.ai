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

const VALID_ENTITLEMENT_STATUSES = [
  "ENABLED",
  "DISABLED",
  "LIMITED",
  "TRIAL",
  "EXPIRED",
  "SUSPENDED",
] as const;

const grantEntitlementSchema = z.object({
  featureKey: z.string().min(1).max(255),
  status: z.enum(VALID_ENTITLEMENT_STATUSES).optional().default("ENABLED"),
  limit: z.number().int().positive().nullable().optional(),
  validFrom: z.string().datetime().nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
});

// ─────────────────────────────────────────────
//  GET /api/organizations/[id]/billing/entitlements
//  List all entitlements for the organization
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
        { error: { code: "FORBIDDEN", message: "You don't have an active membership in this organization" } },
        { status: 403 },
      );
    }
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");

    const where: Record<string, unknown> = { organizationId: id };

    if (statusFilter && VALID_ENTITLEMENT_STATUSES.includes(statusFilter as (typeof VALID_ENTITLEMENT_STATUSES)[number])) {
      where.status = statusFilter;
    }

    const entitlements = await db.entitlement.findMany({
      where,
      orderBy: [{ status: "asc" }, { featureKey: "asc" }],
      select: {
        id: true,
        organizationId: true,
        featureKey: true,
        status: true,
        limit: true,
        used: true,
        validFrom: true,
        validUntil: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Parse metadata for each entitlement
    const data = entitlements.map((e) => ({
      id: e.id,
      organizationId: e.organizationId,
      featureKey: e.featureKey,
      status: e.status,
      limit: e.limit,
      used: e.used,
      validFrom: e.validFrom,
      validUntil: e.validUntil,
      metadata: e.metadata ? JSON.parse(e.metadata) : {},
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }));

    return NextResponse.json({
      data,
      meta: {
        total: data.length,
      },
    });
  } catch (error) {
    console.error("[billing/entitlements] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch entitlements" } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  POST /api/organizations/[id]/billing/entitlements
//  Grant or update an entitlement (requires core.billing.manage)
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
    await requirePermission(id, session.user.id, "core.org.billing.manage");
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    const body = await request.json();
    const parsed = grantEntitlementSchema.safeParse(body);

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

    const { featureKey, status, limit, validFrom, validUntil } = parsed.data;

    // Check if entitlement already exists
    const existing = await db.entitlement.findUnique({
      where: {
        organizationId_featureKey: {
          organizationId: id,
          featureKey,
        },
      },
    });

    const isUpdate = !!existing;

    // Upsert: update if exists, create if not
    const entitlement = await db.entitlement.upsert({
      where: {
        organizationId_featureKey: {
          organizationId: id,
          featureKey,
        },
      },
      update: {
        status,
        limit: limit !== undefined ? limit : existing!.limit,
        validFrom: validFrom !== undefined && validFrom !== null ? new Date(validFrom) : (existing?.validFrom ?? null),
        validUntil: validUntil !== undefined && validUntil !== null ? new Date(validUntil) : (existing?.validUntil ?? null),
        metadata: JSON.stringify({
          ...((existing!.metadata ? JSON.parse(existing!.metadata) : {}) as Record<string, unknown>),
          lastModifiedBy: session.user.id,
          modifiedAt: new Date().toISOString(),
        }),
      },
      create: {
        organizationId: id,
        featureKey,
        status,
        limit: limit ?? null,
        used: 0,
        validFrom: validFrom ? new Date(validFrom) : null,
        validUntil: validUntil ? new Date(validUntil) : null,
        metadata: JSON.stringify({
          grantedBy: session.user.id,
          grantedAt: new Date().toISOString(),
        }),
      },
    });

    // Create AuditLog
    await db.auditLog.create({
      data: {
        organizationId: id,
        actorType: "HUMAN",
        actorId: session.user.id,
        action: isUpdate ? "billing.entitlement.update" : "billing.entitlement.create",
        resourceType: "Entitlement",
        resourceId: entitlement.id,
        metadata: JSON.stringify({
          featureKey,
          status,
          limit: limit ?? existing?.limit ?? null,
          validFrom: validFrom ?? existing?.validFrom?.toISOString() ?? null,
          validUntil: validUntil ?? existing?.validUntil?.toISOString() ?? null,
          wasUpdate: isUpdate,
        }),
      },
    });

    return NextResponse.json(
      {
        data: {
          id: entitlement.id,
          organizationId: entitlement.organizationId,
          featureKey: entitlement.featureKey,
          status: entitlement.status,
          limit: entitlement.limit,
          used: entitlement.used,
          validFrom: entitlement.validFrom,
          validUntil: entitlement.validUntil,
          createdAt: entitlement.createdAt,
          updatedAt: entitlement.updatedAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[billing/entitlements] POST error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to grant or update entitlement" } },
      { status: 500 },
    );
  }
}
