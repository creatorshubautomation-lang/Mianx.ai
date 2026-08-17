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

function parseJsonField(value: unknown): string {
  if (value === undefined || value === null) return "{}";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

const VALID_AGENT_STATUSES = [
  "DRAFT",
  "CONFIGURED",
  "TESTING",
  "ACTIVE",
  "PAUSED",
  "DEPRECATED",
] as const;

type AgentStatus = (typeof VALID_AGENT_STATUSES)[number];

/**
 * Valid status transitions for an agent.
 * A status can only move forward or be set to PAUSED from ACTIVE.
 */
const VALID_TRANSITIONS: Record<AgentStatus, AgentStatus[]> = {
  DRAFT: ["CONFIGURED", "DEPRECATED"],
  CONFIGURED: ["TESTING", "DRAFT", "DEPRECATED"],
  TESTING: ["ACTIVE", "CONFIGURED", "PAUSED", "DEPRECATED"],
  ACTIVE: ["PAUSED", "DEPRECATED"],
  PAUSED: ["ACTIVE", "DEPRECATED"],
  DEPRECATED: [],
};

function isValidTransition(currentStatus: AgentStatus, newStatus: AgentStatus): boolean {
  return VALID_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}

// ─────────────────────────────────────────────
//  SCHEMAS
// ─────────────────────────────────────────────

const updateAgentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  instructions: z.string().min(1).max(100000).optional(),
  status: z.enum(VALID_AGENT_STATUSES).optional(),
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
    .optional(),
});

// ─────────────────────────────────────────────
//  GET /api/organizations/[id]/agents/[agentId]
// ─────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; agentId: string }> },
) {
  const { id: orgId, agentId } = await params;
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

    const agent = await db.orgAgent.findFirst({
      where: { id: agentId, organizationId: orgId },
    });

    if (!agent) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Agent not found" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: agent });
  } catch (error) {
    console.error("[organizations/:id/agents/:agentId] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch agent" } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  PATCH /api/organizations/[id]/agents/[agentId]
// ─────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; agentId: string }> },
) {
  const { id: orgId, agentId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  try {
    await requirePermission(orgId, session.user.id, "core.agent.manage");
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    // Fetch existing agent
    const existing = await db.orgAgent.findFirst({
      where: { id: agentId, organizationId: orgId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Agent not found" } },
        { status: 404 },
      );
    }

    const body = await request.json();
    const parsed = updateAgentSchema.safeParse(body);

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

    // Validate status transition
    if (data.status && data.status !== existing.status) {
      if (!isValidTransition(existing.status, data.status)) {
        return NextResponse.json(
          {
            error: {
              code: "INVALID_TRANSITION",
              message: `Cannot transition agent from ${existing.status} to ${data.status}. Valid transitions: ${VALID_TRANSITIONS[existing.status].join(", ")}`,
            },
          },
          { status: 400 },
        );
      }
    }

    // Build update data
    const updates: Record<string, unknown> = {};

    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.instructions !== undefined) updates.instructions = data.instructions;
    if (data.status !== undefined) updates.status = data.status;
    if (data.modelPolicy !== undefined) updates.modelPolicy = parseJsonField(data.modelPolicy);
    if (data.tools !== undefined) updates.tools = parseJsonField(data.tools);
    if (data.permissions !== undefined) updates.permissions = parseJsonField(data.permissions);
    if (data.memoryPolicy !== undefined) updates.memoryPolicy = parseJsonField(data.memoryPolicy);
    if (data.knowledgePolicy !== undefined) updates.knowledgePolicy = parseJsonField(data.knowledgePolicy);
    if (data.autonomyLevel !== undefined) updates.autonomyLevel = data.autonomyLevel;

    const updated = await db.orgAgent.update({
      where: { id: agentId },
      data: updates,
    });

    // Audit log
    await db.auditLog.create({
      data: {
        organizationId: orgId,
        actorType: "HUMAN",
        actorId: session.user.id,
        action: "agent.update",
        resourceType: "OrgAgent",
        resourceId: agentId,
        metadata: JSON.stringify({
          changes: Object.keys(updates),
          previousStatus: existing.status,
          newStatus: updated.status,
        }),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("[organizations/:id/agents/:agentId] PATCH error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update agent" } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  DELETE /api/organizations/[id]/agents/[agentId]
//  Archives the agent by setting status to DEPRECATED
// ─────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; agentId: string }> },
) {
  const { id: orgId, agentId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  try {
    await requirePermission(orgId, session.user.id, "core.agent.manage");
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    // Fetch existing agent
    const existing = await db.orgAgent.findFirst({
      where: { id: agentId, organizationId: orgId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Agent not found" } },
        { status: 404 },
      );
    }

    if (existing.status === "DEPRECATED") {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: "Agent is already deprecated" } },
        { status: 409 },
      );
    }

    const archived = await db.orgAgent.update({
      where: { id: agentId },
      data: { status: "DEPRECATED" },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        organizationId: orgId,
        actorType: "HUMAN",
        actorId: session.user.id,
        action: "agent.archive",
        resourceType: "OrgAgent",
        resourceId: agentId,
        metadata: JSON.stringify({
          previousStatus: existing.status,
          newStatus: "DEPRECATED",
          agentName: existing.name,
        }),
      },
    });

    return NextResponse.json({ data: archived });
  } catch (error) {
    console.error("[organizations/:id/agents/:agentId] DELETE error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to archive agent" } },
      { status: 500 },
    );
  }
}
