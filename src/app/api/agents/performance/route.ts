// Mianx.ai — Agent Performance Overview API
//
// GET /api/agents/performance — Aggregated performance metrics for all agents
// Returns: per-agent stats (missions, tasks, success rate, avg time, cost, tool usage)
// Query params: ?period=7d|30d|90d|all (default: 30d)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface AgentPerfSummary {
  name: string;
  team: string;
  icon: string;
  color: string;
  totalMissions: number;
  activeMissions: number;
  completedMissions: number;
  failedMissions: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  runningTasks: number;
  successRate: number;       // 0-100
  avgTaskDurationMs: number;
  totalCostUsd: number;
  avgCostPerMission: number;
  totalToolCalls: number;
  toolCallSuccessRate: number;
  totalTokensUsed: number;
  avgTokensPerTask: number;
  avgReflectionScore: number;
  retryRate: number;          // percentage of tasks that needed retries
  mostUsedTools: { name: string; count: number }[];
  dailyActivity: { date: string; tasks: number; cost: number }[]; // last 14 days
}

interface PerformanceOverview {
  agents: AgentPerfSummary[];
  totals: {
    totalAgents: number;
    totalMissions: number;
    totalTasks: number;
    avgSuccessRate: number;
    totalCost: number;
    totalTokens: number;
  };
  topPerformers: {
    fastest: string | null;
    mostReliable: string | null;
    mostUsed: string | null;
    mostEfficient: string | null;
  };
  timestamp: string;
}

function getPeriodStart(period: string): Date {
  const now = new Date();
  if (period === "7d") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (period === "30d") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (period === "90d") return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  return new Date(0); // "all" — epoch
}

function parseMetadata(metadata: string | null | object): Record<string, unknown> {
  if (!metadata) return {};
  if (typeof metadata === "object") return metadata as Record<string, unknown>;
  try { return JSON.parse(metadata); } catch { return {}; }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "30d";
    const periodStart = getPeriodStart(period);

    // ── 1. Get all agents from catalog ──
    const agents = await db.agent.findMany({
      include: { _count: { select: { assignments: true, messages: true } } },
      orderBy: [{ team: "asc" }, { name: "asc" }],
    });

    // ── 2. Get all mission tasks within period, grouped by agent ──
    const tasksInPeriod = await db.missionTask.findMany({
      where: { createdAt: { gte: periodStart } },
      select: {
        assignedAgent: true,
        agentTeam: true,
        status: true,
        durationMs: true,
        retryCount: true,
        requiredTools: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        missionId: true,
      },
    });

    // ── 3. Get missions within period (for mission-level stats) ──
    const missionsInPeriod = await db.mission.findMany({
      where: { createdAt: { gte: periodStart } },
      select: {
        id: true,
        status: true,
        spentUsd: true,
        totalTasks: true,
        completedTasks: true,
        failedTasks: true,
        createdAt: true,
      },
    });

    // ── 4. Get AI provider usage within period ──
    const usageInPeriod = await db.aiProviderUsage.findMany({
      where: { createdAt: { gte: periodStart } },
      select: {
        agentName: true,
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        costUsd: true,
        status: true,
        responseTimeMs: true,
        createdAt: true,
      },
    });

    // ── 5. Get tool calls within period ──
    const toolCallsInPeriod = await db.agentToolCall.findMany({
      where: { createdAt: { gte: periodStart } },
      select: {
        agentName: true,
        toolName: true,
        status: true,
        durationMs: true,
        createdAt: true,
      },
    });

    // ── 6. Get agent loop reflection scores ──
    const loopEvents = await db.missionEvent.findMany({
      where: {
        eventType: { in: ["AGENT_LOOP_COMPLETED", "AGENT_LOOP_ITERATION"] },
        createdAt: { gte: periodStart },
      },
      select: { metadata: true, createdAt: true },
    });

    // Build reflection score map by agent name (approximation from mission metadata)
    const reflectionScores: Record<string, number[]> = {};
    for (const event of loopEvents) {
      const meta = parseMetadata(event.metadata);
      const agent = (meta.agentName as string) || "unknown";
      if (meta.loopReflectionScore && typeof meta.loopReflectionScore === "number") {
        if (!reflectionScores[agent]) reflectionScores[agent] = [];
        reflectionScores[agent].push(meta.loopReflectionScore);
      }
    }

    // ── 7. Group tasks by agent ──
    const tasksByAgent: Record<string, typeof tasksInPeriod> = {};
    for (const task of tasksInPeriod) {
      const agent = task.assignedAgent || "unassigned";
      if (!tasksByAgent[agent]) tasksByAgent[agent] = [];
      tasksByAgent[agent].push(task);
    }

    // ── 8. Get missions per agent (via tasks) ──
    const missionIdsByAgent: Record<string, Set<string>> = {};
    for (const task of tasksInPeriod) {
      const agent = task.assignedAgent || "unassigned";
      if (!missionIdsByAgent[agent]) missionIdsByAgent[agent] = new Set();
      missionIdsByAgent[agent].add(task.missionId);
    }

    // ── 9. Group usage by agent ──
    const usageByAgent: Record<string, typeof usageInPeriod> = {};
    for (const u of usageInPeriod) {
      const agent = u.agentName || "unassigned";
      if (!usageByAgent[agent]) usageByAgent[agent] = [];
      usageByAgent[agent].push(u);
    }

    // ── 10. Group tool calls by agent ──
    const toolCallsByAgent: Record<string, typeof toolCallsInPeriod> = {};
    for (const tc of toolCallsInPeriod) {
      const agent = tc.agentName || "unassigned";
      if (!toolCallsByAgent[agent]) toolCallsByAgent[agent] = [];
      toolCallsByAgent[agent].push(tc);
    }

    // ── 11. Build daily activity for last 14 days ──
    const now = new Date();
    const dailyActivityMap: Record<string, Record<string, { tasks: number; cost: number }>> = {};
    for (let d = 13; d >= 0; d--) {
      const date = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];
      dailyActivityMap[dateStr] = {};
    }

    for (const task of tasksInPeriod) {
      const agent = task.assignedAgent || "unassigned";
      if (!task.createdAt) continue;
      const dateStr = task.createdAt.toISOString().split("T")[0];
      if (!dailyActivityMap[dateStr]) continue;
      if (!dailyActivityMap[dateStr][agent]) dailyActivityMap[dateStr][agent] = { tasks: 0, cost: 0 };
      dailyActivityMap[dateStr][agent].tasks++;
    }

    // ── 12. Build per-agent summary ──
    const summaries: AgentPerfSummary[] = agents.map((agent) => {
      const name = agent.name;
      const tasks = tasksByAgent[name] || [];
      const missionIds = missionIdsByAgent[name] || new Set();
      const usage = usageByAgent[name] || [];
      const toolCalls = toolCallsByAgent[name] || [];
      const reflections = reflectionScores[name] || [];

      // Mission stats
      const missionsInSet = missionsInPeriod.filter((m) => missionIds.has(m.id));
      const totalMissions = missionIds.size;
      const activeMissions = missionsInSet.filter((m) =>
        ["EXECUTING", "PLANNING", "VERIFYING", "REPAIRING"].includes(m.status)
      ).length;
      const completedMissions = missionsInSet.filter((m) => m.status === "COMPLETED").length;
      const failedMissions = missionsInSet.filter((m) => m.status === "FAILED").length;

      // Task stats
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
      const failedTasks = tasks.filter((t) => t.status === "FAILED").length;
      const runningTasks = tasks.filter((t) => t.status === "RUNNING").length;
      const successRate = totalTasks > 0
        ? Math.round((completedTasks / totalTasks) * 100)
        : 0;

      // Duration
      const durationsWithValues = tasks.filter((t) => t.durationMs && t.durationMs > 0);
      const avgTaskDurationMs = durationsWithValues.length > 0
        ? Math.round(durationsWithValues.reduce((s, t) => s + (t.durationMs || 0), 0) / durationsWithValues.length)
        : 0;

      // Cost
      const totalCostUsd = usage.reduce((s, u) => s + (u.costUsd || 0), 0);
      const avgCostPerMission = totalMissions > 0
        ? Math.round((totalCostUsd / totalMissions) * 100) / 100
        : 0;

      // Tool calls
      const totalToolCalls = toolCalls.length;
      const toolCallSuccesses = toolCalls.filter((tc) => tc.status === "success").length;
      const toolCallSuccessRate = totalToolCalls > 0
        ? Math.round((toolCallSuccesses / totalToolCalls) * 100)
        : 0;

      // Tokens
      const totalTokensUsed = usage.reduce((s, u) => s + (u.totalTokens || 0), 0);
      const avgTokensPerTask = totalTasks > 0
        ? Math.round(totalTokensUsed / totalTasks)
        : 0;

      // Reflection score
      const avgReflectionScore = reflections.length > 0
        ? Math.round((reflections.reduce((s, r) => s + r, 0) / reflections.length) * 100) / 100
        : 0;

      // Retry rate
      const tasksWithRetries = tasks.filter((t) => t.retryCount > 0);
      const retryRate = totalTasks > 0
        ? Math.round((tasksWithRetries.length / totalTasks) * 100)
        : 0;

      // Most used tools
      const toolCounts: Record<string, number> = {};
      for (const tc of toolCalls) {
        toolCounts[tc.toolName] = (toolCounts[tc.toolName] || 0) + 1;
      }
      const mostUsedTools = Object.entries(toolCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      // Daily activity
      const dailyActivity = Object.entries(dailyActivityMap)
        .map(([date, agentsMap]) => {
          const data = agentsMap[name];
          return {
            date,
            tasks: data?.tasks || 0,
            cost: Math.round((data?.cost || 0) * 100) / 100,
          };
        })
        .slice(-14);

      return {
        name,
        team: agent.team,
        icon: agent.icon,
        color: agent.color,
        totalMissions,
        activeMissions,
        completedMissions,
        failedMissions,
        totalTasks,
        completedTasks,
        failedTasks,
        runningTasks,
        successRate,
        avgTaskDurationMs,
        totalCostUsd: Math.round(totalCostUsd * 100) / 100,
        avgCostPerMission,
        totalToolCalls,
        toolCallSuccessRate,
        totalTokensUsed,
        avgTokensPerTask,
        avgReflectionScore,
        retryRate,
        mostUsedTools,
        dailyActivity,
      };
    });

    // ── 13. Totals ──
    const agentsWithTasks = summaries.filter((a) => a.totalTasks > 0);
    const avgSuccessRate = agentsWithTasks.length > 0
      ? Math.round(agentsWithTasks.reduce((s, a) => s + a.successRate, 0) / agentsWithTasks.length)
      : 0;

    const totals = {
      totalAgents: summaries.length,
      totalMissions: summaries.reduce((s, a) => s + a.totalMissions, 0),
      totalTasks: summaries.reduce((s, a) => s + a.totalTasks, 0),
      avgSuccessRate,
      totalCost: Math.round(summaries.reduce((s, a) => s + a.totalCostUsd, 0) * 100) / 100,
      totalTokens: summaries.reduce((s, a) => s + a.totalTokensUsed, 0),
    };

    // ── 14. Top performers ──
    const withTasks = summaries.filter((a) => a.totalTasks >= 3);
    const fastest = withTasks.length > 0
      ? withTasks.reduce((best, a) => (a.avgTaskDurationMs < best.avgTaskDurationMs ? a : best)).name
      : null;
    const mostReliable = withTasks.length > 0
      ? withTasks.reduce((best, a) => (a.successRate > best.successRate ? a : best)).name
      : null;
    const mostUsed = summaries.length > 0
      ? summaries.reduce((best, a) => (a.totalTasks > best.totalTasks ? a : best)).name
      : null;
    const withCost = summaries.filter((a) => a.totalMissions > 0 && a.avgCostPerMission > 0);
    const mostEfficient = withCost.length > 0
      ? withCost.reduce((best, a) => (a.avgCostPerMission < best.avgCostPerMission ? a : best)).name
      : null;

    // Sort agents by total tasks (most active first)
    summaries.sort((a, b) => b.totalTasks - a.totalTasks);

    const result: PerformanceOverview = {
      agents: summaries,
      totals,
      topPerformers: { fastest, mostReliable, mostUsed, mostEfficient },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("[agents/performance] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent performance data" },
      { status: 500 },
    );
  }
}
