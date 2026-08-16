// Mianx.ai — Phase 6: Agent Loop API
//
// GET  /api/missions/tasks/[taskId]/loop  — Get loop iterations for a task
// POST /api/missions/tasks/[taskId]/loop  — Platform-wide Agent Loop statistics

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAgentLoopStats } from "@/lib/agent-loop";

interface RouteParams {
  params: Promise<{ taskId: string }>;
}

// ─────────────────────────────────────────────
//  GET — Agent Loop statistics & iterations for a task
// ─────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: RouteParams,
) {
  const { taskId } = await params;

  try {
    const task = await db.missionTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        status: true,
        riskLevel: true,
        durationMs: true,
        output: true,
        missionId: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Get mission events for this task (includes loop iterations)
    const events = await db.missionEvent.findMany({
      where: { taskId, missionId: task.missionId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        eventType: true,
        title: true,
        description: true,
        level: true,
        metadata: true,
        createdAt: true,
      },
      take: 50,
    });

    // Extract loop-related events
    const loopEvents = events.filter((e) =>
      e.title.includes("Agent loop") ||
      e.title.includes("Agent reflection") ||
      e.title.includes("iteration") ||
      (e.metadata && typeof e.metadata === "object" &&
        ("loopIterations" in (e.metadata as Record<string, unknown>) || "reflectionScore" in (e.metadata as Record<string, unknown>) || "iteration" in (e.metadata as Record<string, unknown>)))
    );

    // Calculate loop stats from completion event metadata
    const loopMetadata = events.find((e) =>
      e.metadata && typeof e.metadata === "object" && "loopIterations" in (e.metadata as Record<string, unknown>)
    );
    const loopData = loopMetadata?.metadata as Record<string, unknown> | null;

    return NextResponse.json({
      task: {
        id: task.id,
        title: task.title,
        status: task.status,
        riskLevel: task.riskLevel,
        durationMs: task.durationMs,
      },
      loopStats: loopData ? {
        totalIterations: (loopData.loopIterations as number) ?? null,
        toolCalls: (loopData.loopToolCalls as number) ?? null,
        reflectionScore: (loopData.loopReflectionScore as number) ?? null,
        terminationReason: (loopData.loopTermination as string) ?? null,
        executionMode: (loopData.executionMode as string) ?? "unknown",
      } : null,
      loopEvents: loopEvents.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        title: e.title,
        description: e.description,
        level: e.level,
        metadata: e.metadata,
        createdAt: e.createdAt,
      })),
      totalEvents: events.length,
    });
  } catch (error) {
    console.error("[api/tasks/loop] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch loop data" },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  POST — Platform-wide Agent Loop statistics
// ─────────────────────────────────────────────

export async function POST(_req: NextRequest) {
  try {
    const stats = await getAgentLoopStats();
    return NextResponse.json({ stats });
  } catch (error) {
    console.error("[api/tasks/loop] POST error:", error);
    return NextResponse.json(
      { error: "Failed to fetch platform loop stats" },
      { status: 500 },
    );
  }
}
