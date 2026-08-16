// Mianx.ai — Individual Agent Performance Detail API
//
// GET /api/agents/performance/[name] — Detailed performance for a specific agent
// Returns: detailed stats, recent missions, recent tasks, tool usage breakdown, timeline
// Query params: ?period=7d|30d|90d|all (default: 30d)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface RecentMission {
  id: string;
  title: string;
  status: string;
  progress: number;
  spentUsd: number;
  budgetUsd: number | null;
  totalTasks: number;
  completedTasks: number;
  createdAt: string;
  completedAt: string | null;
}

interface RecentTask {
  id: string;
  title: string;
  status: string;
  missionTitle: string;
  durationMs: number | null;
  retryCount: number;
  riskLevel: string;
  outputType: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface ToolUsageBreakdown {
  toolName: string;
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  successRate: number;
  avgDurationMs: number;
  totalDurationMs: number;
}

interface TokenUsageOverTime {
  date: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

interface AgentPerformanceDetail {
  agent: {
    name: string;
    team: string;
    role: string;
    description: string;
    icon: string;
    color: string;
    capabilities: string;
  };
  summary: {
    totalMissions: number;
    activeMissions: number;
    completedMissions: number;
    failedMissions: number;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    runningTasks: number;
    successRate: number;
    avgTaskDurationMs: number;
    medianTaskDurationMs: number;
    p95TaskDurationMs: number;
    totalCostUsd: number;
    avgCostPerMission: number;
    avgCostPerTask: number;
    totalToolCalls: number;
    toolCallSuccessRate: number;
    totalTokensUsed: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    avgTokensPerTask: number;
    avgReflectionScore: number;
    retryRate: number;
    tasksWithRetries: number;
  };
  recentMissions: RecentMission[];
  recentTasks: RecentTask[];
  toolBreakdown: ToolUsageBreakdown[];
  tokenUsageOverTime: TokenUsageOverTime[];
  statusDistribution: { status: string; count: number }[];
  riskDistribution: { risk: string; count: number }[];
  activityByHour: { hour: number; tasks: number }[];
  topMissionsByCost: RecentMission[];
}

function getPeriodStart(period: string): Date {
  const now = new Date();
  if (period === "7d") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (period === "30d") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (period === "90d") return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  return new Date(0);
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  let agentName = "unknown";
  try {
    const { name: rawName } = await params;
    agentName = decodeURIComponent(rawName);
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "30d";
    const periodStart = getPeriodStart(period);

    // ── 1. Get agent info ──
    const agent = await db.agent.findFirst({
      where: { name: agentName },
    });

    if (!agent) {
      return NextResponse.json(
        { error: `Agent "${agentName}" not found` },
        { status: 404 },
      );
    }

    // ── 2. Get tasks for this agent in period ──
    const tasks = await db.missionTask.findMany({
      where: {
        assignedAgent: agentName,
        createdAt: { gte: periodStart },
      },
      include: {
        mission: {
          select: {
            id: true,
            title: true,
            status: true,
            progress: true,
            spentUsd: true,
            budgetUsd: true,
            totalTasks: true,
            completedTasks: true,
            createdAt: true,
            completedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // ── 3. Get mission IDs for this agent ──
    const missionIds = [...new Set(tasks.map((t) => t.missionId))];

    // ── 4. Get AI usage for this agent ──
    const usage = await db.aiProviderUsage.findMany({
      where: {
        agentName: agentName,
        createdAt: { gte: periodStart },
      },
    });

    // ── 5. Get tool calls for this agent ──
    const toolCalls = await db.agentToolCall.findMany({
      where: {
        agentName: agentName,
        createdAt: { gte: periodStart },
      },
    });

    // ── 6. Get agent loop reflection scores ──
    const loopEvents = await db.missionEvent.findMany({
      where: {
        eventType: { in: ["AGENT_LOOP_COMPLETED", "AGENT_LOOP_ITERATION"] },
        createdAt: { gte: periodStart },
        metadata: { contains: agentName },
      },
      select: { metadata: true },
    });

    const reflectionScores: number[] = [];
    for (const event of loopEvents) {
      try {
        const meta = typeof event.metadata === "string" ? JSON.parse(event.metadata) : event.metadata;
        if (meta?.loopReflectionScore && typeof meta.loopReflectionScore === "number") {
          reflectionScores.push(meta.loopReflectionScore);
        }
      } catch { /* skip */ }
    }

    // ── Build summary ──
    const missions = tasks.map((t) => t.mission);
    const uniqueMissions = new Map(missions.map((m) => [m.id, m]));
    const missionList = [...uniqueMissions.values()];

    const activeMissions = missionList.filter((m) =>
      ["EXECUTING", "PLANNING", "VERIFYING", "REPAIRING"].includes(m.status)
    ).length;
    const completedMissions = missionList.filter((m) => m.status === "COMPLETED").length;
    const failedMissions = missionList.filter((m) => m.status === "FAILED").length;

    const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
    const failedTasks = tasks.filter((t) => t.status === "FAILED").length;
    const runningTasks = tasks.filter((t) => t.status === "RUNNING").length;
    const successRate = tasks.length > 0
      ? Math.round((completedTasks / tasks.length) * 100)
      : 0;

    const durations = tasks.filter((t) => t.durationMs && t.durationMs > 0).map((t) => t.durationMs!);
    const avgTaskDurationMs = durations.length > 0
      ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
      : 0;

    const totalCostUsd = usage.reduce((s, u) => s + (u.costUsd || 0), 0);
    const totalTokensUsed = usage.reduce((s, u) => s + (u.totalTokens || 0), 0);
    const totalInputTokens = usage.reduce((s, u) => s + (u.inputTokens || 0), 0);
    const totalOutputTokens = usage.reduce((s, u) => s + (u.outputTokens || 0), 0);

    const totalToolCalls = toolCalls.length;
    const toolCallSuccesses = toolCalls.filter((tc) => tc.status === "success").length;

    const tasksWithRetries = tasks.filter((t) => t.retryCount > 0);
    const retryRate = tasks.length > 0
      ? Math.round((tasksWithRetries.length / tasks.length) * 100)
      : 0;

    // ── Recent missions ──
    const recentMissions: RecentMission[] = missionList
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10)
      .map((m) => ({
        id: m.id,
        title: m.title,
        status: m.status,
        progress: m.progress,
        spentUsd: m.spentUsd,
        budgetUsd: m.budgetUsd,
        totalTasks: m.totalTasks,
        completedTasks: m.completedTasks,
        createdAt: m.createdAt.toISOString(),
        completedAt: m.completedAt?.toISOString() || null,
      }));

    // ── Recent tasks ──
    const recentTasks: RecentTask[] = tasks.slice(0, 20).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      missionTitle: t.mission.title,
      durationMs: t.durationMs,
      retryCount: t.retryCount,
      riskLevel: t.riskLevel,
      outputType: t.outputType,
      startedAt: t.startedAt?.toISOString() || null,
      completedAt: t.completedAt?.toISOString() || null,
    }));

    // ── Tool breakdown ──
    const toolMap: Record<string, { total: number; success: number; failed: number; durations: number[] }> = {};
    for (const tc of toolCalls) {
      if (!toolMap[tc.toolName]) {
        toolMap[tc.toolName] = { total: 0, success: 0, failed: 0, durations: [] };
      }
      toolMap[tc.toolName].total++;
      if (tc.status === "success") toolMap[tc.toolName].success++;
      else if (tc.status === "failed") toolMap[tc.toolName].failed++;
      if (tc.durationMs) toolMap[tc.toolName].durations.push(tc.durationMs);
    }

    const toolBreakdown: ToolUsageBreakdown[] = Object.entries(toolMap)
      .map(([toolName, data]) => ({
        toolName,
        totalCalls: data.total,
        successCalls: data.success,
        failedCalls: data.failed,
        successRate: Math.round((data.success / data.total) * 100),
        avgDurationMs: data.durations.length > 0
          ? Math.round(data.durations.reduce((s, d) => s + d, 0) / data.durations.length)
          : 0,
        totalDurationMs: data.durations.reduce((s, d) => s + d, 0),
      }))
      .sort((a, b) => b.totalCalls - a.totalCalls);

    // ── Token usage over time (last 14 days) ──
    const now = new Date();
    const tokenByDay: Record<string, { input: number; output: number; cost: number }> = {};
    for (let d = 13; d >= 0; d--) {
      const date = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];
      tokenByDay[dateStr] = { input: 0, output: 0, cost: 0 };
    }

    for (const u of usage) {
      const dateStr = u.createdAt.toISOString().split("T")[0];
      if (tokenByDay[dateStr]) {
        tokenByDay[dateStr].input += u.inputTokens || 0;
        tokenByDay[dateStr].output += u.outputTokens || 0;
        tokenByDay[dateStr].cost += u.costUsd || 0;
      }
    }

    const tokenUsageOverTime: TokenUsageOverTime[] = Object.entries(tokenByDay)
      .map(([date, data]) => ({
        date,
        inputTokens: data.input,
        outputTokens: data.output,
        cost: Math.round(data.cost * 100) / 100,
      }));

    // ── Status distribution ──
    const statusMap: Record<string, number> = {};
    for (const t of tasks) {
      statusMap[t.status] = (statusMap[t.status] || 0) + 1;
    }
    const statusDistribution = Object.entries(statusMap)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    // ── Risk distribution ──
    const riskMap: Record<string, number> = {};
    for (const t of tasks) {
      riskMap[t.riskLevel] = (riskMap[t.riskLevel] || 0) + 1;
    }
    const riskDistribution = Object.entries(riskMap)
      .map(([risk, count]) => ({ risk, count }))
      .sort((a, b) => b.count - a.count);

    // ── Activity by hour (24h distribution) ──
    const hourMap: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hourMap[h] = 0;
    for (const t of tasks) {
      if (t.startedAt) {
        const hour = t.startedAt.getHours();
        hourMap[hour]++;
      } else if (t.completedAt) {
        const hour = t.completedAt.getHours();
        hourMap[hour]++;
      }
    }
    const activityByHour = Object.entries(hourMap)
      .map(([hour, tasks]) => ({ hour: parseInt(hour), tasks }));

    // ── Top missions by cost ──
    const topMissionsByCost = [...missionList]
      .sort((a, b) => b.spentUsd - a.spentUsd)
      .slice(0, 5)
      .map((m) => ({
        id: m.id,
        title: m.title,
        status: m.status,
        progress: m.progress,
        spentUsd: m.spentUsd,
        budgetUsd: m.budgetUsd,
        totalTasks: m.totalTasks,
        completedTasks: m.completedTasks,
        createdAt: m.createdAt.toISOString(),
        completedAt: m.completedAt?.toISOString() || null,
      }));

    const detail: AgentPerformanceDetail = {
      agent: {
        name: agent.name,
        team: agent.team,
        role: agent.role,
        description: agent.description,
        icon: agent.icon,
        color: agent.color,
        capabilities: agent.capabilities,
      },
      summary: {
        totalMissions: missionIds.length,
        activeMissions,
        completedMissions,
        failedMissions,
        totalTasks: tasks.length,
        completedTasks,
        failedTasks,
        runningTasks,
        successRate,
        avgTaskDurationMs,
        medianTaskDurationMs: percentile(durations, 50),
        p95TaskDurationMs: percentile(durations, 95),
        totalCostUsd: Math.round(totalCostUsd * 100) / 100,
        avgCostPerMission: missionIds.length > 0
          ? Math.round((totalCostUsd / missionIds.length) * 100) / 100
          : 0,
        avgCostPerTask: tasks.length > 0
          ? Math.round((totalCostUsd / tasks.length) * 100) / 100
          : 0,
        totalToolCalls,
        toolCallSuccessRate: totalToolCalls > 0
          ? Math.round((toolCallSuccesses / totalToolCalls) * 100)
          : 0,
        totalTokensUsed,
        totalInputTokens,
        totalOutputTokens,
        avgTokensPerTask: tasks.length > 0
          ? Math.round(totalTokensUsed / tasks.length)
          : 0,
        avgReflectionScore: reflectionScores.length > 0
          ? Math.round((reflectionScores.reduce((s, r) => s + r, 0) / reflectionScores.length) * 100) / 100
          : 0,
        retryRate,
        tasksWithRetries: tasksWithRetries.length,
      },
      recentMissions,
      recentTasks,
      toolBreakdown,
      tokenUsageOverTime,
      statusDistribution,
      riskDistribution,
      activityByHour,
      topMissionsByCost,
    };

    return NextResponse.json(detail);
  } catch (error) {
    console.error(`[agents/performance/${agentName}] GET error:`, error);
    return NextResponse.json(
      { error: "Failed to fetch agent performance detail" },
      { status: 500 },
    );
  }
}
