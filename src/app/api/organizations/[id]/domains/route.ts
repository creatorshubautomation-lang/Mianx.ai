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

const activateDomainSchema = z.object({
  domainId: z.string().min(1),
  configuration: z.string().max(50000).optional(),
});

// ─────────────────────────────────────────────
//  GET /api/organizations/[id]/domains
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

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");

    const where: Record<string, unknown> = { organizationId: id };
    if (statusFilter) {
      where.status = statusFilter;
    }

    const orgDomains = await db.organizationDomain.findMany({
      where,
      include: {
        domain: {
          select: {
            id: true,
            name: true,
            slug: true,
            version: true,
            description: true,
            icon: true,
            category: true,
            status: true,
          },
        },
      },
      orderBy: { activatedAt: "desc" },
    });

    return NextResponse.json({
      data: orgDomains,
      meta: { total: orgDomains.length },
    });
  } catch (error) {
    console.error("[organizations/:id/domains] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch domains" } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  POST /api/organizations/[id]/domains — Activate domain
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
    await requirePermission(id, session.user.id, "core.org.domain.manage");
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    const body = await request.json();
    const parsed = activateDomainSchema.safeParse(body);

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

    const { domainId, configuration } = parsed.data;

    // Verify the domain exists in the platform registry
    const domain = await db.domain.findUnique({
      where: { id: domainId },
      select: { id: true, name: true, slug: true, status: true },
    });

    if (!domain) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Domain not found" } },
        { status: 404 },
      );
    }

    // Check if already activated
    const existing = await db.organizationDomain.findUnique({
      where: {
        organizationId_domainId: { organizationId: id, domainId },
      },
    });

    if (existing) {
      // If disabled, reactivate
      if (existing.status === "disabled") {
        const reactivated = await db.organizationDomain.update({
          where: { id: existing.id },
          data: { status: "active" },
          include: {
            domain: {
              select: {
                id: true,
                name: true,
                slug: true,
                version: true,
                description: true,
              },
            },
          },
        });

        await db.auditLog.create({
          data: {
            organizationId: id,
            actorType: "HUMAN",
            actorId: session.user.id,
            action: "domain.reactivate",
            resourceType: "OrganizationDomain",
            resourceId: existing.id,
            metadata: JSON.stringify({ domainId, domainSlug: domain.slug }),
          },
        });

        return NextResponse.json({ data: reactivated });
      }

      return NextResponse.json(
        {
          error: {
            code: "CONFLICT",
            message: "Domain is already activated for this organization",
          },
        },
        { status: 409 },
      );
    }

    // Activate the domain
    const orgDomain = await db.organizationDomain.create({
      data: {
        organizationId: id,
        domainId,
        status: "active",
        configuration: configuration ?? "{}",
      },
      include: {
        domain: {
          select: {
            id: true,
            name: true,
            slug: true,
            version: true,
            description: true,
          },
        },
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        organizationId: id,
        actorType: "HUMAN",
        actorId: session.user.id,
        action: "domain.activate",
        resourceType: "OrganizationDomain",
        resourceId: orgDomain.id,
        metadata: JSON.stringify({ domainId, domainSlug: domain.slug }),
      },
    });

    return NextResponse.json({ data: orgDomain }, { status: 201 });
  } catch (error) {
    console.error("[organizations/:id/domains] POST error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to activate domain" } },
      { status: 500 },
    );
  }
}
