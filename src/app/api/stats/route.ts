import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { PlatformStats } from "@/lib/platform-stats";

/**
 * GET /api/stats
 *
 * Returns platform statistics with a three-tier resolution:
 *   1. Real counts from the database (when available)
 *   2. Server-side env vars (STATS_PROJECTS, STATS_SATISFACTION, etc.)
 *   3. Sensible defaults
 *
 * Cached in-memory for 5 minutes to avoid hammering the DB.
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cachedStats: PlatformStats | null = null;
let cachedAt = 0;

export async function GET() {
  // Return cached result if still fresh
  const now = Date.now();
  if (cachedStats && now - cachedAt < CACHE_TTL_MS) {
    return NextResponse.json(cachedStats);
  }

  const stats: PlatformStats = {
    totalProjects: "1,200+",
    clientSatisfaction: "98%",
    agentsDeployed: "24",
    uptime: "99.9%",
    teamsCount: "6",
    totalProjectsLabel: "1,200+",
  };

  try {
    // --- Real counts from the database ---
    const [projectCount, agentCount, userCount] = await Promise.all([
      db.project.count(),
      db.agent.count(),
      db.user.count(),
    ]);

    // Only override defaults when DB has meaningful data
    if (projectCount > 0) {
      const formatted = projectCount.toLocaleString() + "+";
      stats.totalProjects = formatted;
      stats.totalProjectsLabel = formatted;
    }

    if (agentCount > 0) {
      stats.agentsDeployed = String(agentCount);
    }

    // teamsCount: count distinct agent teams from the Agent table
    if (agentCount > 0) {
      const teams = await db.agent.findMany({
        select: { team: true },
        distinct: ["team"],
      });
      if (teams.length > 0) {
        stats.teamsCount = String(teams.length);
      }
    }

    // clientSatisfaction: derive from completed projects with deliverables
    // (only override if there's enough data to be meaningful)
    if (projectCount >= 10) {
      const completedWithDeliverables = await db.project.count({
        where: {
          status: { in: ["COMPLETED", "DELIVERED"] },
          deliverables: { some: {} },
        },
      });
      if (completedWithDeliverables > 0) {
        const rate = Math.round(
          (completedWithDeliverables / projectCount) * 100,
        );
        stats.clientSatisfaction = rate + "%";
      }
    }
  } catch {
    // DB unavailable — fall through to env-var / default values
  }

  // --- Env-var overrides (server-side, no NEXT_PUBLIC_ prefix needed) ---
  if (process.env.STATS_PROJECTS) stats.totalProjects = process.env.STATS_PROJECTS;
  if (process.env.STATS_SATISFACTION) stats.clientSatisfaction = process.env.STATS_SATISFACTION;
  if (process.env.STATS_AGENTS) stats.agentsDeployed = process.env.STATS_AGENTS;
  if (process.env.STATS_UPTIME) stats.uptime = process.env.STATS_UPTIME;
  if (process.env.STATS_TEAMS) stats.teamsCount = process.env.STATS_TEAMS;
  if (process.env.STATS_PROJECTS) stats.totalProjectsLabel = process.env.STATS_PROJECTS;

  cachedStats = stats;
  cachedAt = now;

  return NextResponse.json(stats);
}
