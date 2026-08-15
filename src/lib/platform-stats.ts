// Mianx.ai — Configurable Platform Statistics
//
// All marketing numbers on the Home page are sourced from this single module.
// Resolution order:
//   1. Environment variable  (NEXT_PUBLIC_STATS_*)
//   2. Sensible default
//
// For server-side usage the /api/stats endpoint also queries the database
// and merges real counts when available.

export interface PlatformStats {
  totalProjects: string;
  clientSatisfaction: string;
  agentsDeployed: string;
  uptime: string;
  teamsCount: string;
  /** Free-form string used in the bottom CTA, e.g. "1,200+" */
  totalProjectsLabel: string;
}

const DEFAULTS: PlatformStats = {
  totalProjects: "1,200+",
  clientSatisfaction: "98%",
  agentsDeployed: "24",
  uptime: "99.9%",
  teamsCount: "6",
  totalProjectsLabel: "1,200+",
};

/**
 * Returns platform stats for client-side rendering.
 * Values come from `NEXT_PUBLIC_STATS_*` env vars with built-in defaults.
 */
export function getPlatformStats(): PlatformStats {
  return {
    totalProjects:
      process.env.NEXT_PUBLIC_STATS_PROJECTS || DEFAULTS.totalProjects,
    clientSatisfaction:
      process.env.NEXT_PUBLIC_STATS_SATISFACTION ||
      DEFAULTS.clientSatisfaction,
    agentsDeployed:
      process.env.NEXT_PUBLIC_STATS_AGENTS || DEFAULTS.agentsDeployed,
    uptime: process.env.NEXT_PUBLIC_STATS_UPTIME || DEFAULTS.uptime,
    teamsCount:
      process.env.NEXT_PUBLIC_STATS_TEAMS || DEFAULTS.teamsCount,
    totalProjectsLabel:
      process.env.NEXT_PUBLIC_STATS_PROJECTS ||
      DEFAULTS.totalProjectsLabel,
  };
}
