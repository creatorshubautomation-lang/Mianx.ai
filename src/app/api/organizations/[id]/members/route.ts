import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  canAccessOrganization,
  requirePermission,
  AuthorizationError,
} from "@/lib/authorization";
import { formatErrorResponse } from "@/lib/org-context";

// ─────────────────────────────────────────────
//  SCHEMAS
// ─────────────────────────────────────────────

const inviteMemberSchema = z.object({
  email: z.string().email().max(255),
  roleSlug: z.string().max(100).optional().default("VIEWER"),
});

// ─────────────────────────────────────────────
//  GET /api/organizations/[id]/members
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
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const statusFilter = searchParams.get("status");

    const where: Record<string, unknown> = { organizationId: id };
    if (statusFilter && ["INVITED", "ACTIVE", "SUSPENDED", "REMOVED"].includes(statusFilter.toUpperCase())) {
      where.status = statusFilter.toUpperCase();
    } else {
      where.status = { in: ["INVITED", "ACTIVE", "SUSPENDED"] };
    }

    const [members, total] = await Promise.all([
      db.organizationMembership.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              avatarUrl: true,
            },
          },
          roles: {
            include: {
              role: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  isSystem: true,
                  description: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.organizationMembership.count({ where }),
    ]);

    return NextResponse.json({
      data: members,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[organizations/:id/members] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch members" } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  POST /api/organizations/[id]/members — Invite
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
    await requirePermission(id, session.user.id, "core.org.member.manage");
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    const body = await request.json();
    const parsed = inviteMemberSchema.safeParse(body);

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

    const { email, roleSlug } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Find the user by email
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: `No user found with email: ${normalizedEmail}` } },
        { status: 404 },
      );
    }

    // Check if already a member
    const existingMembership = await db.organizationMembership.findUnique({
      where: {
        organizationId_userId: { organizationId: id, userId: user.id },
      },
    });

    if (existingMembership) {
      if (existingMembership.status === "ACTIVE" || existingMembership.status === "INVITED") {
        return NextResponse.json(
          {
            error: {
              code: "CONFLICT",
              message: "User is already a member or has a pending invitation",
            },
          },
          { status: 409 },
        );
      }

      // If previously removed or suspended, reactivate
      const reactivated = await db.organizationMembership.update({
        where: { id: existingMembership.id },
        data: {
          status: "INVITED",
          invitedBy: session.user.id,
          joinedAt: null,
        },
      });

      // Assign the requested role
      const role = await db.role.findFirst({
        where: { organizationId: id, slug: roleSlug },
      });

      if (role) {
        // Remove old roles and assign new one
        await db.membershipRole.deleteMany({
          where: { membershipId: reactivated.id },
        });
        await db.membershipRole.create({
          data: { membershipId: reactivated.id, roleId: role.id },
        });
      }

      // Audit log
      await db.auditLog.create({
        data: {
          organizationId: id,
          actorType: "HUMAN",
          actorId: session.user.id,
          action: "member.reinvite",
          resourceType: "OrganizationMembership",
          resourceId: reactivated.id,
          metadata: JSON.stringify({
            targetUserId: user.id,
            targetEmail: normalizedEmail,
            role: roleSlug,
          }),
        },
      });

      return NextResponse.json({ data: reactivated }, { status: 200 });
    }

    // Find the role to assign
    const role = await db.role.findFirst({
      where: { organizationId: id, slug: roleSlug },
    });

    if (!role) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Role "${roleSlug}" not found in this organization`,
          },
        },
        { status: 404 },
      );
    }

    // Create membership with role
    const membership = await db.organizationMembership.create({
      data: {
        organizationId: id,
        userId: user.id,
        status: "INVITED",
        invitedBy: session.user.id,
        roles: {
          create: {
            roleId: role.id,
          },
        },
      },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
        roles: {
          include: {
            role: {
              select: { id: true, name: true, slug: true, isSystem: true },
            },
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
        action: "member.invite",
        resourceType: "OrganizationMembership",
        resourceId: membership.id,
        metadata: JSON.stringify({
          targetUserId: user.id,
          targetEmail: normalizedEmail,
          role: roleSlug,
        }),
      },
    });

    return NextResponse.json({ data: membership }, { status: 201 });
  } catch (error) {
    console.error("[organizations/:id/members] POST error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to invite member" } },
      { status: 500 },
    );
  }
}
