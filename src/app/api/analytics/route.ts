import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/analytics — client-side analytics dashboard data
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = session.user.id;

    // Get all user's projects
    const projects = await db.project.findMany({
      where: { clientId: userId },
      select: {
        id: true,
        title: true,
        status: true,
        progress: true,
        createdAt: true,
        _count: {
          select: {
            tasks: true,
            messages: true,
            deliverables: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const totalProjects = projects.length;
    const activeProjects = projects.filter((p) =>
      ["IN_PROGRESS", "BRIEFING", "PLANNING", "REVIEW"].includes(p.status),
    ).length;
    const completedProjects = projects.filter(
      (p) => p.status === "COMPLETED",
    ).length;

    const totalMessages = projects.reduce(
      (sum, p) => sum + p._count.messages,
      0,
    );
    const totalDeliverables = projects.reduce(
      (sum, p) => sum + p._count.deliverables,
      0,
    );

    const allTasks = await db.task.findMany({
      where: { project: { clientId: userId } },
      select: { status: true },
    });

    const taskStats = {
      total: allTasks.length,
      done: allTasks.filter((t) => t.status === "done").length,
      inProgress: allTasks.filter((t) => t.status === "in_progress").length,
      todo: allTasks.filter((t) => t.status === "todo").length,
      review: allTasks.filter((t) => t.status === "review").length,
    };

    // Activity by day (last 14 days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const allActivity = await db.activity.findMany({
      where: {
        project: { clientId: userId },
        createdAt: { gte: fourteenDaysAgo },
      },
      select: { createdAt: true },
    });

    const activityByDay: Record<string, number> = {};
    for (let i = 0; i < 14; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      activityByDay[dateStr] = 0;
    }

    for (const a of allActivity) {
      const dateStr = a.createdAt.toISOString().split("T")[0];
      if (activityByDay[dateStr] !== undefined) {
        activityByDay[dateStr]++;
      }
    }

    return NextResponse.json({
      summary: {
        totalProjects,
        activeProjects,
        completedProjects,
        totalMessages,
        totalDeliverables,
        taskStats,
      },
      projects: projects.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        progress: p.progress,
        createdAt: p.createdAt,
        taskCount: p._count.tasks,
        messageCount: p._count.messages,
        deliverableCount: p._count.deliverables,
      })),
      activityByDay,
    });
  } catch (e) {
    console.error("[analytics] error:", e);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 },
    );
  }
}
