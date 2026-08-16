// Mianx.ai — Mission Engine: Task Executor
//
// Executes individual MissionTasks by:
//   1. Loading the task definition and mission context
//   2. Building agent context (prior task outputs, memory, tools)
//   3. Calling the assigned AI agent via callAIWithFallback
//   4. Capturing the output and updating the task record
//   5. Tracking cost via the budget system

import { db } from "@/lib/db";
import { callAIWithFallback } from "@/lib/ai-service";
import { AGENT_CATALOG } from "@/lib/agents";
import {
  logMissionEvent,
  trackMissionBudget,
} from "./mission-engine";
import { logToolCall } from "@/lib/tool-logger";

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

export interface TaskExecutionResult {
  taskId: string;
  success: boolean;
  output: string;
  outputType: string;
  durationMs: number;
  costUsd: number;
  agentName: string;
  error?: string;
}

interface TaskExecutionContext {
  missionId: string;
  taskId: string;
  userId: string;
  // Prior task outputs (dependency results)
  priorOutputs: Map<string, { title: string; output: string; agentName: string }>;
}

// ─────────────────────────────────────────────
//  Task Executor
// ─────────────────────────────────────────────

/**
 * Execute a single mission task.
 * Loads context, calls the assigned agent, captures output.
 */
export async function executeTask(
  ctx: TaskExecutionContext,
): Promise<TaskExecutionResult> {
  const startTime = Date.now();

  // Load task + mission
  const task = await db.missionTask.findUnique({
    where: { id: ctx.taskId },
  });
  const mission = await db.mission.findUnique({
    where: { id: ctx.missionId },
  });

  if (!task || !mission) {
    throw new Error(`Task ${ctx.taskId} or Mission ${ctx.missionId} not found`);
  }

  const agentName = task.assignedAgent || "Zen"; // default to Zen if not assigned
  const agent = AGENT_CATALOG.find((a) => a.name === agentName);

  // Mark task as RUNNING
  await db.missionTask.update({
    where: { id: ctx.taskId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  await logMissionEvent(ctx.missionId, {
    eventType: "TASK_STARTED",
    title: `Executing: ${task.title}`,
    description: `Agent ${agentName} (${agent?.role || "Agent"}) is working on "${task.title}"`,
    taskId: ctx.taskId,
    level: "info",
    metadata: { agentName, agentTeam: task.agentTeam, riskLevel: task.riskLevel },
  });

  try {
    // Build context from prior task outputs
    const priorContext = buildPriorContext(ctx.priorOutputs, task);

    // Get memory context
    let memoryContext = "";
    try {
      const { getMemoryContext } = await import("@/lib/agent-memory");
      memoryContext = await getMemoryContext(mission.projectId || undefined, ctx.userId);
    } catch {
      // memory module not available
    }

    // Get project context
    let projectContext = "";
    if (mission.projectId) {
      const project = await db.project.findUnique({
        where: { id: mission.projectId },
        select: { title: true, description: true, requirements: true, projectType: true },
      });
      if (project) {
        projectContext = `\nPROJECT CONTEXT:\n- Title: ${project.title}\n- Type: ${project.projectType}\n- Description: ${project.description}\n- Requirements: ${project.requirements}`;
      }
    }

    // Parse task input for verification criteria
    let verificationCriteria = "Output should be non-empty and relevant to the task";
    try {
      const input = task.input ? JSON.parse(task.input) : {};
      if (input.verificationCriteria) {
        verificationCriteria = input.verificationCriteria;
      }
    } catch {
      // ignore parse error
    }

    // Build the system prompt
    const systemPrompt = buildTaskSystemPrompt(
      agent,
      task,
      priorContext,
      memoryContext,
      projectContext,
      verificationCriteria,
    );

    // Call the AI agent
    const output = await callAIWithFallback({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Mission Objective: ${mission.description}\n\nYour Task: ${task.description || task.title}`,
        },
      ],
      agentName,
      projectId: mission.projectId || undefined,
      userId: ctx.userId,
      endpoint: "chat",
      temperature: 0.5,
      maxTokens: 2000,
    });

    const durationMs = Date.now() - startTime;

    // Estimate cost (fast tier: ~$0.002 avg per task call)
    const estimatedCost = 0.002;
    await trackMissionBudget(ctx.missionId, estimatedCost);

    // Determine output type
    const outputType = detectOutputType(output);

    // Update task with results
    await db.missionTask.update({
      where: { id: ctx.taskId },
      data: {
        status: "COMPLETED",
        output,
        outputType,
        durationMs,
        completedAt: new Date(),
      },
    });

    // Log completion
    await logMissionEvent(ctx.missionId, {
      eventType: "TASK_COMPLETED",
      title: `Completed: ${task.title}`,
      description: `Agent ${agentName} completed "${task.title}" in ${durationMs}ms`,
      taskId: ctx.taskId,
      level: "success",
      metadata: { agentName, durationMs, outputType, estimatedCost },
    });

    return {
      taskId: ctx.taskId,
      success: true,
      output,
      outputType,
      durationMs,
      costUsd: estimatedCost,
      agentName,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Update task as failed
    await db.missionTask.update({
      where: { id: ctx.taskId },
      data: {
        status: "FAILED",
        output: null,
        durationMs,
        completedAt: new Date(),
      },
    });

    await logMissionEvent(ctx.missionId, {
      eventType: "TASK_FAILED",
      title: `Failed: ${task.title}`,
      description: `Task "${task.title}" failed: ${errorMessage}`,
      taskId: ctx.taskId,
      level: "error",
      metadata: { agentName, durationMs, error: errorMessage },
    });

    return {
      taskId: ctx.taskId,
      success: false,
      output: "",
      outputType: "text",
      durationMs,
      costUsd: 0,
      agentName,
      error: errorMessage,
    };
  }
}

// ─────────────────────────────────────────────
//  Context Building
// ─────────────────────────────────────────────

function buildPriorContext(
  priorOutputs: Map<string, { title: string; output: string; agentName: string }>,
  currentTask: { dependencies: string },
): string {
  if (priorOutputs.size === 0) return "";

  let context = "\n\nPRIOR TASK OUTPUTS (from previous steps in this mission):\n";

  // Get this task's dependency IDs
  const deps: string[] = JSON.parse(currentTask.dependencies || "[]");

  // Include outputs from dependency tasks
  const relevantOutputs = deps
    .map((depId) => priorOutputs.get(depId))
    .filter(Boolean);

  if (relevantOutputs.length === 0) {
    // If no direct dependency outputs, include all prior outputs (limited)
    let count = 0;
    for (const [, value] of priorOutputs) {
      if (count >= 3) break; // max 3 prior outputs to prevent context explosion
      const truncated = value.output.length > 1500
        ? value.output.slice(0, 1500) + "\n[... output truncated ...]"
        : value.output;
      context += `\n--- ${value.title} (${value.agentName}) ---\n${truncated}\n`;
      count++;
    }
  } else {
    for (const out of relevantOutputs) {
      if (!out) continue;
      const truncated = out.output.length > 2000
        ? out.output.slice(0, 2000) + "\n[... output truncated ...]"
        : out.output;
      context += `\n--- ${out.title} (${out.agentName}) ---\n${truncated}\n`;
    }
  }

  context += "\nIMPORTANT: Build on the above outputs. Do NOT repeat what was already done. Focus on YOUR specific task.";

  return context;
}

function buildTaskSystemPrompt(
  agent: { systemPrompt: string; name: string; role: string; team: string } | undefined,
  task: {
    title: string;
    description: string | null;
    assignedAgent: string | null;
    agentRole: string | null;
    agentTeam: string | null;
    requiredTools: string;
    riskLevel: string;
  },
  priorContext: string,
  memoryContext: string,
  projectContext: string,
  verificationCriteria: string,
): string {
  const basePrompt = agent?.systemPrompt || `You are ${task.assignedAgent || "an AI assistant"}, a ${task.agentRole || "specialist"} agent.`;

  return `${basePrompt}

You are executing a TASK within a MISSION on the Mianx.ai Agentic AI Platform.

YOUR TASK: ${task.title}
${task.description ? `DESCRIPTION: ${task.description}` : ""}

VERIFICATION CRITERIA: Your output will be verified against: "${verificationCriteria}"
Make sure your output clearly satisfies these criteria.${priorContext}
${memoryContext}
${projectContext}

EXECUTION GUIDELINES:
1. Focus ONLY on your assigned task: ${task.title}
2. Produce complete, actionable output — not outlines or summaries
3. If your task involves code, write COMPLETE, runnable code with imports
4. If your task involves content, write publication-ready content
5. Structure your output clearly so it can be verified
6. Do NOT repeat work that prior tasks have already completed
7. Reference specific prior outputs when building on them (e.g., "Based on the design spec from Kairo, I implemented...")`;
}

// ─────────────────────────────────────────────
//  Output Type Detection
// ─────────────────────────────────────────────

function detectOutputType(output: string): string {
  // Check for code blocks
  const codeBlockCount = (output.match(/```[\s\S]*?```/g) || []).length;
  if (codeBlockCount >= 2) return "code";
  if (codeBlockCount === 1) {
    // Check if it's a substantial code block
    const match = output.match(/```[\s\S]*?```/);
    if (match && match[0].split("\n").length > 5) return "code";
  }

  // Check for JSON
  if (output.trim().startsWith("{") || output.trim().startsWith("[")) {
    try {
      JSON.parse(output);
      return "json";
    } catch {
      // not valid JSON
    }
  }

  // Check for URL
  if (/^https?:\/\//.test(output.trim())) return "url";

  // Check for structured content (lists, headings)
  const lines = output.split("\n").filter((l) => l.trim());
  const headingCount = lines.filter((l) => /^#{1,6}\s/.test(l)).length;
  const listCount = lines.filter((l) => /^[\s]*[-*]\s/.test(l)).length;
  if (headingCount >= 2 || listCount >= 3) return "text";

  // Default
  return "text";
}

// ─────────────────────────────────────────────
//  Tool Logger Helper
// ─────────────────────────────────────────────

async function logToolCall(
  _provider: string,
  _toolName: string,
  _opts: {
    agentName?: string;
    projectId?: string;
    userId?: string;
    input?: unknown;
    output?: unknown;
    status?: string;
    durationMs?: number;
  },
): Promise<void> {
  // Re-use existing tool logger
  try {
    const { logToolCall: doLog } = await import("@/lib/tool-logger");
    await doLog(_provider, _toolName, _opts);
  } catch {
    // tool-logger not available, skip
  }
}
