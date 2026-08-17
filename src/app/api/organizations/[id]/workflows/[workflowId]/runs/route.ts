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

const triggerRunSchema = z.object({
  input: z.record(z.string(), z.any()).optional(),
});

const VALID_RUN_STATUSES = [
  "QUEUED",
  "RUNNING",
  "WAITING",
  "WAITING_APPROVAL",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "TIMED_OUT",
  "DEAD_LETTERED",
] as const;

// ─────────────────────────────────────────────
//  GET /api/organizations/[id]/workflows/[workflowId]/runs
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

    // Verify workflow exists in this org
    const workflow = await db.workflow.findFirst({
      where: { id: workflowId, organizationId: orgId },
      select: { id: true },
    });

    if (!workflow) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Workflow not found" } },
        { status: 404 },
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "20")));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { workflowId };
    if (status && VALID_RUN_STATUSES.includes(status as (typeof VALID_RUN_STATUSES)[number])) {
      where.status = status;
    }

    const [runs, total] = await Promise.all([
      db.workflowRun.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.workflowRun.count({ where }),
    ]);

    return NextResponse.json({
      data: runs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[organizations/:id/workflows/:workflowId/runs] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch workflow runs" } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  POST /api/organizations/[id]/workflows/[workflowId]/runs
//  Trigger a workflow run
// ─────────────────────────────────────────────

export async function POST(
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
    // Verify workflow exists and is ACTIVE
    const workflow = await db.workflow.findFirst({
      where: { id: workflowId, organizationId: orgId },
    });

    if (!workflow) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Workflow not found" } },
        { status: 404 },
      );
    }

    if (workflow.status !== "ACTIVE") {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_STATUS",
            message: `Workflow must be ACTIVE to trigger a run. Current status: ${workflow.status}`,
          },
        },
        { status: 400 },
      );
    }

    const body = await request.json();
    const parsed = triggerRunSchema.safeParse(body);

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

    const { input } = parsed.data;
    const correlationId = `wf-${workflowId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Create the workflow run
    const run = await db.workflowRun.create({
      data: {
        workflowId,
        organizationId: orgId,
        status: "QUEUED",
        input: JSON.stringify(input ?? {}),
        output: "{}",
      },
    });

    // Create an Event record for the workflow trigger
    await db.event.create({
      data: {
        organizationId: orgId,
        eventType: "workflow.run.triggered.v1",
        sourceType: "USER_ACTION",
        sourceId: workflowId,
        actorType: "human",
        actorId: session.user.id,
        domainId: workflow.domainId,
        correlationId,
        payload: JSON.stringify({
          workflowId,
          workflowRunId: run.id,
          workflowName: workflow.name,
          input: input ?? {},
        }),
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        organizationId: orgId,
        actorType: "HUMAN",
        actorId: session.user.id,
        action: "workflow.run.trigger",
        resourceType: "WorkflowRun",
        resourceId: run.id,
        metadata: JSON.stringify({ workflowId, workflowName: workflow.name, correlationId }),
      },
    });

    return NextResponse.json(
      {
        data: {
          runId: run.id,
          status: run.status,
          correlationId,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[organizations/:id/workflows/:workflowId/runs] POST error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to trigger workflow run" } },
      { status: 500 },
    );
  }
}
