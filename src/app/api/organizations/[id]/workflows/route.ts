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
//  HELPERS
// ─────────────────────────────────────────────

function generateWorkflowSlug(name: string): string {
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

function parseJsonField(value: unknown): string {
  if (value === undefined || value === null) return "{}";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

// ─────────────────────────────────────────────
//  SCHEMAS
// ─────────────────────────────────────────────

const createWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().max(250).optional(),
  description: z.string().max(5000).nullable().optional(),
  domainId: z.string().min(1).optional(),
  trigger: z.any().optional(),
  definition: z.any().optional(),
  errorPolicy: z.any().optional(),
});

const VALID_WORKFLOW_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "ARCHIVED",
] as const;

// ─────────────────────────────────────────────
//  GET /api/organizations/[id]/workflows
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
    const status = searchParams.get("status");
    const domainId = searchParams.get("domainId");
    const search = searchParams.get("search");
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "20")));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { organizationId: id };
    if (status && VALID_WORKFLOW_STATUSES.includes(status as (typeof VALID_WORKFLOW_STATUSES)[number])) {
      where.status = status;
    }
    if (domainId) {
      where.domainId = domainId;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [workflows, total] = await Promise.all([
      db.workflow.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.workflow.count({ where }),
    ]);

    return NextResponse.json({
      data: workflows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[organizations/:id/workflows] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch workflows" } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  POST /api/organizations/[id]/workflows
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
    await requirePermission(id, session.user.id, "core.workflow.manage");
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    const body = await request.json();
    const parsed = createWorkflowSchema.safeParse(body);

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

    const { name, slug: providedSlug, description, domainId, trigger, definition, errorPolicy } =
      parsed.data;

    // Validate domainId if provided
    if (domainId) {
      const domainExists = await db.organizationDomain.findFirst({
        where: { id: domainId, organizationId: id },
        select: { id: true },
      });
      if (!domainExists) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Domain not found in this organization" } },
          { status: 404 },
        );
      }
    }

    const slug = providedSlug || generateWorkflowSlug(name);

    const workflow = await db.workflow.create({
      data: {
        organizationId: id,
        name,
        slug,
        description: description ?? null,
        domainId: domainId ?? null,
        status: "DRAFT",
        trigger: parseJsonField(trigger),
        definition: parseJsonField(definition),
        errorPolicy: parseJsonField(errorPolicy),
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        organizationId: id,
        actorType: "HUMAN",
        actorId: session.user.id,
        action: "workflow.create",
        resourceType: "Workflow",
        resourceId: workflow.id,
        metadata: JSON.stringify({ name, slug, domainId }),
      },
    });

    return NextResponse.json({ data: workflow }, { status: 201 });
  } catch (error) {
    console.error("[organizations/:id/workflows] POST error:", error);

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
            message: "Workflow slug already exists in this organization",
          },
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create workflow" } },
      { status: 500 },
    );
  }
}
