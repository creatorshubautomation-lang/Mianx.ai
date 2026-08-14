import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { autoExecuteNextTask } from "@/lib/auto-execute";

// POST /api/auto-execute — trigger auto-execution of next task
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { projectId } = await req.json();

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 },
      );
    }

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { clientId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (
      project.clientId !== session.user.id &&
      session.user.role !== "ADMIN"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await autoExecuteNextTask(projectId);

    return NextResponse.json({
      ok: true,
      executed: result.executed,
      taskTitle: result.taskTitle,
      agentName: result.agentName,
    });
  } catch (e) {
    console.error("[auto-execute] error:", e);
    return NextResponse.json(
      { error: "Failed to auto-execute" },
      { status: 500 },
    );
  }
}
