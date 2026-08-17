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

const activateModuleSchema = z.object({
  moduleId: z.string().min(1),
  configuration: z.string().max(50000).optional(),
});

// ─────────────────────────────────────────────
//  GET /api/organizations/[id]/modules
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

    const orgModules = await db.organizationModule.findMany({
      where,
      include: {
        module: {
          select: {
            id: true,
            name: true,
            slug: true,
            version: true,
            description: true,
            icon: true,
            status: true,
            domainId: true,
          },
        },
      },
      orderBy: { activatedAt: "desc" },
    });

    return NextResponse.json({
      data: orgModules,
      meta: { total: orgModules.length },
    });
  } catch (error) {
    console.error("[organizations/:id/modules] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch modules" } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  POST /api/organizations/[id]/modules — Activate module
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
    await requirePermission(id, session.user.id, "core.org.module.manage");
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    const body = await request.json();
    const parsed = activateModuleSchema.safeParse(body);

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

    const { moduleId, configuration } = parsed.data;

    // Verify the module exists in the platform registry
    const moduleRecord = await db.module.findUnique({
      where: { id: moduleId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        domainId: true,
        dependencies: true,
      },
    });

    if (!moduleRecord) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Module not found" } },
        { status: 404 },
      );
    }

    // Check that the domain is activated for this organization
    const domainActive = await db.organizationDomain.findUnique({
      where: {
        organizationId_domainId: {
          organizationId: id,
          domainId: moduleRecord.domainId,
        },
      },
      select: { status: true },
    });

    if (!domainActive || domainActive.status !== "active") {
      return NextResponse.json(
        {
          error: {
            code: "PRECONDITION_FAILED",
            message:
              "Cannot activate a module when its parent domain is not active. Activate the domain first.",
          },
        },
        { status: 412 },
      );
    }

    // Check module dependencies
    let deps: string[] = [];
    try {
      deps = JSON.parse(moduleRecord.dependencies || "[]");
    } catch {
      // ignore parse errors
    }

    if (deps.length > 0) {
      // Get the org's active module slugs
      const activeModules = await db.organizationModule.findMany({
        where: { organizationId: id, status: "active" },
        include: {
          module: { select: { slug: true } },
        },
      });

      const activeSlugs = new Set(activeModules.map((m) => m.module.slug));
      const missingDeps = deps.filter((d) => !activeSlugs.has(d));

      if (missingDeps.length > 0) {
        return NextResponse.json(
          {
            error: {
              code: "PRECONDITION_FAILED",
              message: `Missing required module dependencies: ${missingDeps.join(", ")}`,
            },
          },
          { status: 412 },
        );
      }
    }

    // Check if already activated
    const existing = await db.organizationModule.findUnique({
      where: {
        organizationId_moduleId: { organizationId: id, moduleId },
      },
    });

    if (existing) {
      if (existing.status === "disabled") {
        const reactivated = await db.organizationModule.update({
          where: { id: existing.id },
          data: { status: "active" },
          include: {
            module: {
              select: {
                id: true,
                name: true,
                slug: true,
                version: true,
                description: true,
                domainId: true,
              },
            },
          },
        });

        await db.auditLog.create({
          data: {
            organizationId: id,
            actorType: "HUMAN",
            actorId: session.user.id,
            action: "module.reactivate",
            resourceType: "OrganizationModule",
            resourceId: existing.id,
            metadata: JSON.stringify({ moduleId, moduleSlug: moduleRecord.slug }),
          },
        });

        return NextResponse.json({ data: reactivated });
      }

      return NextResponse.json(
        {
          error: {
            code: "CONFLICT",
            message: "Module is already activated for this organization",
          },
        },
        { status: 409 },
      );
    }

    // Activate the module
    const orgModule = await db.organizationModule.create({
      data: {
        organizationId: id,
        moduleId,
        status: "active",
        configuration: configuration ?? "{}",
      },
      include: {
        module: {
          select: {
            id: true,
            name: true,
            slug: true,
            version: true,
            description: true,
            domainId: true,
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
        action: "module.activate",
        resourceType: "OrganizationModule",
        resourceId: orgModule.id,
        metadata: JSON.stringify({ moduleId, moduleSlug: moduleRecord.slug }),
      },
    });

    return NextResponse.json({ data: orgModule }, { status: 201 });
  } catch (error) {
    console.error("[organizations/:id/modules] POST error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to activate module" } },
      { status: 500 },
    );
  }
}
