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

const createBrandSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().max(200).optional(),
  logoUrl: z.string().url().max(1000).optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color (e.g. #ff5500)")
    .optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color (e.g. #ff5500)")
    .optional(),
});

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\-\s]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") +
    "-" +
    Math.random().toString(36).slice(2, 8)
  );
}

// ─────────────────────────────────────────────
//  GET /api/organizations/[id]/brands
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
    const isActiveFilter = searchParams.get("isActive");

    const where: Record<string, unknown> = { organizationId: id };

    if (isActiveFilter !== null) {
      where.isActive = isActiveFilter === "true";
    }

    const brands = await db.brand.findMany({
      where,
      select: {
        id: true,
        organizationId: true,
        name: true,
        slug: true,
        logoUrl: true,
        primaryColor: true,
        accentColor: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { locations: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      data: brands,
      meta: { total: brands.length },
    });
  } catch (error) {
    console.error("[organizations/:id/brands] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch brands" } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  POST /api/organizations/[id]/brands
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
    const parsed = createBrandSchema.safeParse(body);

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

    const { name, slug: providedSlug, logoUrl, primaryColor, accentColor } = parsed.data;
    const slug = providedSlug || generateSlug(name);

    const brand = await db.brand.create({
      data: {
        organizationId: id,
        name,
        slug,
        logoUrl: logoUrl ?? null,
        primaryColor: primaryColor ?? null,
        accentColor: accentColor ?? null,
      },
      select: {
        id: true,
        organizationId: true,
        name: true,
        slug: true,
        logoUrl: true,
        primaryColor: true,
        accentColor: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { locations: true },
        },
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        organizationId: id,
        actorType: "HUMAN",
        actorId: session.user.id,
        action: "brand.create",
        resourceType: "Brand",
        resourceId: brand.id,
        metadata: JSON.stringify({ name, slug }),
      },
    });

    return NextResponse.json({ data: brand }, { status: 201 });
  } catch (error) {
    console.error("[organizations/:id/brands] POST error:", error);

    // Handle unique slug collision
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
            message: "Brand slug already exists in this organization",
          },
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create brand" } },
      { status: 500 },
    );
  }
}
