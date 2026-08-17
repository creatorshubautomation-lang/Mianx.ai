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

const updateMemberSchema = z.object({
  roleSlug: z.string().max(100).optional(),
  status: z
    .enum(["INVITED", "ACTIVE", "SUSPENDED", "REMOVED"])
    .optional(),
});

// ─────────────────────────────────────────────
//  PATCH /api/organizations/[id]/members/[memberId]
// ─────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const { id: orgId, memberId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  try {
    await requirePermission(orgId, session.user.id, "core.org.member.manage");
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    // Fetch the membership
    const membership = await db.organizationMembership.findUnique({
      where: { id: memberId },
      include: {
        roles: {
          include: {
            role: { select: { id: true, slug: true, isSystem: true } },
          },
        },
      },
    });

    if (!membership || membership.organizationId !== orgId) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Membership not found" } },
        { status: 404 },
      );
    }

    const body = await request.json();
    const parsed = updateMemberSchema.safeParse(body);

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

    const { roleSlug, status } = parsed.data;
    const updates: Record<string, unknown> = {};

    // Handle role change
    if (roleSlug) {
      // Prevent non-owners from modifying owners
      const targetIsOwner = membership.roles.some(
        (mr) => mr.role.slug === "OWNER" && mr.role.isSystem,
      );
      if (targetIsOwner) {
        const requesterIsOwner = await isOrgOwner(orgId, session.user.id);
        if (!requesterIsOwner) {
          return NextResponse.json(
            {
              error: {
                code: "FORBIDDEN",
                message: "Only organization owners can modify owner roles",
              },
            },
            { status: 403 },
          );
        }
      }

      const newRole = await db.role.findFirst({
        where: { organizationId: orgId, slug: roleSlug },
      });

      if (!newRole) {
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

      // Replace all roles with the new one
      await db.membershipRole.deleteMany({
        where: { membershipId: memberId },
      });
      await db.membershipRole.create({
        data: { membershipId: memberId, roleId: newRole.id },
      });
    }

    // Handle status change
    if (status) {
      // Only owners can suspend or remove other owners
      const targetIsOwner = membership.roles.some(
        (mr) => mr.role.slug === "OWNER" && mr.role.isSystem,
      );
      if (targetIsOwner && (status === "SUSPENDED" || status === "REMOVED")) {
        const requesterIsOwner = await isOrgOwner(orgId, session.user.id);
        if (!requesterIsOwner) {
          return NextResponse.json(
            {
              error: {
                code: "FORBIDDEN",
                message: "Only owners can suspend or remove other owners",
              },
            },
            { status: 403 },
          );
        }
      }

      updates.status = status;
      if (status === "ACTIVE") {
        updates.joinedAt = membership.joinedAt ?? new Date();
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.organizationMembership.update({
        where: { id: memberId },
        data: updates,
      });
    }

    // Audit log
    await db.auditLog.create({
      data: {
        organizationId: orgId,
        actorType: "HUMAN",
        actorId: session.user.id,
        action: "member.update",
        resourceType: "OrganizationMembership",
        resourceId: memberId,
        metadata: JSON.stringify({
          targetUserId: membership.userId,
          changes: { roleSlug, status },
        }),
      },
    });

    // Return updated membership
    const updated = await db.organizationMembership.findUnique({
      where: { id: memberId },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
        roles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                slug: true,
                isSystem: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("[organizations/:id/members/:memberId] PATCH error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update member" } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  DELETE /api/organizations/[id]/members/[memberId]
// ─────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const { id: orgId, memberId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  try {
    await requirePermission(orgId, session.user.id, "core.org.member.manage");
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    // Fetch the membership
    const membership = await db.organizationMembership.findUnique({
      where: { id: memberId },
      include: {
        roles: {
          include: {
            role: { select: { slug: true, isSystem: true } },
          },
        },
      },
    });

    if (!membership || membership.organizationId !== orgId) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Membership not found" } },
        { status: 404 },
      );
    }

    // Cannot remove yourself if you're the only owner
    const targetIsOwner = membership.roles.some(
      (mr) => mr.role.slug === "OWNER" && mr.role.isSystem,
    );
    if (targetIsOwner) {
      const ownerCount = await db.membershipRole.count({
        where: {
          role: {
            organizationId: orgId,
            slug: "OWNER",
            isSystem: true,
          },
          membership: {
            status: "ACTIVE",
          },
        },
      });

      if (ownerCount <= 1) {
        return NextResponse.json(
          {
            error: {
              code: "FORBIDDEN",
              message: "Cannot remove the last owner of the organization",
            },
          },
          { status: 403 },
        );
      }
    }

    // Soft remove by setting status to REMOVED
    await db.organizationMembership.update({
      where: { id: memberId },
      data: { status: "REMOVED" },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        organizationId: orgId,
        actorType: "HUMAN",
        actorId: session.user.id,
        action: "member.remove",
        resourceType: "OrganizationMembership",
        resourceId: memberId,
        metadata: JSON.stringify({
          targetUserId: membership.userId,
        }),
      },
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error("[organizations/:id/members/:memberId] DELETE error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to remove member" } },
      { status: 500 },
    );
  }
}
