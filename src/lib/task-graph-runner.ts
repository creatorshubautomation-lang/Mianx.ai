// Mianx.ai — Mission Engine: Task Graph Runner
//
// The Task Graph Runner is the core execution engine that:
//   1. Resolves task dependencies into execution waves
//   2. Runs independent tasks in parallel (up to concurrency limit)
//   3. Waits for dependencies before starting dependent tasks
//   4. Reports progress via events and SSE streaming
//   5. Handles budget checks between waves
//   6. Triggers verification after each task completes

import { db } from "@/lib/db";
import { executeTask, type TaskExecutionResult } from "./task-executor";
import {
  recalculateMissionProgress,
  trackMissionBudget,
  logMissionEvent,
  updateTaskReadiness,
  skipBlockedTasks,
  areAllTasksTerminal,
} from "./mission-engine";
import {
  MissionStateMachine,
} from "./mission-engine";
import { verifyTaskOutput, type VerificationResult } from "./verification-engine";
import { repairTask, type RepairResult } from "./repair-loop";
import type { MissionStatus, MissionEventType } from "./mission-types";

// ─────────────────────────────────────────────
//  Configuration
// ─────────────────────────────────────────────

const MAX_CONCURRENT_TASKS = 3; // Max tasks running in parallel
const MAX_WAVES = 20; // Safety limit to prevent infinite loops
const DELAY_BETWEEN_WAVES_MS = 500; // Brief delay between execution waves

// ─────────────────────────────────────────────
//  Task Graph Runner
// ─────────────────────────────────────────────

/**
 * Run the full task graph for a mission.
 * Resolves dependencies, executes tasks in waves,
 * handles verification and repair.
 *
 * Returns when all tasks are in terminal state.
 */
export async function runTaskGraph(missionId: string): Promise<void> {
  console.log(`[task-graph] Starting execution for mission ${missionId}`);

  // Load mission
  const mission = await db.mission.findUnique({
    where: { id: missionId },
    select: { status: true, userId: true, budgetUsd: true },
  });

  if (!mission) throw new Error(`Mission ${missionId} not found`);
  if (mission.status !== "EXECUTING") {
    throw new Error(`Mission is not in EXECUTING status (current: ${mission.status})`);
  }

  // Output map: taskId → output (for dependency resolution)
  const outputMap = new Map<string, { title: string; output: string; agentName: string }>();

  let waveCount = 0;

  try {
    // Main execution loop
    while (waveCount < MAX_WAVES) {
      // Check if mission is still executing (could be paused/cancelled)
      const currentMission = await db.mission.findUnique({
        where: { id: missionId },
        select: { status: true },
      });

      if (!currentMission || currentMission.status !== "EXECUTING") {
        console.log(`[task-graph] Mission status changed to ${currentMission?.status}, stopping`);
        return;
      }

      // Update task readiness based on completed dependencies
      await updateTaskReadiness(missionId);
      await skipBlockedTasks(missionId);

      // Get tasks ready to run
      const readyTasks = await db.missionTask.findMany({
        where: {
          missionId,
          status: "READY",
        },
        orderBy: { priority: "desc" },
        take: MAX_CONCURRENT_TASKS,
      });

      if (readyTasks.length === 0) {
        // Check if all tasks are terminal
        if (await areAllTasksTerminal(missionId)) {
          console.log("[task-graph] All tasks in terminal state, finishing");
          break;
        }
        // No ready tasks but some still active — wait a bit
        await sleep(DELAY_BETWEEN_WAVES_MS);
        waveCount++;
        continue;
      }

      console.log(`[task-graph] Wave ${waveCount + 1}: Executing ${readyTasks.length} tasks`);

      // Execute tasks in parallel (limited by MAX_CONCURRENT_TASKS)
      const executionPromises = readyTasks.map(async (task) => {
        // Check for human approval requirement
        if (task.approvalStatus === "PENDING") {
          await logMissionEvent(missionId, {
            eventType: "HUMAN_APPROVAL_REQUESTED",
            title: `Approval needed: ${task.title}`,
            description: `Task requires human approval before execution (risk: ${task.riskLevel})`,
            taskId: task.id,
            level: "warn",
            metadata: { riskLevel: task.riskLevel },
          });

          // Create approval record
          await db.humanApproval.create({
            data: {
              missionId,
              taskId: task.id,
              userId: mission.userId,
              status: "PENDING",
              title: `Execute: ${task.title}`,
              description: `This task (${task.riskLevel} risk) needs your approval before the agent can execute it.`,
              riskLevel: task.riskLevel as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
            },
          });

          // Skip execution, wait for approval
          return null;
        }

        return executeTask({
          missionId,
          taskId: task.id,
          userId: mission.userId,
          priorOutputs: outputMap,
        });
      });

      const results = await Promise.allSettled(executionPromises);

      // Process results
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const task = readyTasks[i];

        if (result.status === "fulfilled" && result.value) {
          const execResult = result.value as TaskExecutionResult;

          if (execResult.success) {
            // Store output for dependent tasks
            outputMap.set(execResult.taskId, {
              title: task.title,
              output: execResult.output,
              agentName: execResult.agentName,
            });

            // Run verification
            await handleVerification(missionId, task.id, execResult);
          } else {
            // Task failed — try repair
            await handleTaskFailure(missionId, task.id, execResult);
          }
        } else if (result.status === "rejected") {
          const error = result.reason;
          console.error(`[task-graph] Task ${task.id} execution error:`, error);

          await db.missionTask.update({
            where: { id: task.id },
            data: {
              status: "FAILED",
              completedAt: new Date(),
            },
          });

          await logMissionEvent(missionId, {
            eventType: "TASK_FAILED",
            title: `Failed: ${task.title}`,
            description: `Execution error: ${error instanceof Error ? error.message : String(error)}`,
            taskId: task.id,
            level: "error",
          });
        }
      }

      // Recalculate mission progress
      await recalculateMissionProgress(missionId);

      // Check budget
      const updatedMission = await db.mission.findUnique({
        where: { id: missionId },
        select: { spentUsd: true, budgetUsd: true },
      });

      if (updatedMission?.budgetUsd && updatedMission.spentUsd >= updatedMission.budgetUsd) {
        console.log("[task-graph] Budget exceeded, pausing mission");
        const sm = new MissionStateMachine(missionId, "EXECUTING" as MissionStatus);
        await sm.transition("PAUSED", "Budget limit reached");
        return;
      }

      waveCount++;
      await sleep(DELAY_BETWEEN_WAVES_MS);
    }

    // Final status check — all tasks done?
    const finalProgress = await recalculateMissionProgress(missionId);
    const finalMission = await db.mission.findUnique({
      where: { id: missionId },
      select: { status: true, failedTasks: true, totalTasks: true },
    });

    if (finalMission?.status === "EXECUTING") {
      if (finalProgress.failedTasks === 0) {
        // All tasks completed successfully
        const sm = new MissionStateMachine(missionId, "EXECUTING" as MissionStatus);
        await sm.transition("COMPLETED", `All ${finalProgress.totalTasks} tasks completed and verified`);

        await logMissionEvent(missionId, {
          eventType: "MISSION_COMPLETED",
          title: "Mission Completed Successfully",
          description: `All tasks completed, verified, and budget within limits. Total spent: $${finalProgress.totalTasks > 0 ? '' : '0.00'}`,
          level: "success",
        });
      } else if (finalProgress.completedTasks > 0) {
        // Some tasks failed but others succeeded
        const sm = new MissionStateMachine(missionId, "EXECUTING" as MissionStatus);
        await sm.transition("FAILED", `${finalProgress.failedTasks} task(s) failed out of ${finalProgress.totalTasks}`);
      }
    }
  } catch (error) {
    console.error("[task-graph] Fatal error:", error);

    try {
      const sm = new MissionStateMachine(missionId, "EXECUTING" as MissionStatus);
      await sm.transition("FAILED", `Fatal execution error: ${error instanceof Error ? error.message : "Unknown"}`);
    } catch {
      // last-resort update
      await db.mission.update({
        where: { id: missionId },
        data: { status: "FAILED" },
      });
    }
  }
}

// ─────────────────────────────────────────────
//  Post-Task Handlers
// ─────────────────────────────────────────────

async function handleVerification(
  missionId: string,
  taskId: string,
  execResult: TaskExecutionResult,
): Promise<void> {
  const task = await db.missionTask.findUnique({
    where: { id: taskId },
    select: { title: true, riskLevel: true, retryCount: true, maxRetries: true },
  });

  if (!task) return;

  // Run verification
  const verification = await verifyTaskOutput({
    missionId,
    taskId,
    output: execResult.output,
    outputType: execResult.outputType,
    taskTitle: task.title,
    riskLevel: task.riskLevel as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  });

  // Update verification status
  await db.missionTask.update({
    where: { id: taskId },
    data: {
      verificationStatus: verification.passed ? "passed" : "failed",
      verificationResult: JSON.stringify(verification),
    },
  });

  if (verification.passed) {
    await logMissionEvent(missionId, {
      eventType: "VERIFICATION_PASSED",
      title: `Verified: ${task.title}`,
      description: verification.reasoning,
      taskId,
      level: "success",
    });
  } else {
    await logMissionEvent(missionId, {
      eventType: "VERIFICATION_FAILED",
      title: `Verification failed: ${task.title}`,
      description: verification.reasoning,
      taskId,
      level: "warn",
      metadata: { issues: verification.issues },
    });

    // Verification failed — try repair
    await handleVerificationFailure(missionId, taskId, verification, task.retryCount, task.maxRetries);
  }
}

async function handleVerificationFailure(
  missionId: string,
  taskId: string,
  verification: VerificationResult,
  retryCount: number,
  maxRetries: number,
): Promise<void> {
  if (retryCount >= maxRetries) {
    console.log(`[task-graph] Task ${taskId} max retries (${maxRetries}) exceeded`);

    await db.missionTask.update({
      where: { id: taskId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
      },
    });

    await logMissionEvent(missionId, {
      eventType: "TASK_FAILED",
      title: `Max retries exceeded`,
      description: `Task verification failed after ${maxRetries} attempts`,
      taskId,
      level: "error",
    });
    return;
  }

  // Attempt repair
  const mission = await db.mission.findUnique({
    where: { id: missionId },
    select: { status: true, userId: true },
  });

  if (!mission || mission.status !== "EXECUTING") return;

  const sm = new MissionStateMachine(missionId, mission.status as MissionStatus);

  // Transition to REPAIRING
  await sm.transition("REPAIRING", `Repairing task after verification failure (attempt ${retryCount + 1}/${maxRetries})`);

  const repairResult = await repairTask({
    missionId,
    taskId,
    userId: mission.userId,
    verificationIssues: verification.issues,
    previousOutput: verification.previousOutput || "",
  });

  // Transition back to EXECUTING
  try {
    const currentMission = await db.mission.findUnique({
      where: { id: missionId },
      select: { status: true },
    });
    if (currentMission?.status === "REPAIRING") {
      const sm2 = new MissionStateMachine(missionId, "REPAIRING" as MissionStatus);
      await sm2.transition("EXECUTING", "Repair completed, resuming execution");
    }
  } catch {
    // ignore transition errors
  }

  await logMissionEvent(missionId, {
    eventType: "REPAIR_COMPLETED",
    title: `Repair ${repairResult.success ? "succeeded" : "failed"}`,
    description: repairResult.success
      ? `Task repaired and re-submitted for execution`
      : `Repair attempt failed: ${repairResult.error}`,
    taskId,
    level: repairResult.success ? "success" : "warn",
  });
}

async function handleTaskFailure(
  missionId: string,
  taskId: string,
  execResult: TaskExecutionResult,
): Promise<void> {
  const task = await db.missionTask.findUnique({
    where: { id: taskId },
    select: { retryCount: true, maxRetries: true, title: true },
  });

  if (!task) return;

  // Check if we should retry
  if (task.retryCount < task.maxRetries) {
    // Reset to READY for retry
    await db.missionTask.update({
      where: { id: taskId },
      data: {
        status: "READY",
        retryCount: task.retryCount + 1,
      },
    });

    await logMissionEvent(missionId, {
      eventType: "TASK_RETRIED",
      title: `Retrying: ${task.title}`,
      description: `Attempt ${task.retryCount + 2}/${task.maxRetries + 1}. Error: ${execResult.error}`,
      taskId,
      level: "warn",
    });
  }
  // If max retries exceeded, task stays FAILED (set in executeTask)
}

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a single step (one wave of tasks).
 * Used for SSE-based incremental execution.
 */
export async function executeSingleStep(
  missionId: string,
): Promise<{ executed: number; remaining: number; completed: boolean }> {
  const mission = await db.mission.findUnique({
    where: { id: missionId },
    select: { status: true, userId: true },
  });

  if (!mission || mission.status !== "EXECUTING") {
    return { executed: 0, remaining: 0, completed: true };
  }

  const outputMap = new Map<string, { title: string; output: string; agentName: string }>();

  // Load completed task outputs
  const completedTasks = await db.missionTask.findMany({
    where: { missionId, status: "COMPLETED", output: { not: null } },
    select: { id: true, title: true, output: true, assignedAgent: true },
  });
  for (const t of completedTasks) {
    if (t.output) {
      outputMap.set(t.id, { title: t.title, output: t.output, agentName: t.assignedAgent || "Unknown" });
    }
  }

  // Update readiness
  await updateTaskReadiness(missionId);
  await skipBlockedTasks(missionId);

  // Get ready tasks
  const readyTasks = await db.missionTask.findMany({
    where: { missionId, status: "READY" },
    orderBy: { priority: "desc" },
    take: MAX_CONCURRENT_TASKS,
  });

  if (readyTasks.length === 0) {
    const isComplete = await areAllTasksTerminal(missionId);
    return { executed: 0, remaining: 0, completed: isComplete };
  }

  // Execute
  const promises = readyTasks.map(async (task) => {
    if (task.approvalStatus === "PENDING") return null;
    return executeTask({
      missionId,
      taskId: task.id,
      userId: mission.userId,
      priorOutputs: outputMap,
    });
  });

  const results = await Promise.allSettled(promises);
  let executed = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled" && result.value) {
      const execResult = result.value as TaskExecutionResult;
      if (execResult.success) {
        outputMap.set(execResult.taskId, {
          title: readyTasks[i].title,
          output: execResult.output,
          agentName: execResult.agentName,
        });
        await handleVerification(missionId, readyTasks[i].id, execResult);
        executed++;
      } else {
        await handleTaskFailure(missionId, readyTasks[i].id, execResult);
      }
    }
  }

  await recalculateMissionProgress(missionId);

  const activeTasks = await db.missionTask.count({
    where: { missionId, status: { in: ["PENDING", "READY", "RUNNING"] } },
  });

  const isComplete = activeTasks === 0;
  return { executed, remaining: activeTasks, completed: isComplete };
}
