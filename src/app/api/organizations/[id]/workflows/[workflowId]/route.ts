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

type WorkflowStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";

const VALID_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["PAUSED", "ARCHIVED"],
  PAUSED: ["ACTIVE", "ARCHIVED"],
  ARCHIVED: ["DRAFT"],
};

function isValidTransition(currentStatus: WorkflowStatus, newStatus: WorkflowStatus): boolean {
  return VALID_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}

function parseJsonField(value: unknown): string {
  if (value === undefined || value === null) return "{}";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

// ─────────────────────────────────────────────
//  SCHEMAS
// ─────────────────────────────────────────────

const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  domainId: z.string().min(1).nullable().optional(),
  trigger: z.any().optional(),
  definition: z.any().optional(),
  errorPolicy: z.any().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]).optional(),
});

// ─────────────────────────────────────────────
//  GET /api/organizations/[id]/workflows/[workflowId]
// ─────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; workflowId: string }> },
) {
  const { id: orgId, workflowId } = await params;
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

    const workflow = await db.workflow.findFirst({
      where: { id: workflowId, organizationId: orgId },
    });

    if (!workflow) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Workflow not found" } },
        { status: 404 },
      );
    }

    // Compute run stats
    const stats = await db.workflowRun.groupBy({
      by: ["status"],
      where: { workflowId },
      _count: { status: true },
    });

    const totalCount = stats.reduce((sum, s) => sum + s._count.status, 0);
    const successCount = stats.find((s) => s.status === "COMPLETED")?._count.status ?? 0;
    const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 10000) / 100 : 0;

    return NextResponse.json({
      data: {
        ...workflow,
        stats: {
          totalRuns: totalCount,
          successRate,
          breakdown: Object.fromEntries(stats.map((s) => [s.status, s._count.status])),
        },
      },
    });
  } catch (error) {
    console.error("[organizations/:id/workflows/:workflowId] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch workflow" } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  PATCH /api/organizations/[id]/workflows/[workflowId]
// ─────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; workflowId: string }> },
) {
  const { id: orgId, workflowId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  try {
    await requirePermission(orgId, session.user.id, "core.workflow.manage");
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    const existing = await db.workflow.findFirst({
      where: { id: workflowId, organizationId: orgId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Workflow not found" } },
        { status: 404 },
      );
    }

    const body = await request.json();
    const parsed = updateWorkflowSchema.safeParse(body);

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
              message: `Cannot transition workflow from ${existing.status} to ${data.status}. Valid transitions: ${VALID_TRANSITIONS[existing.status].join(", ")}`,
            },
          },
          { status: 400 },
        );
      }
    }

    // Build update payload
    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.domainId !== undefined) updates.domainId = data.domainId;
    if (data.trigger !== undefined) updates.trigger = parseJsonField(data.trigger);
    if (data.definition !== undefined) updates.definition = parseJsonField(data.definition);
    if (data.errorPolicy !== undefined) updates.errorPolicy = parseJsonField(data.errorPolicy);
    if (data.status !== undefined) updates.status = data.status;

    const updated = await db.workflow.update({
      where: { id: workflowId },
      data: updates,
    });

    // Audit log
    await db.auditLog.create({
      data: {
        organizationId: orgId,
        actorType: "HUMAN",
        actorId: session.user.id,
        action: "workflow.update",
        resourceType: "Workflow",
        resourceId: workflowId,
        metadata: JSON.stringify({
          changes: Object.keys(updates),
          previousStatus: existing.status,
          newStatus: updated.status,
        }),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("[organizations/:id/workflows/:workflowId] PATCH error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update workflow" } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  DELETE /api/organizations/[id]/workflows/[workflowId]
//  Archives the workflow by setting status to ARCHIVED
// ─────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; workflowId: string }> },
) {
  const { id: orgId, workflowId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  try {
    await requirePermission(orgId, session.user.id, "core.workflow.manage");
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    const existing = await db.workflow.findFirst({
      where: { id: workflowId, organizationId: orgId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Workflow not found" } },
        { status: 404 },
      );
    }

    if (existing.status === "ARCHIVED") {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: "Workflow is already archived" } },
        { status: 409 },
      );
    }

    const archived = await db.workflow.update({
      where: { id: workflowId },
      data: { status: "ARCHIVED" },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        organizationId: orgId,
        actorType: "HUMAN",
        actorId: session.user.id,
        action: "workflow.archive",
        resourceType: "Workflow",
        resourceId: workflowId,
        metadata: JSON.stringify({
          previousStatus: existing.status,
          workflowName: existing.name,
        }),
      },
    });

    return NextResponse.json({ data: archived });
  } catch (error) {
    console.error("[organizations/:id/workflows/:workflowId] DELETE error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to archive workflow" } },
      { status: 500 },
    );
  }
}
