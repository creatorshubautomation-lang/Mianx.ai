// Mianx.ai — Mission Engine: Single Mission Routes
//
// GET    /api/missions/[id]          — Get mission detail
// PATCH  /api/missions/[id]          — Update mission
// DELETE /api/missions/[id]          — Delete mission
// POST   /api/missions/[id]/plan     — Generate AI plan
// POST   /api/missions/[id]/approve  — Approve plan
// POST   /api/missions/[id]/reject   — Reject plan
// POST   /api/missions/[id]/execute  — Start execution
// POST   /api/missions/[id]/pause    — Pause execution
// POST   /api/missions/[id]/cancel   — Cancel mission
// GET    /api/missions/[id]/events   — Get events
// GET    /api/missions/[id]/stats    — Get stats

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import {
  MissionStateMachine,
  recalculateMissionProgress,
  updateTaskReadiness,
  skipBlockedTasks,
  areAllTasksTerminal,
} from "@/lib/mission-engine";
import {
  generateMissionPlan,
  persistMissionPlan,
  populateDependents,
} from "@/lib/mission-planner";
import { logMissionEvent } from "@/lib/mission-engine";
import type { MissionStatus } from "@/lib/mission-types";

async function getAuthUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session.user;
}

// ─────────────────────────────────────────────
//  Route handler dispatcher
// ─────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const subAction = searchParams.get("action");

  // Sub-routes
  if (subAction === "events") return getEvents(request, id);
  if (subAction === "stats") return getStats(request, id);

  return getMissionDetail(request, id);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return updateMission(request, id);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return deleteMission(request, id);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const action = body.action || body._action;

  switch (action) {
    case "plan":
      return generatePlan(request, id);
    case "approve":
      return approvePlan(request, id, body);
    case "reject":
      return rejectPlan(request, id, body);
    case "execute":
      return executeMission(request, id);
    case "pause":
      return pauseMission(request, id);
    case "cancel":
      return cancelMission(request, id);
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}

// ─────────────────────────────────────────────
//  GET /api/missions/[id] — Mission Detail
// ─────────────────────────────────────────────

async function getMissionDetail(request: NextRequest, id: string) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const mission = await db.mission.findUnique({
      where: { id, userId: user.id },
      include: {
        tasks: {
          orderBy: { order: "asc" },
        },
        approvals: {
          where: { status: "PENDING" },
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: { events: true, tasks: true },
        },
      },
    });

    if (!mission) {
      return NextResponse.json({ error: "Mission not found" }, { status: 404 });
    }

    return NextResponse.json({ mission });
  } catch (error) {
    console.error("[missions] GET detail error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
//  PATCH /api/missions/[id] — Update Mission
// ─────────────────────────────────────────────

async function updateMission(request: NextRequest, id: string) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const mission = await db.mission.findUnique({
      where: { id, userId: user.id },
    });
    if (!mission) {
      return NextResponse.json({ error: "Mission not found" }, { status: 404 });
    }

    const body = await request.json();
    const allowedFields = ["title", "description", "priority", "budgetUsd", "deadline"];
    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === "deadline" && body[field]) {
          updates[field] = new Date(body[field]);
        } else if (field === "budgetUsd") {
          updates[field] = parseFloat(body[field]) || null;
        } else {
          updates[field] = body[field];
        }
      }
    }

    // Status transition (only DRAFT and PAUSED can be updated)
    if (body.status && mission.status !== "DRAFT" && mission.status !== "PAUSED") {
      return NextResponse.json(
        { error: `Cannot update status from ${mission.status}. Use specific action endpoints.` },
        { status: 400 },
      );
    }

    if (Object.keys(updates).length > 0 || body.status) {
      const updated = await db.mission.update({
        where: { id },
        data: body.status ? { ...updates, status: body.status } : updates,
      });
      return NextResponse.json({ mission: updated });
    }

    return NextResponse.json({ mission });
  } catch (error) {
    console.error("[missions] PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
//  DELETE /api/missions/[id] — Delete Mission
// ─────────────────────────────────────────────

async function deleteMission(request: NextRequest, id: string) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const mission = await db.mission.findUnique({
      where: { id, userId: user.id },
    });
    if (!mission) {
      return NextResponse.json({ error: "Mission not found" }, { status: 404 });
    }

    // Only allow deletion of terminal or draft missions
    const deletableStatuses: MissionStatus[] = ["DRAFT", "COMPLETED", "FAILED", "CANCELLED"];
    if (!deletableStatuses.includes(mission.status as MissionStatus)) {
      return NextResponse.json(
        { error: `Cannot delete mission in ${mission.status} status. Cancel or wait for completion first.` },
        { status: 400 },
      );
    }

    await db.mission.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[missions] DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
//  POST /api/missions/[id]/plan — Generate Plan
// ─────────────────────────────────────────────

async function generatePlan(request: NextRequest, id: string) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const mission = await db.mission.findUnique({
      where: { id, userId: user.id },
    });
    if (!mission) {
      return NextResponse.json({ error: "Mission not found" }, { status: 404 });
    }

    if (mission.status !== "DRAFT" && mission.status !== "AWAITING_APPROVAL") {
      return NextResponse.json(
        { error: `Cannot generate plan for mission in ${mission.status} status` },
        { status: 400 },
      );
    }

    // Transition to PLANNING
    const sm = new MissionStateMachine(id, mission.status as MissionStatus);
    await sm.transition("PLANNING", "User requested plan generation");

    // Generate the plan using AI
    const plan = await generateMissionPlan(
      mission.description,
      mission.projectId || undefined,
      user.id,
    );

    // Persist plan + create tasks
    await persistMissionPlan(id, plan);
    await populateDependents(id);

    // Transition to AWAITING_APPROVAL
    await sm.transition("AWAITING_APPROVAL", "Plan generated successfully");

    // Recalculate progress
    await recalculateMissionProgress(id);

    // Get updated mission
    const updated = await db.mission.findUnique({
      where: { id },
      include: { tasks: { orderBy: { order: "asc" } } },
    });

    return NextResponse.json({ mission: updated, plan });
  } catch (error) {
    console.error("[missions] plan error:", error);

    // Try to set mission to FAILED if planning fails
    try {
      const mission = await db.mission.findUnique({ where: { id } });
      if (mission && (mission.status === "PLANNING" || mission.status === "DRAFT")) {
        const sm = new MissionStateMachine(id, mission.status as MissionStatus);
        await sm.transition("FAILED", `Planning failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    } catch { /* ignore secondary error */ }

    return NextResponse.json(
      { error: "Failed to generate plan", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  POST /api/missions/[id]/approve — Approve Plan
// ─────────────────────────────────────────────

async function approvePlan(request: NextRequest, id: string, body: Record<string, unknown>) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const mission = await db.mission.findUnique({
      where: { id, userId: user.id },
    });
    if (!mission) {
      return NextResponse.json({ error: "Mission not found" }, { status: 404 });
    }

    if (mission.status !== "AWAITING_APPROVAL") {
      return NextResponse.json(
        { error: `Cannot approve mission in ${mission.status} status` },
        { status: 400 },
      );
    }

    const sm = new MissionStateMachine(id, mission.status as MissionStatus);
    await sm.transition(
      "APPROVED",
      `Plan approved by user${body.note ? `: ${body.note}` : ""}`,
      { approvedBy: user.id },
    );

    await db.mission.update({
      where: { id },
      data: {
        approvedBy: user.id,
        approvedAt: new Date(),
      },
    });

    const updated = await db.mission.findUnique({ where: { id } });
    return NextResponse.json({ mission: updated });
  } catch (error) {
    console.error("[missions] approve error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
//  POST /api/missions/[id]/reject — Reject Plan
// ─────────────────────────────────────────────

async function rejectPlan(request: NextRequest, id: string, body: Record<string, unknown>) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const mission = await db.mission.findUnique({
      where: { id, userId: user.id },
    });
    if (!mission) {
      return NextResponse.json({ error: "Mission not found" }, { status: 404 });
    }

    if (mission.status !== "AWAITING_APPROVAL") {
      return NextResponse.json(
        { error: `Cannot reject plan for mission in ${mission.status} status` },
        { status: 400 },
      );
    }

    const sm = new MissionStateMachine(id, mission.status as MissionStatus);
    await sm.transition(
      "PLANNING",
      `Plan rejected by user, re-planning${body.reason ? `: ${body.reason}` : ""}`,
    );

    // Delete old tasks so new plan can be generated
    await db.missionTask.deleteMany({ where: { missionId: id } });

    await db.mission.update({
      where: { id },
      data: {
        planJson: null,
        planSummary: null,
        planReasoning: null,
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        progress: 0,
      },
    });

    const updated = await db.mission.findUnique({ where: { id } });
    return NextResponse.json({ mission: updated, message: "Plan rejected. You can generate a new plan." });
  } catch (error) {
    console.error("[missions] reject error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
//  POST /api/missions/[id]/execute — Start Execution
// ─────────────────────────────────────────────

async function executeMission(request: NextRequest, id: string) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const mission = await db.mission.findUnique({
      where: { id, userId: user.id },
      include: { tasks: true },
    });
    if (!mission) {
      return NextResponse.json({ error: "Mission not found" }, { status: 404 });
    }

    if (mission.status !== "APPROVED" && mission.status !== "PAUSED") {
      return NextResponse.json(
        { error: `Cannot execute mission in ${mission.status} status` },
        { status: 400 },
      );
    }

    // Transition to EXECUTING
    const sm = new MissionStateMachine(id, mission.status as MissionStatus);
    await sm.transition("EXECUTING", "User started mission execution");

    // Update task readiness
    await updateTaskReadiness(id);
    await skipBlockedTasks(id);

    const updated = await db.mission.findUnique({
      where: { id },
      include: { tasks: { orderBy: { order: "asc" } } },
    });

    return NextResponse.json({ mission: updated });
  } catch (error) {
    console.error("[missions] execute error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
//  POST /api/missions/[id]/pause — Pause
// ─────────────────────────────────────────────

async function pauseMission(request: NextRequest, id: string) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const mission = await db.mission.findUnique({
      where: { id, userId: user.id },
    });
    if (!mission) {
      return NextResponse.json({ error: "Mission not found" }, { status: 404 });
    }

    if (mission.status !== "EXECUTING") {
      return NextResponse.json(
        { error: `Cannot pause mission in ${mission.status} status` },
        { status: 400 },
      );
    }

    const sm = new MissionStateMachine(id, mission.status as MissionStatus);
    await sm.transition("PAUSED", "User paused mission execution");

    // Mark running tasks back to READY
    await db.missionTask.updateMany({
      where: { missionId: id, status: "RUNNING" },
      data: { status: "READY" },
    });

    const updated = await db.mission.findUnique({ where: { id } });
    return NextResponse.json({ mission: updated });
  } catch (error) {
    console.error("[missions] pause error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
//  POST /api/missions/[id]/cancel — Cancel
// ─────────────────────────────────────────────

async function cancelMission(request: NextRequest, id: string) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const mission = await db.mission.findUnique({
      where: { id, userId: user.id },
    });
    if (!mission) {
      return NextResponse.json({ error: "Mission not found" }, { status: 404 });
    }

    if (mission.status === "COMPLETED" || mission.status === "FAILED" || mission.status === "CANCELLED") {
      return NextResponse.json(
        { error: `Cannot cancel mission in ${mission.status} status` },
        { status: 400 },
      );
    }

    const sm = new MissionStateMachine(id, mission.status as MissionStatus);
    await sm.transition("CANCELLED", "User cancelled the mission");

    // Cancel pending/ready tasks
    await db.missionTask.updateMany({
      where: {
        missionId: id,
        status: { in: ["PENDING", "READY"] },
      },
      data: { status: "CANCELLED" },
    });

    const updated = await db.mission.findUnique({ where: { id } });
    return NextResponse.json({ mission: updated });
  } catch (error) {
    console.error("[missions] cancel error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
//  GET /api/missions/[id]?action=events
// ─────────────────────────────────────────────

async function getEvents(request: NextRequest, id: string) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const mission = await db.mission.findUnique({
      where: { id, userId: user.id },
    });
    if (!mission) {
      return NextResponse.json({ error: "Mission not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const eventType = searchParams.get("eventType");

    const where: Record<string, unknown> = { missionId: id };
    if (eventType) where.eventType = eventType;

    const events = await db.missionEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error("[missions] events error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
//  GET /api/missions/[id]?action=stats
// ─────────────────────────────────────────────

async function getStats(request: NextRequest, id: string) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const mission = await db.mission.findUnique({
      where: { id, userId: user.id },
      include: {
        tasks: {
          select: { status: true, riskLevel: true, assignedAgent: true },
        },
      },
    });
    if (!mission) {
      return NextResponse.json({ error: "Mission not found" }, { status: 404 });
    }

    const tasks = mission.tasks;
    const statusCounts: Record<string, number> = {};
    const agentCounts: Record<string, number> = {};
    const riskCounts: Record<string, number> = {};

    for (const task of tasks) {
      statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
      if (task.assignedAgent) {
        agentCounts[task.assignedAgent] = (agentCounts[task.assignedAgent] || 0) + 1;
      }
      riskCounts[task.riskLevel] = (riskCounts[task.riskLevel] || 0) + 1;
    }

    return NextResponse.json({
      missionId: id,
      totalTasks: tasks.length,
      statusCounts,
      agentCounts,
      riskCounts,
      progress: mission.progress,
      budgetUsed: mission.spentUsd,
      budgetLimit: mission.budgetUsd,
      duration: mission.startedAt
        ? Date.now() - new Date(mission.startedAt).getTime()
        : null,
    });
  } catch (error) {
    console.error("[missions] stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
