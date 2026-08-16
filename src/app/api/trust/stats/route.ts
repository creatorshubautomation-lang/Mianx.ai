// Mianx.ai — Phase 9: Trust Center — Stats API
//
// GET /api/trust/stats — Trust & security overview for the current user
// Returns: trust scores, audit counts, risk breakdown, security metrics

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ── Mission Trust Metrics ──
    const missionCounts = await db.mission.groupBy({
      by: ["status"],
      where: { userId },
      _count: true,
    });
    const totalMissions = missionCounts.reduce((s, m) => s + m._count, 0);
    const completedCount = missionCounts.find((m) => m.status === "COMPLETED")?._count || 0;
    const failedCount = missionCounts.find((m) => m.status === "FAILED")?._count || 0;
    const successRate = totalMissions > 0
      ? Math.round((completedCount / totalMissions) * 100)
      : 100;

    // ── Task Verification Metrics ──
    const tasks = await db.missionTask.findMany({
      where: {
        mission: { userId },
      },
      select: { verificationStatus: true, status: true, riskLevel: true },
    });
    const totalTasks = tasks.length;
    const verifiedTasks = tasks.filter((t) => t.verificationStatus === "passed").length;
    const failedVerification = tasks.filter((t) => t.verificationStatus === "failed").length;
    const verificationRate = totalTasks > 0
      ? Math.round((verifiedTasks / totalTasks) * 100)
      : 100;

    // ── Approval Metrics ──
    const approvalCounts = await db.humanApproval.groupBy({
      by: ["status"],
      where: { userId },
      _count: true,
    });
    const totalApprovals = approvalCounts.reduce((s, a) => s + a._count, 0);
    const approvedCount = approvalCounts.find((a) => a.status === "APPROVED")?._count || 0;
    const rejectedCount = approvalCounts.find((a) => a.status === "REJECTED")?._count || 0;
    const pendingApprovals = approvalCounts.find((a) => a.status === "PENDING")?._count || 0;

    // ── Tool Call Metrics ──
    const toolCallCounts = await db.agentToolCall.groupBy({
      by: ["status"],
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
      _count: true,
    });
    const totalToolCalls = toolCallCounts.reduce((s, t) => s + t._count, 0);
    const successfulToolCalls = toolCallCounts.find((t) => t.status === "success")?._count || 0;
    const failedToolCalls = toolCallCounts.find((t) => t.status === "failed")?._count || 0;
    const toolSuccessRate = totalToolCalls > 0
      ? Math.round((successfulToolCalls / totalToolCalls) * 100)
      : 100;

    // ── Risk Distribution (tasks) ──
    const riskDistribution = await db.missionTask.groupBy({
      by: ["riskLevel"],
      where: { mission: { userId } },
      _count: true,
    });
    const riskBreakdown = riskDistribution.map((r) => ({
      riskLevel: r.riskLevel,
      count: r._count,
      percent: totalTasks > 0 ? Math.round((r._count / totalTasks) * 100) : 0,
    }));

    // ── Recent Audit Events (last 50) ──
    const recentEvents = await db.missionEvent.findMany({
      where: {
        mission: { userId },
        createdAt: { gte: thirtyDaysAgo },
      },
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
        mission: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // ── Security Events (high-risk) ──
    const securityEvents = recentEvents.filter((e) =>
      ["BUDGET_EXCEEDED", "VERIFICATION_FAILED", "REPAIR_STARTED", "ERROR", "MISSION_FAILED"].includes(e.eventType)
    );

    // ── Budget Trust ──
    const missionsWithBudget = await db.mission.findMany({
      where: { userId, budgetUsd: { not: null } },
      select: { budgetUsd: true, spentUsd: true },
    });
    const totalBudgeted = missionsWithBudget.reduce((s, m) => s + (m.budgetUsd || 0), 0);
    const totalSpent = missionsWithBudget.reduce((s, m) => s + m.spentUsd, 0);
    const budgetAdherence = totalBudgeted > 0
      ? Math.round(Math.min((totalSpent / totalBudgeted) * 100, 100))
      : 100;

    // ── Compute Overall Trust Score ──
    // Weighted: mission success (30%), verification (25%), tool reliability (20%),
    //          budget adherence (15%), approval responsiveness (10%)
    const approvalResponseRate = totalApprovals > 0
      ? ((approvedCount + rejectedCount) / totalApprovals) * 100
      : 100;

    const trustScore = Math.round(
      (successRate * 0.30) +
      (verificationRate * 0.25) +
      (toolSuccessRate * 0.20) +
      (Math.max(0, 100 - budgetAdherence) + budgetAdherence <= 100 ? budgetAdherence : 50) * 0.15 +
      (approvalResponseRate * 0.10)
    );

    // ── Agent Loop Quality ──
    const loopEvents = recentEvents.filter((e) => e.eventType === "AGENT_LOOP_COMPLETED");
    const avgReflectionScore = loopEvents.length > 0
      ? Math.round(
          loopEvents.reduce((s, e) => {
            const meta = e.metadata ? (typeof e.metadata === "string" ? JSON.parse(e.metadata) : e.metadata) : {};
            return s + (meta.reflectionScore || 0);
          }, 0) / loopEvents.length
        )
      : 0;

    // ── Category breakdown for tool calls ──
    const toolCallByCategory = await db.agentToolCall.groupBy({
      by: ["toolName"],
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
      _count: true,
    });
    const topTools = toolCallByCategory
      .sort((a, b) => b._count - a._count)
      .slice(0, 10)
      .map((t) => ({ toolName: t.toolName, calls: t._count }));

    return NextResponse.json({
      // Trust Score
      trustScore: Math.min(trustScore, 100),
      trustGrade: trustScore >= 90 ? "A" : trustScore >= 80 ? "B" : trustScore >= 70 ? "C" : trustScore >= 60 ? "D" : "F",
      trustBreakdown: {
        missionSuccess: successRate,
        verificationRate,
        toolReliability: toolSuccessRate,
        budgetAdherence,
        approvalResponse: Math.round(approvalResponseRate),
      },

      // Mission Stats
      totalMissions,
      completedMissions: completedCount,
      failedMissions: failedCount,
      successRate,

      // Task Stats
      totalTasks,
      verifiedTasks,
      failedVerification,
      verificationRate,

      // Approval Stats
      totalApprovals,
      approvedCount,
      rejectedCount,
      pendingApprovals,

      // Tool Stats
      totalToolCalls,
      successfulToolCalls,
      failedToolCalls,
      toolSuccessRate,
      topTools,

      // Risk Distribution
      riskBreakdown,

      // Agent Loop Quality
      avgReflectionScore,
      loopCompletedCount: loopEvents.length,

      // Security Events
      securityEventCount: securityEvents.length,
      recentSecurityEvents: securityEvents.slice(0, 10).map((e) => ({
        id: e.id,
        eventType: e.eventType,
        title: e.title,
        level: e.level,
        missionTitle: e.mission?.title,
        createdAt: e.createdAt.toISOString(),
      })),

      // Audit summary
      totalAuditEvents: recentEvents.length,
      auditEventsByType: (() => {
        const byType: Record<string, number> = {};
        for (const e of recentEvents) {
          byType[e.eventType] = (byType[e.eventType] || 0) + 1;
        }
        return Object.entries(byType)
          .sort((a, b) => b[1] - a[1])
          .map(([type, count]) => ({ eventType: type, count }));
      })(),
    });
  } catch (error) {
    console.error("[trust/stats] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch trust stats" },
      { status: 500 },
    );
  }
}
