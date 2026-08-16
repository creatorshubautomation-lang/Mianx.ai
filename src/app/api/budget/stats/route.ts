// Mianx.ai — Phase 8: Budget Stats API
//
// GET /api/budget/stats — Comprehensive budget overview for the current user
// Returns: plan limits, monthly spend, mission spending, daily averages, alerts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLAN_BUDGET_LIMITS } from "@/lib/approval-engine";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get user plan
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });

    const planTier = user?.plan || "FREE";
    const limits = PLAN_BUDGET_LIMITS[planTier] || PLAN_BUDGET_LIMITS.FREE;

    // Current month boundaries
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Total monthly spend across all missions
    const monthlySpendRaw = await db.mission.aggregate({
      where: {
        userId,
        createdAt: { gte: monthStart, lt: monthEnd },
      },
      _sum: { spentUsd: true },
    });
    const monthlySpend = monthlySpendRaw._sum.spentUsd || 0;

    // All-time spend
    const allTimeSpendRaw = await db.mission.aggregate({
      where: { userId },
      _sum: { spentUsd: true },
    });
    const allTimeSpend = allTimeSpendRaw._sum.spentUsd || 0;

    // AI provider usage this month
    const aiUsageRaw = await db.aiProviderUsage.aggregate({
      where: {
        userId,
        createdAt: { gte: monthStart, lt: monthEnd },
      },
      _sum: { costUsd: true, inputTokens: true, outputTokens: true, totalTokens: true },
      _count: true,
    });

    const aiCostThisMonth = aiUsageRaw._sum.costUsd || 0;
    const totalTokens = aiUsageRaw._sum.totalTokens || 0;
    const totalAiCalls = aiUsageRaw._count || 0;

    // Missions with budget tracking
    const missionsWithBudget = await db.mission.findMany({
      where: {
        userId,
        budgetUsd: { not: null },
      },
      select: {
        id: true,
        title: true,
        status: true,
        budgetUsd: true,
        spentUsd: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Active missions (executing, planning, verifying, repairing)
    const activeMissions = missionsWithBudget.filter((m) =>
      ["EXECUTING", "PLANNING", "VERIFYING", "REPAIRING"].includes(m.status),
    );

    // Budget alerts (missions in warning or exceeded zone)
    const budgetAlerts = missionsWithBudget
      .filter((m) => m.budgetUsd != null && m.spentUsd >= m.budgetUsd * 0.8)
      .map((m) => {
        const budget = m.budgetUsd!;
        const pct = m.spentUsd / budget;
        return {
          missionId: m.id,
          missionTitle: m.title,
          spentUsd: m.spentUsd,
          budgetUsd: budget,
          usagePercent: Math.round(pct * 100),
          isExceeded: pct >= 1,
          isWarning: pct >= 0.8 && pct < 1,
        };
      })
      .sort((a, b) => b.usagePercent - a.usagePercent);

    // Spending by mission status
    const spendByStatus = await db.mission.groupBy({
      by: ["status"],
      where: { userId },
      _sum: { spentUsd: true },
      _count: true,
    });

    // Daily spend for the last 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dailySpend = await db.missionEvent.findMany({
      where: {
        missionId: { in: (await db.mission.findMany({ where: { userId }, select: { id: true } })).map((m) => m.id) },
        eventType: { in: ["BUDGET_WARNING", "BUDGET_EXCEEDED", "TASK_COMPLETED"] },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        eventType: true,
        createdAt: true,
        metadata: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Aggregate daily costs from mission spentUsd snapshots (approximation)
    // Use daily aggregation of AI provider usage for more accurate daily tracking
    const dailyAiUsage = await db.aiProviderUsage.groupBy({
      by: ["createdAt"],
      where: {
        userId,
        createdAt: { gte: thirtyDaysAgo },
      },
      _sum: { costUsd: true },
    });

    // Simplified: build daily array from mission creation dates and spend
    const dailySpendMap: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const day = new Date(now.getTime() - (29 - i) * 24 * 60 * 60 * 1000);
      const key = day.toISOString().split("T")[0];
      dailySpendMap[key] = 0;
    }

    // Fill from AI usage (more accurate)
    for (const row of dailyAiUsage) {
      const key = row.createdAt instanceof Date
        ? row.createdAt.toISOString().split("T")[0]
        : new Date(String(row.createdAt)).toISOString().split("T")[0];
      if (dailySpendMap[key] !== undefined) {
        dailySpendMap[key] += row._sum.costUsd || 0;
      }
    }

    const dailySpendArray = Object.entries(dailySpendMap).map(([date, amount]) => ({
      date,
      amount: Math.round(amount * 100) / 100,
    }));

    // Avg daily spend this month
    const daysInMonth = Math.min(
      now.getDate(),
      Math.ceil((now.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)) || 1,
    );
    const avgDailySpend = monthlySpend / daysInMonth;

    // Projected monthly spend
    const daysRemaining = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
    const projectedMonthly = monthlySpend + (avgDailySpend * daysRemaining);

    return NextResponse.json({
      // Plan limits
      plan: planTier,
      planLimits: limits,

      // Current month
      monthlySpend: Math.round(monthlySpend * 100) / 100,
      monthlyLimit: limits.monthlySpendLimit,
      monthlyUsagePercent: Math.round((monthlySpend / limits.monthlySpendLimit) * 100),
      avgDailySpend: Math.round(avgDailySpend * 100) / 100,
      projectedMonthly: Math.round(projectedMonthly * 100) / 100,
      daysRemaining,

      // All-time
      allTimeSpend: Math.round(allTimeSpend * 100) / 100,

      // AI usage
      aiCostThisMonth: Math.round(aiCostThisMonth * 100) / 100,
      totalTokens,
      totalAiCalls,

      // Missions with budgets
      missionsWithBudget: missionsWithBudget.map((m) => ({
        id: m.id,
        title: m.title,
        status: m.status,
        budgetUsd: m.budgetUsd,
        spentUsd: Math.round(m.spentUsd * 100) / 100,
        usagePercent: m.budgetUsd ? Math.round((m.spentUsd / m.budgetUsd) * 100) : 0,
        createdAt: m.createdAt.toISOString(),
      })),

      // Alerts
      budgetAlerts,
      activeMissionsCount: activeMissions.length,

      // Breakdown by status
      spendByStatus: spendByStatus.map((s) => ({
        status: s.status,
        spentUsd: Math.round((s._sum.spentUsd || 0) * 100) / 100,
        missionCount: s._count,
      })),

      // Daily spend history
      dailySpend: dailySpendArray,
    });
  } catch (error) {
    console.error("[budget/stats] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch budget stats" },
      { status: 500 },
    );
  }
}
