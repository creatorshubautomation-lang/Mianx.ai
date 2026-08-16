// Mianx.ai — Mission Execution: Run Endpoint
//
// POST /api/missions/[id]/run — Execute the mission (full or single-step)
//
// This endpoint triggers mission execution. It can run:
//   1. Full auto-execution (run entire task graph)
//   2. Single-step execution (execute one wave of ready tasks)
//
// For full execution, the response returns immediately and execution
// continues in the background. Use the /stream endpoint for live updates.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { MissionStateMachine } from "@/lib/mission-engine";
import {
  updateTaskReadiness,
  skipBlockedTasks,
  recalculateMissionProgress,
  logMissionEvent,
} from "@/lib/mission-engine";
import { runTaskGraph, executeSingleStep } from "@/lib/task-graph-runner";
import type { MissionStatus } from "@/lib/mission-types";

async function getAuthUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session.user;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const mode = body.mode || "full"; // "full" | "step"

  // Load mission
  const mission = await db.mission.findUnique({
    where: { id, userId: user.id },
  });

  if (!mission) {
    return NextResponse.json({ error: "Mission not found" }, { status: 404 });
  }

  // Validate status
  if (mission.status !== "APPROVED" && mission.status !== "EXECUTING" && mission.status !== "PAUSED") {
    return NextResponse.json(
      { error: `Cannot execute mission in ${mission.status} status. Must be APPROVED, EXECUTING, or PAUSED.` },
      { status: 400 },
    );
  }

  try {
    if (mode === "step") {
      // Single-step execution
      return await handleSingleStep(id, mission.status as MissionStatus);
    }

    // Full execution — starts in background
    return await handleFullExecution(id, mission.status as MissionStatus);
  } catch (error) {
    console.error("[mission-run] Execution error:", error);
    return NextResponse.json(
      { error: "Execution failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

async function handleSingleStep(
  missionId: string,
  currentStatus: MissionStatus,
): Promise<NextResponse> {
  // Ensure we're in EXECUTING status
  if (currentStatus === "APPROVED" || currentStatus === "PAUSED") {
    const sm = new MissionStateMachine(missionId, currentStatus);
    await sm.transition("EXECUTING", "Starting single-step execution");
  }

  // Update task readiness
  await updateTaskReadiness(missionId);
  await skipBlockedTasks(missionId);

  // Execute one step
  const result = await executeSingleStep(missionId);

  // Recalculate progress
  await recalculateMissionProgress(missionId);

  // Get updated mission
  const updated = await db.mission.findUnique({
    where: { id: missionId },
    include: { tasks: { orderBy: { order: "asc" } } },
  });

  // If completed, transition to terminal state
  if (result.completed && updated?.status === "EXECUTING") {
    const progress = await recalculateMissionProgress(missionId);
    if (progress.failedTasks === 0 && progress.completedTasks > 0) {
      const sm = new MissionStateMachine(missionId, "EXECUTING");
      await sm.transition("COMPLETED", "All tasks completed via single-step execution");
    } else if (progress.failedTasks > 0 && progress.completedTasks + progress.failedTasks >= progress.totalTasks) {
      const sm = new MissionStateMachine(missionId, "EXECUTING");
      await sm.transition("FAILED", `${progress.failedTasks} task(s) failed`);
    }
  }

  return NextResponse.json({
    step: result,
    mission: updated,
  });
}

async function handleFullExecution(
  missionId: string,
  currentStatus: MissionStatus,
): Promise<NextResponse> {
  // Transition to EXECUTING if not already
  if (currentStatus !== "EXECUTING") {
    const sm = new MissionStateMachine(missionId, currentStatus);
    await sm.transition("EXECUTING", "Full mission execution started");
  }

  // Update task readiness
  await updateTaskReadiness(missionId);
  await skipBlockedTasks(missionId);

  // Start execution in background (fire and forget)
  // The client should use the /stream endpoint for live updates
  runTaskGraph(missionId).catch(async (error) => {
    console.error("[mission-run] Background execution error:", error);
    try {
      await logMissionEvent(missionId, {
        eventType: "ERROR",
        title: "Execution Error",
        description: `Background execution crashed: ${error instanceof Error ? error.message : "Unknown"}`,
        level: "error",
      });
    } catch {
      // ignore
    }
  });

  return NextResponse.json({
    message: "Mission execution started",
    missionId,
    streamUrl: `/api/missions/${missionId}/stream`,
  });
}
