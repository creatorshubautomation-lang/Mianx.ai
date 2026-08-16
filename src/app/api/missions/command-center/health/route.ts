// Mianx.ai — Phase 7+: System Health Monitoring API
//
// GET /api/missions/command-center/health — System health metrics
// Returns: API latency, error rates, queue depth, resource utilization

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

interface HealthMetrics {
  // Mission queue depth by status
  queueDepth: Record<string, number>;
  totalQueueDepth: number;

  // Approval queue
  approvalPending: number;
  approvalOldestMinutes: number | null;

  // Recent error rate (last 24h)
  recentErrorCount: number;
  recentTotalEvents: number;
  errorRate: number;

  // Budget health
  budgetUtilization: number; // % of total budget spent
  missionsOverBudget: number;
  missionsNearBudget: number; // >80% used

  // Agent loop stats (from events in last 24h)
  avgLoopIterations24h: number;
  loopReflections24h: number;

  // System uptime indicator
  systemStatus: "healthy" | "degraded" | "critical";
  lastActivityAt: string | null;
  timestamp: string;
}

export async function GET() {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // ── Queue Depth by Status ──
    const statusGroups = await db.mission.groupBy({
      by: ["status"],
      _count: { id: true },
    });

    const queueDepth: Record<string, number> = {};
    let totalQueueDepth = 0;
    for (const group of statusGroups) {
      queueDepth[group.status] = group._count.id;
      totalQueueDepth += group._count.id;
    }

    // ── Approval Queue ──
    const approvalPending = await db.humanApproval.count({
      where: { status: "PENDING" },
    });

    const oldestApproval = await db.humanApproval.findFirst({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });

    const approvalOldestMinutes = oldestApproval
      ? Math.round((now.getTime() - oldestApproval.createdAt.getTime()) / 60000)
      : null;

    // ── Error Rate (last 24h) ──
    const recentErrorEvents = await db.missionEvent.count({
      where: {
        level: { in: ["ERROR", "CRITICAL"] },
        createdAt: { gte: twentyFourHoursAgo },
      },
    });

    const recentTotalEvents = await db.missionEvent.count({
      where: { createdAt: { gte: twentyFourHoursAgo } },
    });

    const errorRate = recentTotalEvents > 0
      ? Math.round((recentErrorEvents / recentTotalEvents) * 1000) / 10
      : 0;

    // ── Budget Health ──
    const budgetData = await db.mission.findMany({
      where: {
        budgetUsd: { gt: 0 },
      },
      select: { spentUsd: true, budgetUsd: true },
    });

    let totalBudgetSum = 0;
    let totalSpentSum = 0;
    let missionsOverBudget = 0;
    let missionsNearBudget = 0;

    for (const m of budgetData) {
      const budget = m.budgetUsd ?? 0;
      const spent = m.spentUsd ?? 0;
      totalBudgetSum += budget;
      totalSpentSum += Math.min(spent, budget);
      const pct = budget > 0 ? (spent / budget) * 100 : 0;
      if (pct >= 100) missionsOverBudget++;
      else if (pct >= 80) missionsNearBudget++;
    }

    const budgetUtilization = totalBudgetSum > 0
      ? Math.round((totalSpentSum / totalBudgetSum) * 100)
      : 0;

    // ── Agent Loop Stats (24h) ──
    const loopEvents24h = await db.missionEvent.findMany({
      where: {
        eventType: { in: ["AGENT_LOOP_COMPLETED", "AGENT_LOOP_ITERATION"] },
        createdAt: { gte: twentyFourHoursAgo },
      },
      select: { metadata: true, eventType: true },
      take: 100,
    });

    let totalIterations24h = 0;
    let reflectionCount24h = 0;
    let loopCount24h = 0;

    for (const event of loopEvents24h) {
      if (event.eventType === "AGENT_LOOP_COMPLETED") {
        loopCount24h++;
      }
      try {
        const meta = typeof event.metadata === "string"
          ? JSON.parse(event.metadata)
          : event.metadata;
        if (meta?.loopIterations) totalIterations24h += meta.loopIterations;
        if (meta?.loopReflectionScore) reflectionCount24h++;
      } catch { /* skip */ }
    }

    const avgLoopIterations24h = loopCount24h > 0
      ? Math.round((totalIterations24h / loopCount24h) * 10) / 10
      : 0;

    // ── Last Activity ──
    const lastEvent = await db.missionEvent.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    // ── System Status ──
    let systemStatus: "healthy" | "degraded" | "critical" = "healthy";
    if (errorRate > 20 || approvalOldestMinutes !== null && approvalOldestMinutes > 120) {
      systemStatus = "critical";
    } else if (errorRate > 5 || approvalOldestMinutes !== null && approvalOldestMinutes > 60 || missionsOverBudget > 0) {
      systemStatus = "degraded";
    }

    const metrics: HealthMetrics = {
      queueDepth,
      totalQueueDepth,
      approvalPending,
      approvalOldestMinutes,
      recentErrorCount: recentErrorEvents,
      recentTotalEvents,
      errorRate,
      budgetUtilization,
      missionsOverBudget,
      missionsNearBudget,
      avgLoopIterations24h,
      loopReflections24h: reflectionCount24h,
      systemStatus,
      lastActivityAt: lastEvent?.createdAt?.toISOString() || null,
      timestamp: now.toISOString(),
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error("[command-center/health] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch health metrics" },
      { status: 500 },
    );
  }
}
