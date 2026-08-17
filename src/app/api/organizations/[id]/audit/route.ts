import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  canAccessOrganization,
  requirePermission,
} from "@/lib/authorization";
import { formatErrorResponse } from "@/lib/org-context";

// ─────────────────────────────────────────────
//  GET /api/organizations/[id]/audit
// ─────────────────────────────────────────────

const VALID_ACTOR_TYPES = ["HUMAN", "AI_AGENT", "SYSTEM", "INTEGRATION"] as const;

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
    await requirePermission(id, session.user.id, "core.org.audit.view");
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    const { searchParams } = new URL(request.url);

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));

    // Filters
    const actorType = searchParams.get("actorType");
    const action = searchParams.get("action");
    const resourceType = searchParams.get("resourceType");
    const actorId = searchParams.get("actorId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // Build where clause
    const where: Record<string, unknown> = { organizationId: id };

    if (actorType && VALID_ACTOR_TYPES.includes(actorType as (typeof VALID_ACTOR_TYPES)[number])) {
      where.actorType = actorType;
    }

    if (action) {
      where.action = action;
    }

    if (resourceType) {
      where.resourceType = resourceType;
    }

    if (actorId) {
      where.actorId = actorId;
    }

    // Date range filter
    if (from || to) {
      const createdAt: Record<string, Date> = {};
      if (from) {
        const fromDate = new Date(from);
        if (!isNaN(fromDate.getTime())) {
          createdAt.gte = fromDate;
        }
      }
      if (to) {
        const toDate = new Date(to);
        if (!isNaN(toDate.getTime())) {
          createdAt.lte = toDate;
        }
      }
      if (Object.keys(createdAt).length > 0) {
        where.createdAt = createdAt;
      }
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          actorType: true,
          actorId: true,
          action: true,
          resourceType: true,
          resourceId: true,
          metadata: true,
          ipAddress: true,
          userAgent: true,
          requestId: true,
          correlationId: true,
          createdAt: true,
        },
      }),
      db.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[organizations/:id/audit] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch audit logs" } },
      { status: 500 },
    );
  }
}
