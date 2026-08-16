// Mianx.ai — Phase 9: Trust Center — Audit Log API
//
// GET /api/trust/audit-log — Paginated audit trail
// Query params: ?page=1&limit=20&type=ALL|TOOL|APPROVAL|MISSION|BUDGET|AGENT&level=ALL|info|warn|error|success

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const type = searchParams.get("type") || "ALL";
    const level = searchParams.get("level") || "ALL";
    const search = searchParams.get("search") || "";

    // Map type filter to event types
    const typeMap: Record<string, string[]> = {
      ALL: [],
      TOOL: ["TASK_COMPLETED", "TASK_FAILED"],
      APPROVAL: ["HUMAN_APPROVAL_REQUESTED", "HUMAN_APPROVED", "HUMAN_REJECTED"],
      MISSION: ["CREATED", "STATUS_CHANGED", "PLAN_GENERATED", "PLAN_APPROVED", "PLAN_REJECTED",
                "MISSION_COMPLETED", "MISSION_FAILED", "MISSION_CANCELLED"],
      BUDGET: ["BUDGET_WARNING", "BUDGET_EXCEEDED"],
      AGENT: ["AGENT_LOOP_STARTED", "AGENT_LOOP_ITERATION", "AGENT_LOOP_REFLECTION", "AGENT_LOOP_COMPLETED"],
      VERIFICATION: ["VERIFICATION_PASSED", "VERIFICATION_FAILED", "REPAIR_STARTED", "REPAIR_COMPLETED"],
    };

    // Build where clause
    const where: Record<string, unknown> = {
      mission: { userId },
    };

    if (type !== "ALL" && typeMap[type]) {
      where.eventType = { in: typeMap[type] };
    }

    if (level !== "ALL") {
      where.level = level;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const total = await db.missionEvent.count({ where });

    const events = await db.missionEvent.findMany({
      where,
      select: {
        id: true,
        missionId: true,
        taskId: true,
        eventType: true,
        title: true,
        description: true,
        metadata: true,
        level: true,
        createdAt: true,
        mission: { select: { title: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Also get tool calls for combined audit
    let toolAuditLog: Array<{
      id: string;
      source: string;
      action: string;
      title: string;
      description: string;
      level: string;
      metadata: Record<string, unknown> | null;
      createdAt: string;
      missionTitle?: string;
    }> = [];

    if (type === "ALL" || type === "TOOL") {
      const toolCalls = await db.agentToolCall.findMany({
        where: {
          userId,
          ...(search && {
            toolName: { contains: search, mode: "insensitive" },
          }),
          createdAt: {
            gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          id: true,
          toolName: true,
          agentName: true,
          status: true,
          input: true,
          createdAt: true,
          projectId: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      toolAuditLog = toolCalls.map((tc) => ({
        id: `tool-${tc.id}`,
        source: "TOOL_CALL",
        action: tc.status === "success" ? "TOOL_EXECUTED" : "TOOL_FAILED",
        title: `Tool: ${tc.toolName}`,
        description: `Executed by ${tc.agentName || "system"} — ${tc.status}`,
        level: tc.status === "success" ? "info" : "error",
        metadata: { toolName: tc.toolName, agentName: tc.agentName, status: tc.status },
        createdAt: tc.createdAt.toISOString(),
      }));
    }

    // Combine events + tool calls
    const combinedLog = [
      ...events.map((e) => ({
        id: e.id,
        source: "MISSION_EVENT" as const,
        action: e.eventType,
        title: e.title,
        description: e.description || "",
        level: e.level,
        metadata: e.metadata ? (typeof e.metadata === "string" ? JSON.parse(e.metadata) : e.metadata) : null,
        createdAt: e.createdAt.toISOString(),
        missionTitle: e.mission?.title,
        missionStatus: e.mission?.status,
      })),
      ...toolAuditLog,
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
     .slice(0, limit);

    return NextResponse.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      events: combinedLog,
    });
  } catch (error) {
    console.error("[trust/audit-log] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit log" },
      { status: 500 },
    );
  }
}
