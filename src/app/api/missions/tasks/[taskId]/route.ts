// Mianx.ai — Mission Task Update Route
//
// PATCH /api/missions/tasks/[taskId] — Update a mission task

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { logMissionEvent, recalculateMissionProgress } from "@/lib/mission-engine";

async function getAuthUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session.user;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { taskId } = await params;

    // Find the task and verify ownership through the mission
    const task = await db.missionTask.findUnique({
      where: { id: taskId },
      include: { mission: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (task.mission.userId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const allowedFields = [
      "status", "output", "outputType",
      "verificationStatus", "verificationResult",
      "retryCount", "approvalStatus", "approvalReason",
    ];
    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Auto-set timing
    if (body.status === "RUNNING" && !task.startedAt) {
      updates.startedAt = new Date();
    }
    if ((body.status === "COMPLETED" || body.status === "FAILED" || body.status === "SKIPPED" || body.status === "CANCELLED") && !task.completedAt) {
      updates.completedAt = new Date();
    }
    if (body.durationMs !== undefined) {
      updates.durationMs = body.durationMs;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updatedTask = await db.missionTask.update({
      where: { id: taskId },
      data: updates,
    });

    // Log task events
    if (body.status && body.status !== task.status) {
      await logMissionEvent(task.missionId, {
        eventType: body.status === "COMPLETED" ? "TASK_COMPLETED"
          : body.status === "FAILED" ? "TASK_FAILED"
            : body.status === "RUNNING" ? "TASK_STARTED"
              : "STATUS_CHANGED",
        title: `Task ${body.status}: ${task.title}`,
        description: `Task "${task.title}" changed from ${task.status} to ${body.status}`,
        taskId: task.id,
        level: body.status === "COMPLETED" ? "success"
          : body.status === "FAILED" ? "error"
            : "info",
      });
    }

    // Recalculate mission progress
    await recalculateMissionProgress(task.missionId);

    return NextResponse.json({ task: updatedTask });
  } catch (error) {
    console.error("[mission-tasks] PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
