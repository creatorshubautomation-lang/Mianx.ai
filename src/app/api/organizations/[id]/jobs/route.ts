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

const VALID_JOB_STATUSES = ["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"] as const;
const VALID_JOB_PRIORITIES = ["CRITICAL", "HIGH", "NORMAL", "LOW"] as const;

const createJobSchema = z.object({
  type: z.string().min(1).max(200),
  payload: z.record(z.string(), z.any()).optional(),
  priority: z.enum(VALID_JOB_PRIORITIES).optional().default("NORMAL"),
  scheduledAt: z.string().datetime().optional(),
});

// ─────────────────────────────────────────────
//  GET /api/organizations/[id]/jobs
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
    const type = searchParams.get("type");
    const priority = searchParams.get("priority");
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "20")));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { organizationId: id };
    if (status && VALID_JOB_STATUSES.includes(status as (typeof VALID_JOB_STATUSES)[number])) {
      where.status = status;
    }
    if (type) {
      where.type = type;
    }
    if (priority && VALID_JOB_PRIORITIES.includes(priority as (typeof VALID_JOB_PRIORITIES)[number])) {
      where.priority = priority;
    }

    const [jobs, total] = await Promise.all([
      db.job.findMany({
        where,
        orderBy: [
          // Order by priority weight then creation time
          { priority: "desc" },
          { createdAt: "asc" },
        ],
        skip,
        take: limit,
      }),
      db.job.count({ where }),
    ]);

    return NextResponse.json({
      data: jobs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[organizations/:id/jobs] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch jobs" } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  POST /api/organizations/[id]/jobs
//  Create or schedule a job
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
    const parsed = createJobSchema.safeParse(body);

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

    const { type, payload, priority, scheduledAt } = parsed.data;

    // If scheduledAt is provided, validate it's in the future
    let scheduledAtDate: Date | null = null;
    if (scheduledAt) {
      scheduledAtDate = new Date(scheduledAt);
      if (scheduledAtDate <= new Date()) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "scheduledAt must be in the future",
            },
          },
          { status: 400 },
        );
      }
    }

    const job = await db.job.create({
      data: {
        organizationId: id,
        type,
        payload: JSON.stringify(payload ?? {}),
        status: scheduledAtDate ? "PENDING" : "PENDING",
        priority,
        scheduledAt: scheduledAtDate,
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        organizationId: id,
        actorType: "HUMAN",
        actorId: session.user.id,
        action: "job.create",
        resourceType: "Job",
        resourceId: job.id,
        metadata: JSON.stringify({
          type,
          priority,
          scheduledAt: scheduledAtDate?.toISOString() ?? null,
        }),
      },
    });

    // If scheduled for later, also create an event
    if (scheduledAtDate) {
      await db.event.create({
        data: {
          organizationId: id,
          eventType: "job.scheduled.v1",
          sourceType: "USER_ACTION",
          sourceId: job.id,
          actorType: "human",
          actorId: session.user.id,
          payload: JSON.stringify({
            jobId: job.id,
            type,
            scheduledAt: scheduledAtDate.toISOString(),
          }),
        },
      });
    }

    return NextResponse.json({ data: job }, { status: 201 });
  } catch (error) {
    console.error("[organizations/:id/jobs] POST error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create job" } },
      { status: 500 },
    );
  }
}
