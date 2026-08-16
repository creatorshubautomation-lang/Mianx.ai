// Mianx.ai — Phase 7: Command Center API
//
// GET /api/missions/command-center — Platform-wide stats for the Command Center dashboard
// Returns: mission stats, task stats, budget overview, agent loop stats, recent events

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// ─────────────────────────────────────────────
//  GET — Platform-wide Command Center stats
// ─────────────────────────────────────────────

export async function GET() {
  try {
    // ── Mission Stats ──
    const missionStats = await db.mission.findMany({
      select: {
        id: true,
        title: true,
        status: true,
        progress: true,
        totalTasks: true,
        completedTasks: true,
        failedTasks: true,
        spentUsd: true,
        budgetUsd: true,
        startedAt: true,
        createdAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    const totalMissions = missionStats.length;
    const activeMissions = missionStats.filter((m) =>
      ["EXECUTING", "PLANNING", "VERIFYING", "REPAIRING", "APPROVED"].includes(m.status)
    ).length;
    const completedMissions = missionStats.filter((m) => m.status === "COMPLETED").length;
    const failedMissions = missionStats.filter((m) => m.status === "FAILED").length;

    // ── Task Stats ──
    const totalTasks = await db.missionTask.count();
    const completedTasks = await db.missionTask.count({ where: { status: "COMPLETED" } });
    const runningTasks = await db.missionTask.count({ where: { status: { in: ["RUNNING", "READY"] } } });

    // ── Budget Stats ──
    const budgetAgg = await db.mission.aggregate({
      _sum: { spentUsd: true, budgetUsd: true },
    });

    const totalSpent = (budgetAgg._sum.spentUsd || 0) as number;
    const totalBudget = (budgetAgg._sum.budgetUsd || 0) as number;

    // ── Approval Stats ──
    const approvalPending = await db.humanApproval.count({
      where: { status: "PENDING" },
    });

    // ── Success Rate ──
    const terminalMissions = missionStats.filter((m) =>
      ["COMPLETED", "FAILED", "CANCELLED"].includes(m.status)
    );
    const avgSuccessRate = terminalMissions.length > 0
      ? Math.round((completedMissions / terminalMissions.length) * 100)
      : 0;

    // ── Agent Loop Stats (Phase 6) ──
    // Extract from mission event metadata
    const loopEvents = await db.missionEvent.findMany({
      where: {
        metadata: { not: null },
      },
      select: { metadata: true },
      take: 100,
    });

    let agentLoopRuns = 0;
    let totalIterations = 0;
    let totalReflectionScore = 0;
    let reflectionCount = 0;

    for (const event of loopEvents) {
      try {
        const meta = typeof event.metadata === "string"
          ? JSON.parse(event.metadata)
          : event.metadata;

        if (meta && typeof meta === "object" && "loopIterations" in meta) {
          agentLoopRuns++;
          totalIterations += (meta.loopIterations as number) || 0;
          if (meta.loopReflectionScore) {
            totalReflectionScore += (meta.loopReflectionScore as number) || 0;
            reflectionCount++;
          }
        }
      } catch {
        // Skip malformed metadata
      }
    }

    const avgLoopIterations = agentLoopRuns > 0
      ? Math.round((totalIterations / agentLoopRuns) * 10) / 10
      : 0;
    const avgReflectionScore = reflectionCount > 0
      ? Math.round((totalReflectionScore / reflectionCount) * 10) / 10
      : 0;

    // ── Recent Events ──
    const recentEvents = await db.missionEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        missionId: true,
        eventType: true,
        title: true,
        description: true,
        level: true,
        createdAt: true,
        mission: {
          select: { title: true },
        },
      },
    });

    // ── Active Mission Summaries ──
    const activeMissionsList = await db.mission.findMany({
      where: {
        status: { in: ["EXECUTING", "PLANNING", "VERIFYING", "REPAIRING", "APPROVED", "AWAITING_APPROVAL"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        status: true,
        progress: true,
        totalTasks: true,
        completedTasks: true,
        failedTasks: true,
        spentUsd: true,
        budgetUsd: true,
        startedAt: true,
      },
    });

    // Get current running task for each active mission
    const activeMissionSummaries = await Promise.all(
      activeMissionsList.map(async (mission) => {
        const runningTask = await db.missionTask.findFirst({
          where: {
            missionId: mission.id,
            status: { in: ["RUNNING", "READY"] },
          },
          select: { title: true, assignedAgent: true },
          orderBy: { priority: "desc" },
        });

        return {
          id: mission.id,
          title: mission.title,
          status: mission.status as string,
          progress: mission.progress,
          totalTasks: mission.totalTasks,
          completedTasks: mission.completedTasks,
          failedTasks: mission.failedTasks,
          spentUsd: mission.spentUsd,
          budgetUsd: mission.budgetUsd,
          startedAt: mission.startedAt?.toISOString() || null,
          currentTask: runningTask?.title || undefined,
          agentName: runningTask?.assignedAgent || undefined,
        };
      }),
    );

    return NextResponse.json({
      totalMissions,
      activeMissions,
      completedMissions,
      failedMissions,
      totalTasks,
      completedTasks,
      runningTasks,
      totalSpent,
      totalBudget,
      approvalPending,
      avgSuccessRate,
      agentLoopRuns,
      avgLoopIterations,
      avgReflectionScore,
      recentEvents: recentEvents.map((e) => ({
        id: e.id,
        missionId: e.missionId,
        eventType: e.eventType,
        title: e.title,
        description: e.description,
        level: e.level,
        missionTitle: e.mission?.title || null,
        createdAt: e.createdAt.toISOString(),
      })),
      activeMissionList: activeMissionSummaries,
    });
  } catch (error) {
    console.error("[api/command-center] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch command center data" },
      { status: 500 },
    );
  }
}
