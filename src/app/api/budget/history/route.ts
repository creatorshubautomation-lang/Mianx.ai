// Mianx.ai — Phase 8: Budget History API
//
// GET /api/budget/history — Detailed cost history with filtering
// Query params: ?period=7d|30d|90d|all & missionId=xxx

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
    const period = searchParams.get("period") || "30d";
    const missionId = searchParams.get("missionId");

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "all":
        startDate = new Date(0);
        break;
      case "30d":
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    // Build where clause
    const where: Record<string, unknown> = {
      userId,
    };

    if (missionId) {
      where.id = missionId;
    }

    // Get missions in the period
    const missions = await db.mission.findMany({
      where: {
        ...where,
        createdAt: { gte: startDate },
      },
      select: {
        id: true,
        title: true,
        status: true,
        budgetUsd: true,
        spentUsd: true,
        totalTasks: true,
        completedTasks: true,
        failedTasks: true,
        createdAt: true,
        completedAt: true,
        startedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Get budget events (warnings, exceeded)
    const missionIds = missions.map((m) => m.id);

    const budgetEvents = missionIds.length > 0
      ? await db.missionEvent.findMany({
          where: {
            missionId: { in: missionIds },
            eventType: { in: ["BUDGET_WARNING", "BUDGET_EXCEEDED"] },
          },
          select: {
            id: true,
            missionId: true,
            eventType: true,
            title: true,
            description: true,
            metadata: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

    // Get AI provider usage breakdown by day
    const aiUsageByDay = await db.aiProviderUsage.groupBy({
      by: ["provider", "tier"],
      where: {
        userId,
        createdAt: { gte: startDate },
      },
      _sum: {
        costUsd: true,
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
      },
      _count: true,
    });

    // Tool call costs (from tool definitions)
    const toolCalls = await db.agentToolCall.findMany({
      where: {
        userId,
        createdAt: { gte: startDate },
      },
      select: {
        toolName: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Summary stats
    const totalSpend = missions.reduce((sum, m) => sum + m.spentUsd, 0);
    const missionsWithBudget = missions.filter((m) => m.budgetUsd);
    const totalBudgeted = missionsWithBudget.reduce((sum, m) => sum + (m.budgetUsd || 0), 0);
    const completedCount = missions.filter((m) => m.status === "COMPLETED").length;
    const avgCostPerMission = missions.length > 0 ? totalSpend / missions.length : 0;
    const avgCostPerCompleted = completedCount > 0
      ? missions.filter((m) => m.status === "COMPLETED").reduce((s, m) => s + m.spentUsd, 0) / completedCount
      : 0;

    return NextResponse.json({
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),

      // Summary
      summary: {
        totalMissions: missions.length,
        completedMissions: completedCount,
        totalSpend: Math.round(totalSpend * 100) / 100,
        totalBudgeted: Math.round(totalBudgeted * 100) / 100,
        budgetUtilization: totalBudgeted > 0
          ? Math.round((totalSpend / totalBudgeted) * 100)
          : 0,
        avgCostPerMission: Math.round(avgCostPerMission * 100) / 100,
        avgCostPerCompleted: Math.round(avgCostPerCompleted * 100) / 100,
      },

      // Mission list
      missions: missions.map((m) => ({
        id: m.id,
        title: m.title,
        status: m.status,
        budgetUsd: m.budgetUsd,
        spentUsd: Math.round(m.spentUsd * 100) / 100,
        totalTasks: m.totalTasks,
        completedTasks: m.completedTasks,
        failedTasks: m.failedTasks,
        createdAt: m.createdAt.toISOString(),
        completedAt: m.completedAt?.toISOString() || null,
        startedAt: m.startedAt?.toISOString() || null,
      })),

      // Budget events
      budgetEvents: budgetEvents.map((e) => ({
        id: e.id,
        missionId: e.missionId,
        eventType: e.eventType,
        title: e.title,
        description: e.description,
        metadata: e.metadata ? JSON.parse(e.metadata) : null,
        createdAt: e.createdAt.toISOString(),
      })),

      // AI usage breakdown
      aiUsageBreakdown: aiUsageByDay.map((a) => ({
        provider: a.provider,
        tier: a.tier,
        totalCalls: a._count,
        costUsd: Math.round((a._sum.costUsd || 0) * 100) / 100,
        inputTokens: a._sum.inputTokens || 0,
        outputTokens: a._sum.outputTokens || 0,
        totalTokens: a._sum.totalTokens || 0,
      })),

      // Recent tool calls
      recentToolCalls: toolCalls.slice(0, 20).map((t) => ({
        toolName: t.toolName,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[budget/history] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch budget history" },
      { status: 500 },
    );
  }
}
