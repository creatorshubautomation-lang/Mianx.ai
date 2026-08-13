import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/admin/stats — admin dashboard stats
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  // Calculate estimated revenue (basic: $49 starter, $199 pro, $499 enterprise per active client)
  const subscriptions = await db.subscription.findMany({
    where: { status: "active" },
  });
  const monthlyRevenue = subscriptions.reduce((sum, s) => sum + s.amount, 0);

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
}
