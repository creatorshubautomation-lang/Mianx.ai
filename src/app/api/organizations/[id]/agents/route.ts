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

function generateAgentSlug(name: string): string {
  const suffix = "-" + Math.random().toString(36).slice(2, 8);
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\-\s]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") + suffix
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

const createAgentSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().max(250).optional(),
  description: z.string().max(5000).optional(),
  instructions: z.string().min(1).max(100000),
  domainId: z.string().max(100).optional(),
  modelPolicy: z.any().optional(),
  tools: z.array(z.any()).optional(),
  permissions: z.array(z.any()).optional(),
  memoryPolicy: z.any().optional(),
  knowledgePolicy: z.any().optional(),
  autonomyLevel: z
    .enum([
      "L0_OBSERVE",
      "L1_RECOMMEND",
      "L2_DRAFT",
      "L3_EXECUTE_LOW_RISK",
      "L4_EXECUTE_APPROVED",
      "L5_AUTONOMOUS_WITHIN_POLICY",
    ])
    .optional()
    .default("L2_DRAFT"),
});

const validAgentStatuses = ["DRAFT", "CONFIGURED", "TESTING", "ACTIVE", "PAUSED", "DEPRECATED"] as const;

// ─────────────────────────────────────────────
//  GET /api/organizations/[id]/agents — List agents
// ─────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orgId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  try {
    const hasAccess = await canAccessOrganization(orgId, session.user.id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Not a member of this organization" } },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");
    const domainFilter = searchParams.get("domainId");
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));

    const where: Record<string, unknown> = { organizationId: orgId };

    if (statusFilter && validAgentStatuses.includes(statusFilter as typeof validAgentStatuses[number])) {
      where.status = statusFilter;
    }

    if (domainFilter) {
      where.domainId = domainFilter;
    }

    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    const [agents, total] = await Promise.all([
      db.orgAgent.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          status: true,
          autonomyLevel: true,
          domainId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.orgAgent.count({ where }),
    ]);

    return NextResponse.json({
      data: agents,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[organizations/:id/agents] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch agents" } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  POST /api/organizations/[id]/agents — Create agent
// ─────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orgId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  try {
    await requirePermission(orgId, session.user.id, "core.agent.create");
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    const body = await request.json();
    const parsed = createAgentSchema.safeParse(body);

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

    const data = parsed.data;
    const slug = data.slug || generateAgentSlug(data.name);

    // Validate domainId if provided
    if (data.domainId) {
      const domainExists = await db.organizationDomain.findFirst({
        where: { id: data.domainId, organizationId: orgId },
      });
      if (!domainExists) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Domain not found in this organization" } },
          { status: 404 },
        );
      }
    }

    const agent = await db.orgAgent.create({
      data: {
        organizationId: orgId,
        name: data.name,
        slug,
        description: data.description ?? null,
        instructions: data.instructions,
        domainId: data.domainId ?? null,
        modelPolicy: parseJsonField(data.modelPolicy),
        tools: parseJsonField(data.tools),
        permissions: parseJsonField(data.permissions),
        memoryPolicy: parseJsonField(data.memoryPolicy),
        knowledgePolicy: parseJsonField(data.knowledgePolicy),
        autonomyLevel: data.autonomyLevel,
        status: "DRAFT",
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        organizationId: orgId,
        actorType: "HUMAN",
        actorId: session.user.id,
        action: "agent.create",
        resourceType: "OrgAgent",
        resourceId: agent.id,
        metadata: JSON.stringify({
          name: data.name,
          slug,
          autonomyLevel: data.autonomyLevel,
        }),
      },
    });

    return NextResponse.json({ data: agent }, { status: 201 });
  } catch (error) {
    console.error("[organizations/:id/agents] POST error:", error);

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
            message: "Agent slug collision. Please try again.",
          },
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create agent" } },
      { status: 500 },
    );
  }
}
