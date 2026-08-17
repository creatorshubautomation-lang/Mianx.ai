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

const updateJobSchema = z.object({
  action: z.enum(["cancel", "retry"]),
});

// ─────────────────────────────────────────────
//  GET /api/organizations/[id]/jobs/[jobId]
// ─────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; jobId: string }> },
) {
  const { id: orgId, jobId } = await params;
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

    const job = await db.job.findFirst({
      where: { id: jobId, organizationId: orgId },
      include: {
        attemptsLog: {
          orderBy: { attempt: "asc" },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Job not found" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: job });
  } catch (error) {
    console.error("[organizations/:id/jobs/:jobId] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch job" } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  PATCH /api/organizations/[id]/jobs/[jobId]
//  Cancel or retry a job
// ─────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; jobId: string }> },
) {
  const { id: orgId, jobId } = await params;
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
    const existing = await db.job.findFirst({
      where: { id: jobId, organizationId: orgId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Job not found" } },
        { status: 404 },
      );
    }

    const body = await request.json();
    const parsed = updateJobSchema.safeParse(body);

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

    const { action } = parsed.data;

    if (action === "cancel") {
      // Can only cancel PENDING or RUNNING jobs
      if (!["PENDING", "RUNNING"].includes(existing.status)) {
        return NextResponse.json(
          {
            error: {
              code: "INVALID_STATUS",
              message: `Cannot cancel a job in ${existing.status} status`,
            },
          },
          { status: 400 },
        );
      }

      if (existing.status === "CANCELLED") {
        return NextResponse.json(
          { error: { code: "CONFLICT", message: "Job is already cancelled" } },
          { status: 409 },
        );
      }

      const updated = await db.job.update({
        where: { id: jobId },
        data: {
          status: "CANCELLED",
          completedAt: new Date(),
        },
      });

      // Audit log
      await db.auditLog.create({
        data: {
          organizationId: orgId,
          actorType: "HUMAN",
          actorId: session.user.id,
          action: "job.cancel",
          resourceType: "Job",
          resourceId: jobId,
          metadata: JSON.stringify({
            type: existing.type,
            previousStatus: existing.status,
          }),
        },
      });

      return NextResponse.json({ data: updated });
    }

    if (action === "retry") {
      // Can only retry FAILED jobs that haven't exceeded maxAttempts
      if (existing.status !== "FAILED") {
        return NextResponse.json(
          {
            error: {
              code: "INVALID_STATUS",
              message: `Can only retry FAILED jobs. Current status: ${existing.status}`,
            },
          },
          { status: 400 },
        );
      }

      if (existing.attempts >= existing.maxAttempts) {
        return NextResponse.json(
          {
            error: {
              code: "MAX_ATTEMPTS_EXCEEDED",
              message: `Job has reached maximum attempts (${existing.maxAttempts})`,
            },
          },
          { status: 400 },
        );
      }

      const updated = await db.job.update({
        where: { id: jobId },
        data: {
          status: "PENDING",
          startedAt: null,
          completedAt: null,
          error: null,
          attempts: { increment: 1 },
        },
      });

      // Audit log
      await db.auditLog.create({
        data: {
          organizationId: orgId,
          actorType: "HUMAN",
          actorId: session.user.id,
          action: "job.retry",
          resourceType: "Job",
          resourceId: jobId,
          metadata: JSON.stringify({
            type: existing.type,
            newAttempt: existing.attempts + 1,
            maxAttempts: existing.maxAttempts,
          }),
        },
      });

      return NextResponse.json({ data: updated });
    }

    // Unreachable due to zod enum, but satisfy TypeScript
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Invalid action" } },
      { status: 400 },
    );
  } catch (error) {
    console.error("[organizations/:id/jobs/:jobId] PATCH error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update job" } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  DELETE /api/organizations/[id]/jobs/[jobId]
//  Cancel a job (soft delete / status change)
// ─────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; jobId: string }> },
) {
  const { id: orgId, jobId } = await params;
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
    const existing = await db.job.findFirst({
      where: { id: jobId, organizationId: orgId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Job not found" } },
        { status: 404 },
      );
    }

    if (!["PENDING", "RUNNING", "FAILED"].includes(existing.status)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_STATUS",
            message: `Cannot cancel a job in ${existing.status} status`,
          },
        },
        { status: 400 },
      );
    }

    if (existing.status === "CANCELLED") {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: "Job is already cancelled" } },
        { status: 409 },
      );
    }

    const cancelled = await db.job.update({
      where: { id: jobId },
      data: {
        status: "CANCELLED",
        completedAt: new Date(),
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        organizationId: orgId,
        actorType: "HUMAN",
        actorId: session.user.id,
        action: "job.delete",
        resourceType: "Job",
        resourceId: jobId,
        metadata: JSON.stringify({
          type: existing.type,
          previousStatus: existing.status,
        }),
      },
    });

    return NextResponse.json({ data: cancelled });
  } catch (error) {
    console.error("[organizations/:id/jobs/:jobId] DELETE error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to cancel job" } },
      { status: 500 },
    );
  }
}
