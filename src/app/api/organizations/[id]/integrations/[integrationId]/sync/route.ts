import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  requirePermission,
} from "@/lib/authorization";
import { formatErrorResponse } from "@/lib/org-context";

// ─────────────────────────────────────────────
//  POST /api/organizations/[id]/integrations/[integrationId]/sync
//  Triggers an integration sync by creating a Job + Event
// ─────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; integrationId: string }> },
) {
  const { id, integrationId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  try {
    await requirePermission(id, session.user.id, "core.integration.manage");
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    // Verify the integration exists, belongs to this org, and is connectable
    const integration = await db.integrationConnection.findFirst({
      where: {
        id: integrationId,
        organizationId: id,
      },
      select: {
        id: true,
        provider: true,
        name: true,
        status: true,
      },
    });

    if (!integration) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Integration not found" } },
        { status: 404 },
      );
    }

    if (integration.status === "DISABLED") {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: "Cannot sync a disconnected integration" } },
        { status: 409 },
      );
    }

    // Create a Job for the sync
    const job = await db.job.create({
      data: {
        organizationId: id,
        type: "integration.sync",
        payload: JSON.stringify({
          integrationId: integration.id,
          provider: integration.provider,
        }),
        status: "PENDING",
        priority: "NORMAL",
      },
    });

    // Create an Event for the sync start
    await db.event.create({
      data: {
        organizationId: id,
        eventType: "integration.sync.started",
        sourceType: "USER_ACTION",
        sourceId: integration.id,
        actorType: "human",
        actorId: session.user.id,
        correlationId: job.id,
        payload: JSON.stringify({
          integrationId: integration.id,
          provider: integration.provider,
          name: integration.name,
          jobId: job.id,
        }),
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        organizationId: id,
        actorType: "HUMAN",
        actorId: session.user.id,
        action: "integration.sync.trigger",
        resourceType: "IntegrationConnection",
        resourceId: integrationId,
        metadata: JSON.stringify({
          provider: integration.provider,
          jobId: job.id,
        }),
      },
    });

    return NextResponse.json({
      data: {
        jobId: job.id,
        status: "queued",
      },
    });
  } catch (error) {
    console.error("[organizations/:id/integrations/:integrationId/sync] POST error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to trigger integration sync" } },
      { status: 500 },
    );
  }
}
