import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/admin/stats — admin dashboard stats
// Resilient: each query wrapped in try/catch so one failure doesn't break all
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Re-verify role from DB
  let userRole = session.user.role;
  try {
    const dbUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (dbUser) userRole = dbUser.role;
  } catch (e) {
    console.error("[admin] DB role check error:", e);
  }

  if (userRole !== "ADMIN") {
    return NextResponse.json(
      { error: "Forbidden — admin role required", currentRole: userRole },
      { status: 403 },
    );
  }

  // Helper: run a query safely, return null on error
  async function safe<T>(promise: Promise<T>, label: string): Promise<T | null> {
    try {
      return await promise;
    } catch (e) {
      console.error(`[admin] query failed (${label}):`, e);
      return null;
    }
  }

  // Run all queries in parallel, each individually protected
  const [
    totalClients,
    totalProjects,
    activeProjects,
    completedProjects,
    totalAgents,
    totalDeliverables,
    totalMessages,
    recentClients,
    recentProjects,
    projectsByStatus,
    agentActivity,
  ] = await Promise.all([
    safe(db.user.count({ where: { role: "CLIENT" } }), "user.count CLIENT"),
    safe(db.project.count(), "project.count"),
    safe(
      db.project.count({
        where: { status: { in: ["IN_PROGRESS", "BRIEFING", "PLANNING"] } },
      }),
      "project.count active",
    ),
    safe(db.project.count({ where: { status: "COMPLETED" } }), "project.count COMPLETED"),
    safe(db.agent.count(), "agent.count"),
    safe(db.deliverable.count(), "deliverable.count"),
    safe(db.message.count({ where: { role: "agent" } }), "message.count"),
    safe(
      db.user.findMany({
        where: { role: "CLIENT" },
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          company: true,
          createdAt: true,
          _count: { select: { projects: true } },
        },
      }),
      "user.findMany recent",
    ),
    safe(
      db.project.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          client: { select: { name: true, email: true } },
          _count: {
            select: { tasks: true, messages: true, deliverables: true },
          },
        },
      }),
      "project.findMany recent",
    ),
    safe(
      db.project.groupBy({
        by: ["status"],
        _count: true,
      }),
      "project.groupBy",
    ),
    safe(
      db.agent.findMany({
        include: {
          _count: {
            select: { assignments: true, messages: true },
          },
        },
        orderBy: [{ team: "asc" }, { name: "asc" }],
      }),
      "agent.findMany",
    ),
  ]);

  // Revenue (also safe)
  let monthlyRevenue = 0;
  try {
    const subscriptions = await db.subscription.findMany({
      where: { status: "active" },
    });
    monthlyRevenue = subscriptions.reduce((sum, s) => sum + s.amount, 0);
  } catch (e) {
    console.error("[admin] subscription query failed:", e);
  }

  // Return data with nulls for failed queries
  return NextResponse.json({
    stats: {
      totalClients: totalClients ?? 0,
      totalProjects: totalProjects ?? 0,
      activeProjects: activeProjects ?? 0,
      completedProjects: completedProjects ?? 0,
      totalAgents: totalAgents ?? 0,
      totalDeliverables: totalDeliverables ?? 0,
      totalMessages: totalMessages ?? 0,
      monthlyRevenue,
    },
    recentClients: recentClients ?? [],
    recentProjects: recentProjects ?? [],
    projectsByStatus: projectsByStatus ?? [],
    agentActivity: agentActivity ?? [],
  });
}
