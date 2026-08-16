// Mianx.ai — Phase 6: Agent Loop (Autonomous ReAct Execution)
//
// The Agent Loop is the core intelligence layer that transforms a single AI
// call per task into an iterative, self-reflective execution cycle. Instead of
// calling the AI once and accepting the output, the agent enters a ReAct loop:
//
//   Think → Act (call tools) → Observe (tool results) → Reflect → Think → ...
//   ...until the agent decides the task is complete or max iterations reached.
//
// Key capabilities:
//   1. ReAct pattern — reasoning and acting in interleaved steps
//   2. Dynamic tool discovery — agent can request tools mid-execution
//   3. Self-reflection — agent evaluates its own work quality
//   4. Context management — smart summarization to stay within token limits
//   5. Iteration budget — configurable max iterations per task
//   6. Loop state persistence — each iteration is logged for auditability
//
// The Agent Loop is what makes Mianx.ai a TRUE Agentic AI platform, not just
// a multi-agent orchestrator.

import { callAIWithFallback } from "@/lib/ai-service";
import { AGENT_CATALOG } from "@/lib/agents";
import { db } from "@/lib/db";
import { logMissionEvent, trackMissionBudget } from "./mission-engine";
import { resolveTool, resolveTools, listTools, checkToolPermissions, validateToolInput, isAgentAllowed, type ToolDef } from "./tool-registry";
import { executeTool } from "./tool-executor";
import { summarizeContext, type ContextWindow } from "./context-manager";

// ─────────────────────────────────────────────
//  Configuration
// ─────────────────────────────────────────────

const DEFAULT_MAX_ITERATIONS = 8; // Max think-act-observe cycles per task
const DEFAULT_REFLECTION_THRESHOLD = 6; // Trigger self-reflection after this many iterations
const MAX_CONTEXT_TOKENS = 8000; // Approximate token limit for agent context
const MIN_OUTPUT_TOKENS = 50; // Minimum output before agent can declare "done"
const TOOL_CALL_TOKEN_BUDGET = 2000; // Reserve tokens for tool results

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

export type LoopStepType = "think" | "act" | "observe" | "reflect" | "final";

export interface AgentLoopConfig {
  missionId: string;
  taskId: string;
  userId: string;
  maxIterations?: number;
  enableReflection?: boolean;
  enableDynamicTools?: boolean;
  contextTokenBudget?: number;
}

export interface LoopIteration {
  iteration: number;
  stepType: LoopStepType;
  content: string;
  toolCall?: ToolCallRecord;
  observation?: string;
  reflectionScore?: number; // 0-100 self-assessed quality
  durationMs: number;
  tokenEstimate: number;
}

export interface ToolCallRecord {
  toolName: string;
  input: Record<string, unknown>;
  success: boolean;
  output: string;
  durationMs: number;
  costUsd: number;
  approvalRequired?: boolean;
  approvalId?: string;
  error?: string; // Error message if tool call failed
}

export interface AgentLoopResult {
  success: boolean;
  finalOutput: string;
  outputType: string;
  totalIterations: number;
  iterations: LoopIteration[];
  totalDurationMs: number;
  totalCostUsd: number;
  toolCallsCount: number;
  reflectionTriggered: boolean;
  reflectionScore: number;
  terminationReason: "task_complete" | "max_iterations" | "budget_exceeded" | "approval_required" | "error";
  error?: string;
}

// ─────────────────────────────────────────────
//  ReAct Loop System Prompt
// ─────────────────────────────────────────────

const REACT_SYSTEM_PROMPT = `You are operating in an AUTONOMOUS AGENT LOOP on the Mianx.ai Agentic AI Platform.

## Your Execution Pattern: ReAct (Reason + Act)

You operate in cycles. Each cycle, you output ONE of these step types:

### 1. THINK
Reason about the current situation. Analyze what you have, what you need, and plan your next action.
Format: [THINK] Your reasoning here...

### 2. ACT (Tool Call)
Use a tool to accomplish part of the task. Specify which tool and what input.
Format: [ACT] tool_name | {"param": "value"}

### 3. OBSERVE
You will receive tool results automatically. After receiving them, reason about what you learned.
Format: [OBSERVE] Based on the tool result, I learned...

### 4. REFLECT
Evaluate your progress so far. Rate your output quality 0-100. Decide if you need more iterations.
Format: [REFLECT] score:75 | I have completed X but still need Y...

### 5. FINAL
When the task is truly complete, output your final deliverable.
Format: [FINAL] Your complete final output here...

## CRITICAL RULES:
1. You MUST start with [THINK] — analyze the task before doing anything
2. Each response must contain EXACTLY ONE step type tag
3. Do NOT output raw content without a step tag
4. Use [ACT] to call tools — you will receive results in the next turn
5. After receiving tool results, use [OBSERVE] to process them
6. Use [REFLECT] periodically to assess your progress (after every 2-3 actions)
7. Use [FINAL] ONLY when you have a complete, polished deliverable
8. If you need tools you haven't seen listed, ask for them: [ACT] discover_tools | {"search": "what I need"}
9. Minimum quality target: reflection score >= 70 before using [FINAL]
10. Stay focused on the task — do not go off on tangents`;

// ─────────────────────────────────────────────
//  Agent Loop Engine
// ─────────────────────────────────────────────

/**
 * Run the full Agent Loop for a task.
 * This is the main entry point that replaces the single AI call
 * in task-executor.ts with an iterative ReAct cycle.
 */
export async function runAgentLoop(
  config: AgentLoopConfig,
  taskContext: {
    title: string;
    description: string;
    missionDescription: string;
    agentName: string;
    agentSystemPrompt: string;
    priorOutputs?: Map<string, { title: string; output: string; agentName: string }>;
    projectContext?: string;
    memoryContext?: string;
    verificationCriteria?: string;
    preAssignedTools?: string[];
    riskLevel?: string;
  },
): Promise<AgentLoopResult> {
  const startTime = Date.now();
  const maxIter = config.maxIterations || DEFAULT_MAX_ITERATIONS;
  const enableReflection = config.enableReflection !== false;
  const enableDynamicTools = config.enableDynamicTools !== false;
  const contextBudget = config.contextTokenBudget || MAX_CONTEXT_TOKENS;

  const iterations: LoopIteration[] = [];
  let totalCostUsd = 0;
  let toolCallsCount = 0;
  let reflectionTriggered = false;
  let reflectionScore = 0;
  let finalOutput = "";

  // Context window for managing conversation history
  const contextWindow: ContextWindow = {
    messages: [],
    systemPrompt: taskContext.agentSystemPrompt,
    maxTokens: contextBudget,
  };

  try {
    // Build initial context
    const initialContext = buildInitialContext(taskContext);
    contextWindow.messages.push({ role: "user", content: initialContext });

    // Discover available tools
    let availableTools: ToolDef[] = [];
    if (enableDynamicTools) {
      try {
        availableTools = await discoverToolsForTask(taskContext);
      } catch {
        // Tool discovery failure is non-fatal
      }
    }

    // Build tool catalog description for the agent
    const toolCatalog = buildToolCatalogDescription(availableTools);

    // Main ReAct loop
    for (let iter = 0; iter < maxIter; iter++) {
      const iterStart = Date.now();

      // Check mission status (might have been paused/cancelled)
      const mission = await db.mission.findUnique({
        where: { id: config.missionId },
        select: { status: true },
      });
      if (!mission || mission.status !== "EXECUTING") {
        return {
          success: false,
          finalOutput: iterations.length > 0 ? iterations[iterations.length - 1].content : "",
          outputType: "text",
          totalIterations: iterations.length,
          iterations,
          totalDurationMs: Date.now() - startTime,
          totalCostUsd,
          toolCallsCount,
          reflectionTriggered,
          reflectionScore,
          terminationReason: "error",
          error: "Mission stopped during agent loop",
        };
      }

      // Budget check
      try {
        const { checkBudgetAllowance } = await import("./approval-engine");
        const budgetCheck = await checkBudgetAllowance(config.missionId, 0.003, config.userId);
        if (!budgetCheck.allowed) {
          return {
            success: false,
            finalOutput: iterations.length > 0 ? iterations[iterations.length - 1].content : "",
            outputType: "text",
            totalIterations: iterations.length,
            iterations,
            totalDurationMs: Date.now() - startTime,
            totalCostUsd,
            toolCallsCount,
            reflectionTriggered,
            reflectionScore,
            terminationReason: "budget_exceeded",
            error: budgetCheck.reason,
          };
        }
      } catch {
        // Budget check failure is non-fatal
      }

      // Manage context window — summarize if needed
      if (iter > 0 && iter % 3 === 0) {
        const summarized = summarizeContext(contextWindow);
        if (summarized) {
          contextWindow.messages = summarized.messages;
        }
      }

      // Build messages for this iteration
      const messages = buildLoopMessages(contextWindow, toolCatalog, iterations);

      // Call the AI agent
      const response = await callAIWithFallback({
        messages,
        agentName: taskContext.agentName,
        projectId: config.missionId,
        userId: config.userId,
        endpoint: "chat",
        temperature: 0.4, // Slightly lower for structured output
        maxTokens: 1500,
      });

      // Track AI call cost
      const aiCallCost = 0.003;
      totalCostUsd += aiCallCost;
      await trackMissionBudget(config.missionId, aiCallCost);

      // Parse the response step type
      const parsed = parseAgentResponse(response);

      const iteration: LoopIteration = {
        iteration: iter + 1,
        stepType: parsed.stepType,
        content: parsed.content,
        durationMs: Date.now() - iterStart,
        tokenEstimate: estimateTokens(response),
      };

      // Handle different step types
      switch (parsed.stepType) {
        case "think":
          contextWindow.messages.push({ role: "assistant", content: response });
          break;

        case "act":
          // Process tool call
          if (parsed.toolCall) {
            const toolResult = await handleToolCall(
              parsed.toolCall,
              config,
              taskContext,
              availableTools,
            );

            iteration.toolCall = toolResult;
            iteration.observation = toolResult.output
              ? `Tool "${parsed.toolCall.toolName}" returned: ${toolResult.output.slice(0, 500)}${toolResult.output.length > 500 ? "..." : ""}`
              : `Tool "${parsed.toolCall.toolName}" ${toolResult.success ? "succeeded" : "failed"}`;

            totalCostUsd += toolResult.costUsd;
            toolCallsCount++;

            // Add to context: the act + observation
            contextWindow.messages.push({
              role: "assistant",
              content: response,
            });
            contextWindow.messages.push({
              role: "user",
              content: `[TOOL RESULT] ${toolResult.success ? "SUCCESS" : "FAILED"}: ${toolResult.output || toolResult.error || "No output"}`,
            });

            // Handle approval requirement
            if (toolResult.approvalRequired) {
              iterations.push(iteration);
              await logMissionEvent(config.missionId, {
                eventType: "HUMAN_APPROVAL_REQUESTED",
                title: `Tool approval needed: ${parsed.toolCall.toolName}`,
                description: `Agent loop paused — tool "${parsed.toolCall.toolName}" requires human approval`,
                taskId: config.taskId,
                level: "warn",
                metadata: { toolName: parsed.toolCall.toolName, approvalId: toolResult.approvalId },
              });

              return {
                success: false,
                finalOutput: "",
                outputType: "text",
                totalIterations: iterations.length,
                iterations,
                totalDurationMs: Date.now() - startTime,
                totalCostUsd,
                toolCallsCount,
                reflectionTriggered,
                reflectionScore,
                terminationReason: "approval_required",
                error: `Tool "${parsed.toolCall.toolName}" requires human approval (ID: ${toolResult.approvalId})`,
              };
            }
          } else {
            // Agent said ACT but didn't specify a tool — treat as think
            iteration.stepType = "think";
            contextWindow.messages.push({ role: "assistant", content: response });
          }
          break;

        case "observe":
          contextWindow.messages.push({ role: "assistant", content: response });
          break;

        case "reflect":
          reflectionTriggered = true;
          reflectionScore = parsed.reflectionScore ?? 50;

          iteration.reflectionScore = reflectionScore;
          contextWindow.messages.push({ role: "assistant", content: response });

          // Log reflection
          await logMissionEvent(config.missionId, {
            eventType: "TASK_COMPLETED", // Reuse event type for loop progress
            title: `Agent reflection #${iter + 1}`,
            description: `Self-assessed quality: ${reflectionScore}/100. ${iteration.content.slice(0, 200)}`,
            taskId: config.taskId,
            level: reflectionScore >= 70 ? "success" : "warn",
            metadata: { reflectionScore, iteration: iter + 1 },
          });
          break;

        case "final":
          finalOutput = parsed.content;
          contextWindow.messages.push({ role: "assistant", content: response });
          iterations.push(iteration);

          // Validate minimum output quality
          if (estimateTokens(finalOutput) < MIN_OUTPUT_TOKENS) {
            // Output too short — reject and ask for more detail
            contextWindow.messages.push({
              role: "user",
              content: `[SYSTEM] Your final output is too short (under ${MIN_OUTPUT_TOKENS} tokens). Please provide a more complete and detailed response. Use [FINAL] again with the full output.`,
            });
            continue; // Don't break — let the agent try again
          }

          // Log completion
          await logMissionEvent(config.missionId, {
            eventType: "TASK_COMPLETED",
            title: `Agent loop completed: ${taskContext.title}`,
            description: `Completed in ${iter + 1} iterations with ${toolCallsCount} tool calls. Reflection score: ${reflectionScore}/100`,
            taskId: config.taskId,
            level: "success",
            metadata: { iterations: iter + 1, toolCalls: toolCallsCount, reflectionScore },
          });

          return {
            success: true,
            finalOutput,
            outputType: detectOutputType(finalOutput),
            totalIterations: iterations.length,
            iterations,
            totalDurationMs: Date.now() - startTime,
            totalCostUsd,
            toolCallsCount,
            reflectionTriggered,
            reflectionScore,
            terminationReason: "task_complete",
          };
      }

      iterations.push(iteration);

      // Auto-trigger reflection if we've done many iterations without one
      if (
        enableReflection &&
        !reflectionTriggered &&
        iter >= DEFAULT_REFLECTION_THRESHOLD - 1
      ) {
        contextWindow.messages.push({
          role: "user",
          content: `[SYSTEM] You've completed ${iter + 1} iterations. Please use [REFLECT] to evaluate your progress (score 0-100), then either continue working or use [FINAL] if the task is complete.`,
        });
      }
    }

    // Max iterations reached — extract best output from iterations
    const bestOutput = extractBestOutput(iterations);

    await logMissionEvent(config.missionId, {
      eventType: "TASK_COMPLETED",
      title: `Agent loop max iterations reached: ${taskContext.title}`,
      description: `Reached ${maxIter} iterations. ${bestOutput ? "Extracted best output." : "No suitable output found."}`,
      taskId: config.taskId,
      level: "warn",
      metadata: { maxIterations: maxIter, toolCalls: toolCallsCount },
    });

    return {
      success: !!bestOutput,
      finalOutput: bestOutput || "Agent loop reached maximum iterations without producing a final output. Review the iteration log for partial results.",
      outputType: bestOutput ? detectOutputType(bestOutput) : "text",
      totalIterations: iterations.length,
      iterations,
      totalDurationMs: Date.now() - startTime,
      totalCostUsd,
      toolCallsCount,
      reflectionTriggered,
      reflectionScore,
      terminationReason: "max_iterations",
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    await logMissionEvent(config.missionId, {
      eventType: "ERROR",
      title: `Agent loop error: ${taskContext.title}`,
      description: errorMsg,
      taskId: config.taskId,
      level: "error",
      metadata: { iterations: iterations.length },
    });

    return {
      success: false,
      finalOutput: "",
      outputType: "text",
      totalIterations: iterations.length,
      iterations,
      totalDurationMs: Date.now() - startTime,
      totalCostUsd,
      toolCallsCount,
      reflectionTriggered,
      reflectionScore,
      terminationReason: "error",
      error: errorMsg,
    };
  }
}

// ─────────────────────────────────────────────
//  Response Parsing
// ─────────────────────────────────────────────

interface ParsedResponse {
  stepType: LoopStepType;
  content: string;
  toolCall?: {
    toolName: string;
    input: Record<string, unknown>;
  };
  reflectionScore?: number;
}

function parseAgentResponse(response: string): ParsedResponse {
  const trimmed = response.trim();

  // Match step type tags: [THINK], [ACT], [OBSERVE], [REFLECT], [FINAL]
  const thinkMatch = trimmed.match(/\[THINK\]\s*([\s\S]*)/i);
  const actMatch = trimmed.match(/\[ACT\]\s*([^\n|]+)(?:\s*\|\s*([\s\S]*))?/i);
  const observeMatch = trimmed.match(/\[OBSERVE\]\s*([\s\S]*)/i);
  const reflectMatch = trimmed.match(/\[REFLECT\]\s*(?:score\s*:\s*(\d+)\s*\|\s*)?([\s\S]*)/i);
  const finalMatch = trimmed.match(/\[FINAL\]\s*([\s\S]*)/i);

  if (thinkMatch) {
    return { stepType: "think", content: thinkMatch[1].trim() };
  }

  if (actMatch) {
    const toolName = actMatch[1].trim();
    let toolInput: Record<string, unknown> = {};

    if (actMatch[2]) {
      try {
        toolInput = JSON.parse(actMatch[2].trim());
      } catch {
        // Try to parse as key=value pairs
        toolInput = parseSimpleInput(actMatch[2].trim());
      }
    }

    // Special: discover_tools is a meta-tool
    if (toolName === "discover_tools") {
      toolInput = toolInput.search ? { search: String(toolInput.search) } : {};
    }

    return {
      stepType: "act",
      content: `Calling tool: ${toolName}`,
      toolCall: { toolName, input: toolInput },
    };
  }

  if (observeMatch) {
    return { stepType: "observe", content: observeMatch[1].trim() };
  }

  if (reflectMatch) {
    return {
      stepType: "reflect",
      content: reflectMatch[2]?.trim() || "",
      reflectionScore: reflectMatch[1] ? parseInt(reflectMatch[1], 10) : undefined,
    };
  }

  if (finalMatch) {
    return { stepType: "final", content: finalMatch[1].trim() };
  }

  // No step tag detected — treat as think (the agent is just reasoning)
  return {
    stepType: "think",
    content: trimmed,
  };
}

function parseSimpleInput(inputStr: string): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  // Simple key=value parsing
  const pairs = inputStr.split(",");
  for (const pair of pairs) {
    const [key, ...valueParts] = pair.split("=");
    if (key && valueParts.length > 0) {
      input[key.trim()] = valueParts.join("=").trim();
    }
  }
  return input;
}

// ─────────────────────────────────────────────
//  Tool Call Handling
// ─────────────────────────────────────────────

async function handleToolCall(
  toolCall: { toolName: string; input: Record<string, unknown> },
  config: AgentLoopConfig,
  taskContext: { agentName: string },
  availableTools: ToolDef[],
): Promise<ToolCallRecord> {
  const toolStart = Date.now();

  // Handle special meta-tools
  if (toolCall.toolName === "discover_tools") {
    const searchTerm = String(toolCall.input.search || "");
    const discovered = searchTerm
      ? availableTools.filter((t) =>
          t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.category.toLowerCase().includes(searchTerm.toLowerCase()),
        )
      : availableTools;

    const description = discovered.length > 0
      ? discovered.map((t) => `- ${t.name} (${t.category}, ${t.riskLevel} risk): ${t.description}`).join("\n")
      : "No tools found matching your search. Available categories: FILE, CODE, GIT, DATABASE, WEB, DEPLOY, AI, SYSTEM";

    return {
      toolName: "discover_tools",
      input: toolCall.input,
      success: true,
      output: description,
      durationMs: Date.now() - toolStart,
      costUsd: 0,
    };
  }

  // Resolve the tool
  const tool = await resolveTool(toolCall.toolName);

  if (!tool) {
    return {
      toolName: toolCall.toolName,
      input: toolCall.input,
      success: false,
      output: "",
      durationMs: Date.now() - toolStart,
      costUsd: 0,
      error: `Tool "${toolCall.toolName}" not found or not enabled`,
    };
  }

  // Check permissions
  const permError = checkToolPermissions(tool, {
    toolName: toolCall.toolName,
    input: toolCall.input,
    agentName: taskContext.agentName,
    userId: config.userId,
    missionId: config.missionId,
    taskId: config.taskId,
  });

  if (permError) {
    return {
      toolName: toolCall.toolName,
      input: toolCall.input,
      success: false,
      output: "",
      durationMs: Date.now() - toolStart,
      costUsd: 0,
      error: permError,
    };
  }

  // Validate input
  const validationErrors = validateToolInput(tool, toolCall.input);
  if (validationErrors.length > 0) {
    return {
      toolName: toolCall.toolName,
      input: toolCall.input,
      success: false,
      output: "",
      durationMs: Date.now() - toolStart,
      costUsd: 0,
      error: `Input validation failed: ${validationErrors.join("; ")}`,
    };
  }

  // Execute the tool via the tool executor
  try {
    const result = await executeTool({
      toolName: toolCall.toolName,
      input: toolCall.input,
      agentName: taskContext.agentName,
      userId: config.userId,
      missionId: config.missionId,
      taskId: config.taskId,
    });

    return {
      toolName: toolCall.toolName,
      input: toolCall.input,
      success: result.success,
      output: typeof result.output === "string" ? result.output : JSON.stringify(result.output, null, 2),
      durationMs: Date.now() - toolStart,
      costUsd: result.costUsd,
      approvalRequired: result.approvalRequired,
      approvalId: result.approvalId,
    };
  } catch (error) {
    return {
      toolName: toolCall.toolName,
      input: toolCall.input,
      success: false,
      output: "",
      durationMs: Date.now() - toolStart,
      costUsd: 0,
      error: error instanceof Error ? error.message : "Tool execution failed",
    };
  }
}

// ─────────────────────────────────────────────
//  Tool Discovery
// ─────────────────────────────────────────────

async function discoverToolsForTask(taskContext: {
  title: string;
  description: string;
  agentName: string;
  riskLevel?: string;
}): Promise<ToolDef[]> {
  // Get all enabled tools
  const allTools = await listTools({});

  // Filter to tools this agent is allowed to use
  const allowedTools = allTools.filter((t) => {
    return isAgentAllowed(t, taskContext.agentName);
  });

  return allowedTools;
}

function buildToolCatalogDescription(tools: ToolDef[]): string {
  if (tools.length === 0) return "";

  return `
## Available Tools:
${tools.map((t) => `- ${t.name} (${t.category}, ${t.riskLevel} risk): ${t.description}`).join("\n")}

To use a tool: [ACT] tool_name | {"param": "value"}
To discover more tools: [ACT] discover_tools | {"search": "keyword"}`;
}

// ─────────────────────────────────────────────
//  Context Building
// ─────────────────────────────────────────────

function buildInitialContext(taskContext: {
  title: string;
  description: string;
  missionDescription: string;
  agentName: string;
  priorOutputs?: Map<string, { title: string; output: string; agentName: string }>;
  projectContext?: string;
  memoryContext?: string;
  verificationCriteria?: string;
}): string {
  let context = `## Your Mission:
${taskContext.missionDescription}

## Your Task:
${taskContext.title}
${taskContext.description ? `\n${taskContext.description}` : ""}`;

  if (taskContext.verificationCriteria) {
    context += `\n\n## Verification Criteria:
Your output will be verified against: "${taskContext.verificationCriteria}"
Make sure your final output clearly satisfies these criteria.`;
  }

  if (taskContext.priorOutputs && taskContext.priorOutputs.size > 0) {
    context += "\n\n## Prior Task Outputs (for context):";
    let count = 0;
    for (const [id, data] of taskContext.priorOutputs) {
      if (count >= 3) break;
      const truncated = data.output.length > 1500
        ? data.output.slice(0, 1500) + "\n[... truncated ...]"
        : data.output;
      context += `\n--- ${data.title} (${data.agentName}) ---\n${truncated}`;
      count++;
    }
    context += "\nBuild on these outputs. Do NOT repeat work already done.";
  }

  if (taskContext.projectContext) {
    context += `\n\n${taskContext.projectContext}`;
  }

  if (taskContext.memoryContext) {
    context += `\n\n${taskContext.memoryContext}`;
  }

  context += `\n\nBegin by analyzing the task with [THINK], then proceed with [ACT] to use tools, and finish with [FINAL] when done.`;

  return context;
}

function buildLoopMessages(
  contextWindow: ContextWindow,
  toolCatalog: string,
  iterations: LoopIteration[],
): { role: "system" | "user" | "assistant"; content: string }[] {
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];

  // System prompt with ReAct instructions
  messages.push({
    role: "system",
    content: `${REACT_SYSTEM_PROMPT}\n\n${toolCatalog}\n\n## Current Iteration: ${iterations.length + 1}\n## Iterations used: ${iterations.length}`,
  });

  // Add context window messages (already managed by context manager)
  for (const msg of contextWindow.messages) {
    messages.push(msg);
  }

  return messages;
}

// ─────────────────────────────────────────────
//  Output Extraction
// ─────────────────────────────────────────────

function extractBestOutput(iterations: LoopIteration[]): string {
  // Strategy 1: Use the last final output if any
  const finalIter = [...iterations].reverse().find((i) => i.stepType === "final");
  if (finalIter) return finalIter.content;

  // Strategy 2: Use the longest think/observe content (likely most detailed)
  const contentIterations = iterations
    .filter((i) => i.stepType === "think" || i.stepType === "observe")
    .sort((a, b) => b.content.length - a.content.length);

  if (contentIterations.length > 0) {
    return contentIterations[0].content;
  }

  // Strategy 3: Concatenate all substantial content
  const substantial = iterations
    .filter((i) => i.content.length > 100)
    .map((i) => `[${i.stepType.toUpperCase()}] ${i.content}`)
    .join("\n\n");

  return substantial || "";
}

// ─────────────────────────────────────────────
//  Output Type Detection
// ─────────────────────────────────────────────

function detectOutputType(output: string): string {
  const codeBlockCount = (output.match(/```[\s\S]*?```/g) || []).length;
  if (codeBlockCount >= 2) return "code";
  if (codeBlockCount === 1) {
    const match = output.match(/```[\s\S]*?```/);
    if (match && match[0].split("\n").length > 5) return "code";
  }
  if (output.trim().startsWith("{") || output.trim().startsWith("[")) {
    try { JSON.parse(output); return "json"; } catch { /* not json */ }
  }
  if (/^https?:\/\//.test(output.trim())) return "url";
  return "text";
}

// ─────────────────────────────────────────────
//  Token Estimation
// ─────────────────────────────────────────────

function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters for English, ≈ 2 characters for CJK
  return Math.ceil(text.length / 3.5);
}

// ─────────────────────────────────────────────
//  Loop Statistics
// ─────────────────────────────────────────────

export interface AgentLoopStats {
  totalLoopsRun: number;
  averageIterations: number;
  averageReflectionScore: number;
  averageToolCallsPerLoop: number;
  completionRate: number;
}

export async function getAgentLoopStats(): Promise<AgentLoopStats> {
  // This would query from a LoopIteration table if we had one
  // For now, return based on mission task data
  const tasksWithRetries = await db.missionTask.findMany({
    where: { retryCount: { gt: 0 } },
    select: { retryCount: true, status: true },
  });

  const completedWithRetries = tasksWithRetries.filter((t) => t.status === "COMPLETED").length;
  const total = tasksWithRetries.length || 1;

  return {
    totalLoopsRun: total,
    averageIterations: 3.5, // placeholder
    averageReflectionScore: 72, // placeholder
    averageToolCallsPerLoop: 2.1, // placeholder
    completionRate: Math.round((completedWithRetries / total) * 100),
  };
}
