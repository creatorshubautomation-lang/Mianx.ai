// Mianx.ai — Mission Engine: Status Machine
//
// State machine for Mission lifecycle management.
// Enforces valid transitions and auto-calculates
// derived state (progress, task counts, budget alerts).

import { db } from "@/lib/db";
import {
  type MissionStatus,
  type MissionEventType,
  isValidTransition,
} from "./mission-types";

// ─────────────────────────────────────────────
//  Transition Engine
// ─────────────────────────────────────────────

export class MissionStateMachine {
  constructor(
    private missionId: string,
    private currentStatus: MissionStatus,
  ) {}

  /**
   * Attempt to transition the mission to a new status.
   * Throws if the transition is invalid.
   * Logs the transition as a MissionEvent.
   */
  async transition(
    newStatus: MissionStatus,
    reason?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    if (!isValidTransition(this.currentStatus, newStatus)) {
      throw new Error(
        `Invalid mission transition: ${this.currentStatus} → ${newStatus}`,
      );
    }

    const oldStatus = this.currentStatus;

    await db.mission.update({
      where: { id: this.missionId },
      data: {
        status: newStatus,
        // Auto-set timing fields
        ...(newStatus === "EXECUTING" && { startedAt: new Date() }),
        ...(newStatus === "COMPLETED" && { completedAt: new Date() }),
        ...(newStatus === "FAILED" && { completedAt: new Date() }),
        ...(newStatus === "CANCELLED" && { completedAt: new Date() }),
      },
    });

    // Log the event
    const eventType = this.statusToEventType(newStatus);
    await logMissionEvent(this.missionId, {
      eventType,
      title: `Mission ${newStatus}`,
      description: reason || `Status changed from ${oldStatus} to ${newStatus}`,
      metadata: metadata || { from: oldStatus, to: newStatus },
      level: this.eventLevel(newStatus),
    });

    this.currentStatus = newStatus;
  }

  private statusToEventType(status: MissionStatus): MissionEventType {
    const map: Partial<Record<MissionStatus, MissionEventType>> = {
      PLANNING: "STATUS_CHANGED",
      AWAITING_APPROVAL: "PLAN_GENERATED",
      APPROVED: "PLAN_APPROVED",
      EXECUTING: "STATUS_CHANGED",
      PAUSED: "STATUS_CHANGED",
      VERIFYING: "STATUS_CHANGED",
      REPAIRING: "REPAIR_STARTED",
      COMPLETED: "MISSION_COMPLETED",
      FAILED: "MISSION_FAILED",
      CANCELLED: "MISSION_CANCELLED",
    };
    return map[status] || "STATUS_CHANGED";
  }

  private eventLevel(status: MissionStatus): string {
    if (status === "COMPLETED") return "success";
    if (status === "FAILED") return "error";
    if (status === "REPAIRING") return "warn";
    if (status === "CANCELLED") return "info";
    return "info";
  }
}

// ─────────────────────────────────────────────
//  Progress Calculator
// ─────────────────────────────────────────────

/**
 * Recalculate mission progress based on task statuses.
 * Also updates completedTasks/failedTasks counts.
 */
export async function recalculateMissionProgress(
  missionId: string,
): Promise<{ progress: number; completedTasks: number; failedTasks: number; totalTasks: number }> {
  const tasks = await db.missionTask.findMany({
    where: { missionId },
    select: { status: true },
  });

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
  const failedTasks = tasks.filter((t) => t.status === "FAILED").length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  await db.mission.update({
    where: { id: missionId },
    data: { progress, completedTasks, failedTasks, totalTasks },
  });

  return { progress, completedTasks, failedTasks, totalTasks };
}

// ─────────────────────────────────────────────
//  Budget Tracker
// ─────────────────────────────────────────────

/**
 * Check and update mission budget. Returns warning/exceeded flags.
 */
export async function trackMissionBudget(
  missionId: string,
  additionalCostUsd: number,
): Promise<{ warning: boolean; exceeded: boolean; remainingUsd: number | null }> {
  const mission = await db.mission.findUnique({
    where: { id: missionId },
    select: { budgetUsd: true, spentUsd: true },
  });

  if (!mission) throw new Error(`Mission ${missionId} not found`);

  const newSpent = mission.spentUsd + additionalCostUsd;

  await db.mission.update({
    where: { id: missionId },
    data: { spentUsd: newSpent },
  });

  const warning = mission.budgetUsd
    ? newSpent >= mission.budgetUsd * 0.8
    : false;
  const exceeded = mission.budgetUsd
    ? newSpent >= mission.budgetUsd
    : false;
  const remainingUsd = mission.budgetUsd
    ? mission.budgetUsd - newSpent
    : null;

  if (warning && !exceeded) {
    await logMissionEvent(missionId, {
      eventType: "BUDGET_WARNING",
      title: "Budget Warning",
      description: `Mission has used 80%+ of budget ($${newSpent.toFixed(2)} of $${mission.budgetUsd?.toFixed(2)})`,
      level: "warn",
      metadata: { spentUsd: newSpent, budgetUsd: mission.budgetUsd },
    });
  }

  if (exceeded) {
    await logMissionEvent(missionId, {
      eventType: "BUDGET_EXCEEDED",
      title: "Budget Exceeded",
      description: `Mission has exceeded its budget ($${newSpent.toFixed(2)} of $${mission.budgetUsd?.toFixed(2)})`,
      level: "error",
      metadata: { spentUsd: newSpent, budgetUsd: mission.budgetUsd },
    });
  }

  return { warning, exceeded, remainingUsd };
}

// ─────────────────────────────────────────────
//  Mission Event Logger
// ─────────────────────────────────────────────

interface MissionEventInput {
  eventType: MissionEventType;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  level?: string;
  taskId?: string;
}

/**
 * Log a mission event to the audit trail.
 */
export async function logMissionEvent(
  missionId: string,
  input: MissionEventInput,
): Promise<void> {
  try {
    await db.missionEvent.create({
      data: {
        missionId,
        taskId: input.taskId || null,
        eventType: input.eventType,
        title: input.title,
        description: input.description || null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        level: input.level || "info",
      },
    });
  } catch (error) {
    // Event logging should never fail the main flow
    console.error("[mission] Failed to log event:", error);
  }
}

// ─────────────────────────────────────────────
//  Dependency Graph Utilities
// ─────────────────────────────────────────────

/**
 * Get all task IDs that are ready to execute
 * (all their dependencies are COMPLETED).
 */
export async function getReadyTaskIds(missionId: string): Promise<string[]> {
  const tasks = await db.missionTask.findMany({
    where: { missionId },
    select: { id: true, status: true, dependencies: true },
  });

  const completedIds = new Set(
    tasks.filter((t) => t.status === "COMPLETED").map((t) => t.id),
  );

  return tasks
    .filter((task) => {
      if (task.status !== "PENDING") return false;
      const deps: string[] = JSON.parse(task.dependencies);
      return deps.length === 0 || deps.every((depId) => completedIds.has(depId));
    })
    .map((t) => t.id);
}

/**
 * Mark tasks as READY when their dependencies are all met.
 */
export async function updateTaskReadiness(missionId: string): Promise<number> {
  const readyIds = await getReadyTaskIds(missionId);

  if (readyIds.length > 0) {
    await db.missionTask.updateMany({
      where: {
        id: { in: readyIds },
        status: "PENDING",
      },
      data: { status: "READY" },
    });
  }

  return readyIds.length;
}

/**
 * Skip all tasks whose dependencies include a FAILED or CANCELLED task.
 */
export async function skipBlockedTasks(missionId: string): Promise<number> {
  const tasks = await db.missionTask.findMany({
    where: { missionId },
    select: { id: true, status: true, dependencies: true },
  });

  const failedOrCancelledIds = new Set(
    tasks
      .filter((t) => t.status === "FAILED" || t.status === "CANCELLED")
      .map((t) => t.id),
  );

  const toSkip = tasks.filter((task) => {
    if (task.status !== "PENDING" && task.status !== "READY") return false;
    const deps: string[] = JSON.parse(task.dependencies);
    return deps.some((depId) => failedOrCancelledIds.has(depId));
  });

  if (toSkip.length > 0) {
    await db.missionTask.updateMany({
      where: { id: { in: toSkip.map((t) => t.id) } },
      data: { status: "SKIPPED" },
    });
  }

  return toSkip.length;
}

/**
 * Check if all tasks in a mission are in a terminal state.
 */
export async function areAllTasksTerminal(missionId: string): Promise<boolean> {
  const activeTasks = await db.missionTask.count({
    where: {
      missionId,
      status: { in: ["PENDING", "READY", "RUNNING"] },
    },
  });
  return activeTasks === 0;
}

/**
 * Get mission statistics for dashboard display.
 */
export async function getMissionStats(userId: string) {
  const [total, byStatus] = await Promise.all([
    db.mission.count({ where: { userId } }),
    db.mission.groupBy({
      by: ["status"],
      where: { userId },
      _count: true,
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const row of byStatus) {
    statusCounts[row.status] = row._count;
  }

  const totalSpent = await db.mission.aggregate({
    where: { userId },
    _sum: { spentUsd: true },
  });

  return {
    total,
    statusCounts,
    totalSpent: totalSpent._sum.spentUsd || 0,
    activeMissions:
      (statusCounts["EXECUTING"] || 0) +
      (statusCounts["PLANNING"] || 0) +
      (statusCounts["VERIFYING"] || 0) +
      (statusCounts["REPAIRING"] || 0),
    completedMissions: statusCounts["COMPLETED"] || 0,
    failedMissions: statusCounts["FAILED"] || 0,
  };
}
