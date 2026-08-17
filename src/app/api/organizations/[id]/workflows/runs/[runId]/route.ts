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
import { WorkflowRunStatus } from "@prisma/client";

// ─────────────────────────────────────────────
//  SCHEMAS
// ─────────────────────────────────────────────

const updateRunSchema = z.object({
  status: z.enum(["PAUSED", "CANCELLED"]).optional(),
});

// ─────────────────────────────────────────────
//  GET /api/organizations/[id]/workflows/runs/[runId]
// ─────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> },
) {
  const { id: orgId, runId } = await params;
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

    const run = await db.workflowRun.findFirst({
      where: { id: runId, organizationId: orgId },
      include: {
        steps: {
          orderBy: { createdAt: "asc" },
        },
        approvals: {
          orderBy: { createdAt: "desc" },
        },
        workflow: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        },
      },
    });

    if (!run) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Workflow run not found" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: run });
  } catch (error) {
    console.error("[organizations/:id/workflows/runs/:runId] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch workflow run" } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  PATCH /api/organizations/[id]/workflows/runs/[runId]
//  Pause or cancel a run
// ─────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> },
) {
  const { id: orgId, runId } = await params;
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
    const existing = await db.workflowRun.findFirst({
      where: { id: runId, organizationId: orgId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Workflow run not found" } },
        { status: 404 },
      );
    }

    const body = await request.json();
    const parsed = updateRunSchema.safeParse(body);

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

    const { status: newStatus } = parsed.data;

    // Validate transitions
    const cancellableStatuses = ["QUEUED", "RUNNING", "WAITING", "WAITING_APPROVAL"];
    const pausableStatuses = ["RUNNING", "WAITING"];

    if (newStatus === "CANCELLED" && !cancellableStatuses.includes(existing.status)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_TRANSITION",
            message: `Cannot cancel a run in ${existing.status} status`,
          },
        },
        { status: 400 },
      );
    }

    if (newStatus === "PAUSED" && !pausableStatuses.includes(existing.status)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_TRANSITION",
            message: `Cannot pause a run in ${existing.status} status`,
          },
        },
        { status: 400 },
      );
    }

    const updated = await db.workflowRun.update({
      where: { id: runId },
      data: {
        status: newStatus as WorkflowRunStatus,
        completedAt: newStatus === "CANCELLED" ? new Date() : undefined,
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        organizationId: orgId,
        actorType: "HUMAN",
        actorId: session.user.id,
        action: `workflow.run.${(newStatus ?? "unknown").toLowerCase()}`,
        resourceType: "WorkflowRun",
        resourceId: runId,
        metadata: JSON.stringify({
          previousStatus: existing.status,
          newStatus,
          workflowId: existing.workflowId,
        }),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("[organizations/:id/workflows/runs/:runId] PATCH error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update workflow run" } },
      { status: 500 },
    );
  }
}
