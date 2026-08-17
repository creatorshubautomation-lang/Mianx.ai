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

const createLocationSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().max(200).optional(),
  brandId: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(200).optional(),
  country: z.string().max(100).optional(),
  timezone: z.string().max(50).optional(),
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
//  GET /api/organizations/[id]/locations
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
    const brandIdFilter = searchParams.get("brandId");
    const isActiveFilter = searchParams.get("isActive");

    const where: Record<string, unknown> = { organizationId: id };

    if (brandIdFilter) {
      where.brandId = brandIdFilter;
    }

    if (isActiveFilter !== null) {
      where.isActive = isActiveFilter === "true";
    }

    const locations = await db.location.findMany({
      where,
      select: {
        id: true,
        organizationId: true,
        brandId: true,
        name: true,
        slug: true,
        address: true,
        city: true,
        country: true,
        timezone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        brand: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      data: locations,
      meta: { total: locations.length },
    });
  } catch (error) {
    console.error("[organizations/:id/locations] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch locations" } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  POST /api/organizations/[id]/locations
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
    const parsed = createLocationSchema.safeParse(body);

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

    const { name, slug: providedSlug, brandId, address, city, country, timezone } = parsed.data;

    // Validate brandId belongs to this org
    if (brandId) {
      const brand = await db.brand.findFirst({
        where: { id: brandId, organizationId: id },
        select: { id: true },
      });
      if (!brand) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Brand not found in this organization" } },
          { status: 404 },
        );
      }
    }

    const slug = providedSlug || generateSlug(name);

    const location = await db.location.create({
      data: {
        organizationId: id,
        brandId: brandId ?? null,
        name,
        slug,
        address: address ?? null,
        city: city ?? null,
        country: country ?? null,
        timezone: timezone ?? null,
      },
      select: {
        id: true,
        organizationId: true,
        brandId: true,
        name: true,
        slug: true,
        address: true,
        city: true,
        country: true,
        timezone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        brand: {
          select: {
            id: true,
            name: true,
            slug: true,
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
        action: "location.create",
        resourceType: "Location",
        resourceId: location.id,
        metadata: JSON.stringify({ name, slug, brandId, city, country }),
      },
    });

    return NextResponse.json({ data: location }, { status: 201 });
  } catch (error) {
    console.error("[organizations/:id/locations] POST error:", error);

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
            message: "Location slug already exists in this organization",
          },
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create location" } },
      { status: 500 },
    );
  }
}
