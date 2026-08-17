import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  requirePermission,
} from "@/lib/authorization";
import { formatErrorResponse } from "@/lib/org-context";

// ─────────────────────────────────────────────
//  SCHEMAS
// ─────────────────────────────────────────────

const runAgentSchema = z.object({
  message: z.string().min(1).max(50000),
  context: z.record(z.string(), z.unknown()).optional(),
  conversationId: z.string().max(100).optional(),
});

// ─────────────────────────────────────────────
//  POST /api/organizations/[id]/agents/[agentId]/run
//  Trigger an AI agent run (stub implementation)
// ─────────────────────────────────────────────

export async function POST(
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
    await requirePermission(orgId, session.user.id, "core.agent.execute");
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    // Validate agent exists and is in a runnable state
    const agent = await db.orgAgent.findFirst({
      where: { id: agentId, organizationId: orgId },
    });

    if (!agent) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Agent not found" } },
        { status: 404 },
      );
    }

    if (agent.status !== "ACTIVE" && agent.status !== "TESTING") {
      return NextResponse.json(
        {
          error: {
            code: "AGENT_NOT_RUNNABLE",
            message: `Agent is in ${agent.status} status. Only ACTIVE or TESTING agents can be run.`,
          },
        },
        { status: 400 },
      );
    }

    const body = await request.json();
    const parsed = runAgentSchema.safeParse(body);

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
    const correlationId = crypto.randomUUID();

    // Create an Event record for the agent run (stub)
    const event = await db.event.create({
      data: {
        organizationId: orgId,
        eventType: "agent.run.started",
        eventVersion: "1",
        sourceType: "AI_AGENT",
        sourceId: agentId,
        actorType: "HUMAN",
        actorId: session.user.id,
        correlationId,
        payload: JSON.stringify({
          agentId,
          agentName: agent.name,
          agentStatus: agent.status,
          autonomyLevel: agent.autonomyLevel,
          message: data.message,
          hasContext: !!data.context,
          conversationId: data.conversationId ?? null,
        }),
      },
    });

    // TODO: Wire up real AI execution pipeline
    // For now, return an initiation response

    return NextResponse.json({
      data: {
        runId: event.id,
        correlationId,
        status: "initiated",
        message: "Agent run started",
      },
    });
  } catch (error) {
    console.error("[organizations/:id/agents/:agentId/run] POST error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to start agent run" } },
      { status: 500 },
    );
  }
}
