import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/admin/stats — admin dashboard stats
// This endpoint double-checks the user's role from DB (not just session)
// to ensure that role changes (CLIENT → ADMIN) take effect immediately.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Re-verify role from DB (in case session is stale)
  let userRole = session.user.role;
  try {
    const dbUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (dbUser) {
      userRole = dbUser.role;
    }
  } catch (e) {
    console.error("[admin] DB role check error:", e);
  }

  if (userRole !== "ADMIN") {
    console.log(
      "[admin] access denied for user:",
      session.user.id,
      "role:",
      userRole,
    );
    return NextResponse.json(
      {
        error: "Forbidden — admin role required",
        currentRole: userRole,
        userId: session.user.id,
      },
      { status: 403 },
    );
  }

  try {
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
      db.user.count({ where: { role: "CLIENT" } }),
      db.project.count(),
      db.project.count({
        where: { status: { in: ["IN_PROGRESS", "BRIEFING", "PLANNING"] } },
      }),
      db.project.count({ where: { status: "COMPLETED" } }),
      db.agent.count(),
      db.deliverable.count(),
      db.message.count({ where: { role: "agent" } }),
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
      db.project.groupBy({
        by: ["status"],
        _count: true,
      }),
      db.agent.findMany({
        include: {
          _count: {
            select: { assignments: true, messages: true },
          },
        },
        orderBy: [{ team: "asc" }, { name: "asc" }],
      }),
    ]);

    // Calculate estimated revenue
    const subscriptions = await db.subscription.findMany({
      where: { status: "active" },
    });
    const monthlyRevenue = subscriptions.reduce(
      (sum, s) => sum + s.amount,
      0,
    );

    return NextResponse.json({
      stats: {
        totalClients,
        totalProjects,
        activeProjects,
        completedProjects,
        totalAgents,
        totalDeliverables,
        totalMessages,
        monthlyRevenue,
      },
      recentClients,
      recentProjects,
      projectsByStatus,
      agentActivity,
    });
  } catch (e) {
    console.error("[admin] data fetch error:", e);
    return NextResponse.json(
      {
        error: "Failed to fetch admin data",
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
