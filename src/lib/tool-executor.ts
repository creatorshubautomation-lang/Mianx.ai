// Mianx.ai — Phase 4: Tool Executor
//
// Secure tool execution middleware that wraps handler invocation with:
//   1. Tool resolution (name → ToolDefinition)
//   2. Permission checks (agent, plan, risk level)
//   3. Input validation (JSON Schema)
//   4. Approval gating (HIGH/CRITICAL risk tools)
//   5. Timeout enforcement
//   6. Retry logic (with backoff)
//   7. Cost tracking
//   8. Comprehensive logging
//
// This is the ONLY way tools should be executed in the system.
// Never call tool handlers directly — always go through executeTool().

import {
  resolveTool,
  checkToolPermissions,
  validateToolInput,
  requiresApproval,
  createToolApproval,
  type ToolExecuteRequest,
  type ToolExecuteResult,
  type ToolDef,
} from "./tool-registry";
import { getHandler, type ToolHandlerContext } from "./tool-handlers";
import { logToolCall } from "./tool-logger";

// ─────────────────────────────────────────────
//  Configuration
// ─────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;
const MAX_INPUT_SIZE = 100_000; // 100KB max input size

// ─────────────────────────────────────────────
//  Main Executor
// ─────────────────────────────────────────────

/**
 * Execute a tool with full security middleware.
 * This is the primary entry point for all tool executions.
 *
 * Flow:
 *   1. Resolve tool definition from DB
 *   2. Check permissions (agent, plan)
 *   3. Validate input against schema
 *   4. Check approval requirements
 *   5. Get handler function
 *   6. Execute with timeout
 *   7. Handle retries on failure
 *   8. Log the call
 *   9. Return result
 */
export async function executeTool(
  request: ToolExecuteRequest,
): Promise<ToolExecuteResult> {
  const startTime = Date.now();

  // Step 1: Resolve tool
  const tool = await resolveTool(request.toolName);

  if (!tool) {
    const error = `Tool "${request.toolName}" not found or disabled`;
    await logToolExecution(request, null, "failed", 0, error);
    return {
      success: false,
      output: null,
      toolName: request.toolName,
      durationMs: Date.now() - startTime,
      costUsd: 0,
      approvalRequired: false,
      error,
      riskLevel: "LOW",
    };
  }

  // Step 2: Check permissions
  const permissionError = checkToolPermissions(tool, request);
  if (permissionError) {
    await logToolExecution(request, tool, "failed", 0, permissionError);
    return {
      success: false,
      output: null,
      toolName: tool.name,
      durationMs: Date.now() - startTime,
      costUsd: 0,
      approvalRequired: false,
      error: permissionError,
      riskLevel: tool.riskLevel,
    };
  }

  // Step 3: Validate input
  const validationErrors = validateToolInput(tool, request.input);
  if (validationErrors.length > 0) {
    const error = `Input validation failed: ${validationErrors.join("; ")}`;
    await logToolExecution(request, tool, "failed", 0, error);
    return {
      success: false,
      output: null,
      toolName: tool.name,
      durationMs: Date.now() - startTime,
      costUsd: 0,
      approvalRequired: false,
      error,
      riskLevel: tool.riskLevel,
    };
  }

  // Step 3.5: Check input size
  const inputSize = JSON.stringify(request.input).length;
  if (inputSize > MAX_INPUT_SIZE) {
    const error = `Input too large: ${inputSize} bytes (max ${MAX_INPUT_SIZE})`;
    return {
      success: false,
      output: null,
      toolName: tool.name,
      durationMs: Date.now() - startTime,
      costUsd: 0,
      approvalRequired: false,
      error,
      riskLevel: tool.riskLevel,
    };
  }

  // Step 4: Check approval requirements
  if (requiresApproval(tool, request.skipApproval)) {
    const approvalId = await createToolApproval(tool, request);
    return {
      success: false,
      output: null,
      toolName: tool.name,
      durationMs: Date.now() - startTime,
      costUsd: 0,
      approvalRequired: true,
      approvalId,
      error: `Tool "${tool.displayName}" requires human approval (risk: ${tool.riskLevel}). Approval ID: ${approvalId}`,
      riskLevel: tool.riskLevel,
    };
  }

  // Step 5: Get handler
  const handler = getHandler(tool.handler);
  if (!handler) {
    const error = `Handler "${tool.handler}" not registered for tool "${tool.name}"`;
    await logToolExecution(request, tool, "failed", 0, error);
    return {
      success: false,
      output: null,
      toolName: tool.name,
      durationMs: Date.now() - startTime,
      costUsd: 0,
      approvalRequired: false,
      error,
      riskLevel: tool.riskLevel,
    };
  }

  // Step 6: Execute with timeout + retry
  const result = await executeWithRetry(
    handler,
    tool,
    request,
    tool.timeoutMs || DEFAULT_TIMEOUT_MS,
    tool.retryable ? tool.maxRetries : 0,
  );

  // Step 7: Log the execution
  await logToolExecution(
    request,
    tool,
    result.success ? "success" : "failed",
    result.durationMs,
    result.error,
    result.output as Record<string, unknown> | undefined,
  );

  return {
    success: result.success,
    output: result.output,
    toolName: tool.name,
    durationMs: result.durationMs,
    costUsd: tool.costPerCall,
    approvalRequired: false,
    error: result.error,
    riskLevel: tool.riskLevel,
  };
}

// ─────────────────────────────────────────────
//  Batch Execution
// ─────────────────────────────────────────────

/**
 * Execute multiple tools in sequence.
 * Useful when a task requires multiple tool calls.
 * Stops on first failure unless continueOnError is set.
 */
export async function executeToolBatch(
  requests: ToolExecuteRequest[],
  options?: { continueOnError?: boolean; sequential?: boolean },
): Promise<{ results: ToolExecuteResult[]; totalCost: number; totalDuration: number }> {
  const results: ToolExecuteResult[] = [];
  let totalCost = 0;
  const startTime = Date.now();

  if (options?.sequential === false) {
    // Parallel execution
    const settled = await Promise.allSettled(
      requests.map((req) => executeTool(req)),
    );

    for (const result of settled) {
      const execResult = result.status === "fulfilled"
        ? result.value
        : {
            success: false as const,
            output: null,
            toolName: "unknown",
            durationMs: 0,
            costUsd: 0,
            approvalRequired: false,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
            riskLevel: "LOW" as const,
          };
      results.push(execResult);
      totalCost += execResult.costUsd;
    }
  } else {
    // Sequential execution (default)
    for (const request of requests) {
      const result = await executeTool(request);
      results.push(result);
      totalCost += result.costUsd;

      if (!result.success && !options?.continueOnError) {
        // Fill remaining with skipped results
        const remaining = requests.length - results.length;
        for (let i = 0; i < remaining; i++) {
          results.push({
            success: false,
            output: null,
            toolName: "skipped",
            durationMs: 0,
            costUsd: 0,
            approvalRequired: false,
            error: "Skipped due to previous failure",
            riskLevel: "LOW",
          });
        }
        break;
      }
    }
  }

  return {
    results,
    totalCost,
    totalDuration: Date.now() - startTime,
  };
}

// ─────────────────────────────────────────────
//  Retry Logic
// ─────────────────────────────────────────────

interface ExecutionResult {
  success: boolean;
  output: unknown;
  error?: string;
  durationMs: number;
}

async function executeWithRetry(
  handler: (input: Record<string, unknown>, ctx: import("./tool-handlers").ToolHandlerContext) => Promise<import("./tool-handlers").ToolHandlerResult>,
  tool: ToolDef,
  request: ToolExecuteRequest,
  timeoutMs: number,
  maxRetries: number,
): Promise<ExecutionResult> {
  let lastError = "";
  const totalAttempts = maxRetries + 1;

  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    const attemptStart = Date.now();

    try {
      // Execute with timeout
      const result = await withTimeout(
        handler(request.input, {
          userId: request.userId,
          projectId: request.projectId,
          missionId: request.missionId,
          taskId: request.taskId,
          agentName: request.agentName,
          timeoutMs,
        }),
        timeoutMs,
      );

      const durationMs = Date.now() - attemptStart;

      if (result.success) {
        return {
          success: true,
          output: result.output,
          durationMs,
        };
      }

      // Handler returned failure — check if retryable
      lastError = result.error || "Handler returned failure";
      if (!tool.retryable || attempt >= maxRetries) {
        return {
          success: false,
          output: null,
          error: lastError,
          durationMs,
        };
      }

      // Wait before retry
      await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
    } catch (error) {
      const durationMs = Date.now() - attemptStart;
      lastError = error instanceof Error ? error.message : String(error);

      // Check if timeout
      if (lastError.includes("timeout") || lastError.includes("Timeout")) {
        console.warn(`[tool-executor] Tool "${tool.name}" timed out (attempt ${attempt + 1}/${totalAttempts})`);
      }

      if (attempt >= maxRetries) {
        return {
          success: false,
          output: null,
          error: `Tool execution failed after ${totalAttempts} attempt(s): ${lastError}`,
          durationMs,
        };
      }

      // Wait before retry with exponential backoff
      await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
    }
  }

  return {
    success: false,
    output: null,
    error: lastError || "Unknown error",
    durationMs: 0,
  };
}

// ─────────────────────────────────────────────
//  Timeout Wrapper
// ─────────────────────────────────────────────

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  if (timeoutMs <= 0) return promise;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Tool execution timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

// ─────────────────────────────────────────────
//  Logging
// ─────────────────────────────────────────────

async function logToolExecution(
  request: ToolExecuteRequest,
  tool: ToolDef | null,
  status: "success" | "failed" | "skipped",
  durationMs: number,
  error?: string,
  output?: Record<string, unknown>,
): Promise<void> {
  try {
    // Sanitize output for logging (remove large values)
    const sanitizedOutput = output
      ? sanitizeForLog(output)
      : undefined;

    await logToolCall({
      provider: "mianx",
      toolName: request.toolName,
      agentName: request.agentName,
      projectId: request.projectId,
      userId: request.userId,
      input: sanitizeForLog(request.input),
      output: sanitizedOutput,
      status: status === "success" ? "success" : status === "failed" ? "failed" : "skipped",
      durationMs,
    });

    // Also log to mission events if this is part of a mission
    if (request.missionId && tool) {
      try {
        const { logMissionEvent } = await import("./mission-engine");
        await logMissionEvent(request.missionId, {
          eventType: status === "success" ? "TASK_COMPLETED" : "TASK_FAILED",
          title: `Tool ${status}: ${tool.displayName}`,
          description: error || `Tool "${tool.displayName}" executed successfully in ${durationMs}ms`,
          taskId: request.taskId || undefined,
          level: status === "success" ? "info" : "error",
          metadata: {
            toolName: tool.name,
            toolCategory: tool.category,
            riskLevel: tool.riskLevel,
            costUsd: tool.costPerCall,
            durationMs,
            agentName: request.agentName,
          },
        });
      } catch {
        // ignore mission event logging failures
      }
    }
  } catch (e) {
    console.error("[tool-executor] Logging error:", e);
  }
}

function sanitizeForLog(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string" && value.length > 300) {
      sanitized[key] = value.slice(0, 300) + "... [truncated]";
    } else if (typeof value === "object" && value !== null) {
      try {
        const jsonStr = JSON.stringify(value);
        sanitized[key] = jsonStr.length > 300 ? jsonStr.slice(0, 300) + "..." : jsonStr;
      } catch {
        sanitized[key] = "[object]";
      }
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
