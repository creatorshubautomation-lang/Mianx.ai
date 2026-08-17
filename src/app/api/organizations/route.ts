import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { getAccessibleOrganizations, ensureSystemRoles, ensureCorePermissions, generateOrgSlug } from "@/lib/authorization";

// ─────────────────────────────────────────────
//  SCHEMAS
// ─────────────────────────────────────────────

const createOrgSchema = z.object({
  name: z.string().min(1).max(120),
  timezone: z.string().max(50).optional().default("UTC"),
  locale: z.string().max(10).optional().default("en"),
  currency: z.string().max(3).optional().default("USD"),
  website: z.string().url().max(500).optional(),
  logoUrl: z.string().url().max(1000).optional(),
});

// ─────────────────────────────────────────────
//  GET /api/organizations — List user's orgs
// ─────────────────────────────────────────────

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  try {
    const orgs = await getAccessibleOrganizations(session.user.id);

    return NextResponse.json({
      data: orgs,
      meta: { total: orgs.length },
    });
  } catch (error) {
    console.error("[organizations] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch organizations" } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  POST /api/organizations — Create org
// ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const parsed = createOrgSchema.safeParse(body);

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

    const { name, timezone, locale, currency, website, logoUrl } = parsed.data;
    const slug = generateOrgSlug(name);

    // Ensure core permissions exist
    await ensureCorePermissions();

    // Create the organization
    const org = await db.organization.create({
      data: {
        name,
        slug,
        timezone,
        locale,
        currency,
        website: website ?? null,
        logoUrl: logoUrl ?? null,
      },
    });

    // Ensure system roles are created
    await ensureSystemRoles(org.id);

    // Find the OWNER role
    const ownerRole = await db.role.findFirst({
      where: {
        organizationId: org.id,
        slug: "OWNER",
        isSystem: true,
      },
    });

    if (!ownerRole) {
      // Should never happen after ensureSystemRoles, but defensive
      await db.organization.delete({ where: { id: org.id } });
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Failed to set up organization roles" } },
        { status: 500 },
      );
    }

    // Create membership with OWNER role
    const membership = await db.organizationMembership.create({
      data: {
        organizationId: org.id,
        userId: session.user.id,
        status: "ACTIVE",
        joinedAt: new Date(),
        invitedBy: session.user.id,
        roles: {
          create: {
            roleId: ownerRole.id,
          },
        },
      },
      include: {
        roles: {
          include: {
            role: { select: { id: true, name: true, slug: true, isSystem: true } },
          },
        },
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        organizationId: org.id,
        actorType: "HUMAN",
        actorId: session.user.id,
        action: "organization.create",
        resourceType: "Organization",
        resourceId: org.id,
        metadata: JSON.stringify({ name, slug }),
      },
    });

    return NextResponse.json(
      {
        data: {
          membershipId: membership.id,
          joinedAt: membership.joinedAt,
          organization: org,
          roles: membership.roles.map((mr) => mr.role),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[organizations] POST error:", error);

    // Handle unique slug collision (extremely rare with random suffix)
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        {
          error: {
            code: "CONFLICT",
            message: "Organization slug collision. Please try again.",
          },
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create organization" } },
      { status: 500 },
    );
  }
}
