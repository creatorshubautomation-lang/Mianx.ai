// Mianx.ai — Mission Engine: Repair Loop
//
// The Repair Loop automatically fixes tasks that fail verification.
// Strategy:
//   1. Analyze the verification failures
//   2. Feed the failures + original output back to the agent
//   3. Agent produces a corrected output
//   4. Re-verify the corrected output
//   5. If still failing after max retries → mark as FAILED
//
// The repair loop is the key differentiator between a simple agent
// system and a true Agentic AI platform.

import { callAIWithFallback } from "@/lib/ai-service";
import { db } from "@/lib/db";
import { logMissionEvent } from "./mission-engine";

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

export interface RepairRequest {
  missionId: string;
  taskId: string;
  userId: string;
  verificationIssues: string[];
  previousOutput: string;
}

export interface RepairResult {
  success: boolean;
  repairedOutput: string;
  attemptsUsed: number;
  error?: string;
}

// ─────────────────────────────────────────────
//  Repair Loop
// ─────────────────────────────────────────────

/**
 * Attempt to repair a failed task by feeding verification
 * failures back to the AI agent for correction.
 */
export async function repairTask(
  request: RepairRequest,
): Promise<RepairResult> {
  const startTime = Date.now();

  // Load task details
  const task = await db.missionTask.findUnique({
    where: { id: request.taskId },
  });

  if (!task) {
    return {
      success: false,
      repairedOutput: "",
      attemptsUsed: 0,
      error: `Task ${request.taskId} not found`,
    };
  }

  const agentName = task.assignedAgent || "Zen";

  await logMissionEvent(request.missionId, {
    eventType: "REPAIR_STARTED",
    title: `Repairing: ${task.title}`,
    description: `Fixing ${request.verificationIssues.length} issue(s): ${request.verificationIssues.slice(0, 3).join("; ")}`,
    taskId: request.taskId,
    level: "warn",
    metadata: {
      issues: request.verificationIssues,
      attemptNumber: task.retryCount + 1,
    },
  });

  try {
    // Build repair prompt
    const repairPrompt = buildRepairPrompt(
      task.title,
      task.description || "",
      request.previousOutput,
      request.verificationIssues,
    );

    // Call agent with repair context
    const repairedOutput = await callAIWithFallback({
      messages: [
        {
          role: "system",
          content: `You are ${agentName}, a specialist agent on the Mianx.ai Agentic AI Platform.

IMPORTANT: Your previous output for this task FAILED VERIFICATION. You must fix the issues listed below and produce a CORRECTED output.

Rules:
1. Address EVERY issue listed in the verification failures
2. Keep everything that was correct in your previous output
3. Only modify what needs to be fixed
4. Produce a COMPLETE corrected output (not just patches)
5. Ensure the corrected output would pass all verification checks`,
        },
        { role: "user", content: repairPrompt },
      ],
      agentName: `${agentName}-Repair`,
      projectId: request.missionId,
      userId: request.userId,
      endpoint: "chat",
      temperature: 0.3, // Lower temperature for more focused corrections
      maxTokens: 2500,
    });

    const durationMs = Date.now() - startTime;

    // Update task with repaired output (reset to READY for re-verification)
    await db.missionTask.update({
      where: { id: request.taskId },
      data: {
        status: "READY", // Will be picked up by next execution wave
        output: repairedOutput,
        durationMs: (task.durationMs || 0) + durationMs,
        retryCount: task.retryCount + 1,
        // Keep verification status as "failed" until re-verified
      },
    });

    return {
      success: true,
      repairedOutput,
      attemptsUsed: task.retryCount + 1,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;

    await logMissionEvent(request.missionId, {
      eventType: "ERROR",
      title: `Repair failed: ${task.title}`,
      description: `Repair attempt threw an error: ${error instanceof Error ? error.message : "Unknown"}`,
      taskId: request.taskId,
      level: "error",
      metadata: { durationMs },
    });

    return {
      success: false,
      repairedOutput: "",
      attemptsUsed: task.retryCount + 1,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ─────────────────────────────────────────────
//  Repair Prompt Builder
// ─────────────────────────────────────────────

function buildRepairPrompt(
  taskTitle: string,
  taskDescription: string,
  previousOutput: string,
  verificationIssues: string[],
): string {
  return `REPAIR REQUEST for task: "${taskTitle}"

TASK DESCRIPTION:
${taskDescription}

YOUR PREVIOUS OUTPUT (which FAILED verification):
---
${previousOutput.slice(0, 3000)}
${previousOutput.length > 3000 ? "\n[... truncated ...]" : ""}
---

VERIFICATION FAILURES (${verificationIssues.length} issue${verificationIssues.length > 1 ? "s" : ""}):
${verificationIssues.map((issue, i) => `${i + 1}. ${issue}`).join("\n")}

INSTRUCTIONS:
1. Review the verification failures above
2. Fix each issue in your output
3. Produce the COMPLETE CORRECTED output below
4. Do NOT output any explanation — only the corrected content`;
}

/**
 * Get repair statistics for a mission.
 */
export async function getRepairStats(missionId: string) {
  const tasks = await db.missionTask.findMany({
    where: { missionId, retryCount: { gt: 0 } },
    select: {
      id: true,
      title: true,
      retryCount: true,
      maxRetries: true,
      status: true,
      verificationStatus: true,
    },
  });

  const totalRepairs = tasks.reduce((sum, t) => sum + t.retryCount, 0);
  const repairedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
  const stillFailing = tasks.filter((t) => t.status === "FAILED").length;

  return {
    tasksRequiringRepair: tasks.length,
    totalRepairAttempts: totalRepairs,
    successfullyRepaired: repairedTasks,
    stillFailing,
    repairSuccessRate: tasks.length > 0 ? Math.round((repairedTasks / tasks.length) * 100) : 100,
  };
}
