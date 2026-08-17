import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  canAccessOrganization,
  requirePermission,
  isOrgOwner,
  AuthorizationError,
} from "@/lib/authorization";
import { formatErrorResponse } from "@/lib/org-context";

// ─────────────────────────────────────────────
//  SCHEMAS
// ─────────────────────────────────────────────

const updateOrgSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  timezone: z.string().max(50).optional(),
  locale: z.string().max(10).optional(),
  currency: z.string().max(3).optional(),
  website: z.string().url().max(500).optional().nullable(),
  logoUrl: z.string().url().max(1000).optional().nullable(),
  metadata: z.string().max(50000).optional(),
});

// ─────────────────────────────────────────────
//  GET /api/organizations/[id]
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
        { error: { code: "FORBIDDEN", message: "You are not a member of this organization" } },
        { status: 403 },
      );
    }

    const org = await db.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            memberships: { where: { status: "ACTIVE" } },
            domains: { where: { status: "active" } },
            modules: { where: { status: "active" } },
            teams: true,
            brands: true,
            locations: true,
            workflows: true,
            agents: true,
          },
        },
      },
    });

    if (!org) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Organization not found" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: org });
  } catch (error) {
    console.error("[organizations/:id] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch organization" } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  PATCH /api/organizations/[id]
// ─────────────────────────────────────────────

export async function PATCH(
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
    await requirePermission(id, session.user.id, "core.org.manage");
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    const body = await request.json();
    const parsed = updateOrgSchema.safeParse(body);

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

    const updates = parsed.data;

    const updated = await db.organization.update({
      where: { id },
      data: updates,
    });

    // Audit log
    await db.auditLog.create({
      data: {
        organizationId: id,
        actorType: "HUMAN",
        actorId: session.user.id,
        action: "organization.update",
        resourceType: "Organization",
        resourceId: id,
        metadata: JSON.stringify({
          before: {},
          after: updates,
        }),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("[organizations/:id] PATCH error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update organization" } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  DELETE /api/organizations/[id] — Soft archive
// ─────────────────────────────────────────────

export async function DELETE(
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
    const owner = await isOrgOwner(id, session.user.id);
    if (!owner) {
      throw new AuthorizationError("core.org.delete");
    }
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    // Soft-archive: set status to ARCHIVED
    const archived = await db.organization.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });

    // Suspend all memberships
    await db.organizationMembership.updateMany({
      where: { organizationId: id, status: "ACTIVE" },
      data: { status: "SUSPENDED" },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        organizationId: id,
        actorType: "HUMAN",
        actorId: session.user.id,
        action: "organization.archive",
        resourceType: "Organization",
        resourceId: id,
        metadata: JSON.stringify({ previousStatus: "ACTIVE", newStatus: "ARCHIVED" }),
      },
    });

    return NextResponse.json({ data: archived });
  } catch (error) {
    console.error("[organizations/:id] DELETE error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to archive organization" } },
      { status: 500 },
    );
  }
}
