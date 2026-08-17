import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  canAccessOrganization,
  requirePermission,
  generateRoleSlug,
  SYSTEM_ROLE_SLUGS,
} from "@/lib/authorization";
import { formatErrorResponse } from "@/lib/org-context";

// ─────────────────────────────────────────────
//  SCHEMAS
// ─────────────────────────────────────────────

const createRoleSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  slug: z.string().max(100).optional(),
  permissionKeys: z.array(z.string().max(200)).max(200).optional().default([]),
});

// ─────────────────────────────────────────────
//  GET /api/organizations/[id]/roles
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

    const roles = await db.role.findMany({
      where: { organizationId: id },
      include: {
        permissions: {
          include: {
            permission: {
              select: { id: true, key: true, description: true },
            },
          },
        },
        _count: {
          select: { memberships: true },
        },
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });

    return NextResponse.json({
      data: roles,
      meta: { total: roles.length },
    });
  } catch (error) {
    console.error("[organizations/:id/roles] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch roles" } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  POST /api/organizations/[id]/roles — Create custom role
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
    await requirePermission(id, session.user.id, "core.org.manage");
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    const body = await request.json();
    const parsed = createRoleSchema.safeParse(body);

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

    const { name, description, slug: providedSlug, permissionKeys } = parsed.data;
    const slug = providedSlug || generateRoleSlug(name);

    // Prevent using system role slugs
    if ((SYSTEM_ROLE_SLUGS as readonly string[]).includes(slug.toUpperCase())) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: `Cannot use reserved system role slug: ${slug}`,
          },
        },
        { status: 400 },
      );
    }

    // Check slug uniqueness
    const existingRole = await db.role.findFirst({
      where: { organizationId: id, slug },
    });
    if (existingRole) {
      return NextResponse.json(
        {
          error: {
            code: "CONFLICT",
            message: `Role with slug "${slug}" already exists in this organization`,
          },
        },
        { status: 409 },
      );
    }

    // Validate permission keys
    const validPermissions = await db.permission.findMany({
      where: { key: { in: permissionKeys } },
      select: { id: true, key: true },
    });

    const validKeys = new Set(validPermissions.map((p) => p.key));
    const invalidKeys = permissionKeys.filter((k) => !validKeys.has(k));
    if (invalidKeys.length > 0) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: `Unknown permission keys: ${invalidKeys.join(", ")}`,
          },
        },
        { status: 400 },
      );
    }

    // Create the role with permissions
    const role = await db.role.create({
      data: {
        organizationId: id,
        name,
        slug,
        description: description ?? null,
        isSystem: false,
        permissions: validPermissions.length > 0
          ? {
              create: validPermissions.map((p) => ({
                permissionId: p.id,
              })),
            }
          : undefined,
      },
      include: {
        permissions: {
          include: {
            permission: { select: { id: true, key: true, description: true } },
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
        action: "role.create",
        resourceType: "Role",
        resourceId: role.id,
        metadata: JSON.stringify({
          name,
          slug,
          permissionCount: validPermissions.length,
        }),
      },
    });

    return NextResponse.json({ data: role }, { status: 201 });
  } catch (error) {
    console.error("[organizations/:id/roles] POST error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create role" } },
      { status: 500 },
    );
  }
}
