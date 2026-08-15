// Mianx.ai — Agent Tool Call Logger
//
// Provides a typed helper for logging tool invocations (code_verify,
// web_search, etc.) to the AgentToolCall table. Every tool call that
// exercises a real capability (as opposed to a plain LLM text response)
// should be logged through this module so the admin dashboard can
// show tool-call counts alongside raw LLM-call counts.

import { db } from "@/lib/db";

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

export interface ToolCallLog {
  provider: string; // "zai" | "gemini" | "groq" | "openai" | "anthropic"
  toolName: string; // "code_verify" | "web_search" | ...
  agentName?: string;
  projectId?: string;
  userId?: string;
  input?: Record<string, unknown>; // tool input params
  output?: Record<string, unknown>; // tool result
  status: "success" | "failed" | "skipped";
  durationMs?: number;
}

// ─────────────────────────────────────────────
//  Log helper
// ─────────────────────────────────────────────

/**
 * Persist a tool call record to the AgentToolCall table.
 * Best-effort — logging failures are swallowed so they never
 * break the calling code path.
 */
export async function logToolCall(opts: ToolCallLog): Promise<void> {
  try {
    await db.agentToolCall.create({
      data: {
        provider: opts.provider,
        toolName: opts.toolName,
        agentName: opts.agentName,
        projectId: opts.projectId,
        userId: opts.userId,
        input: opts.input ? JSON.stringify(opts.input) : null,
        output: opts.output ? JSON.stringify(opts.output) : null,
        status: opts.status,
        durationMs: opts.durationMs,
      },
    });
  } catch (e) {
    console.error("[tool-logger] logToolCall error:", e);
    // Don't throw — logging is best-effort
  }
}

// ─────────────────────────────────────────────
//  Convenience wrappers
// ─────────────────────────────────────────────

/**
 * Execute a tool function with automatic timing and logging.
 * Usage:
 *   const result = await runTool({
 *     provider: "zai",
 *     toolName: "code_verify",
 *     agentName: "Zen",
 *     projectId: "xxx",
 *     userId: "yyy",
 *     input: { code: "..." },
 *     fn: () => verifyCode("..."),
 *   });
 */
export async function runTool<T>(opts: {
  provider: string;
  toolName: string;
  agentName?: string;
  projectId?: string;
  userId?: string;
  input?: Record<string, unknown>;
  fn: () => Promise<T>;
}): Promise<{ result: T; status: "success" | "failed"; durationMs: number }> {
  const startTime = Date.now();
  try {
    const result = await opts.fn();
    const durationMs = Date.now() - startTime;

    await logToolCall({
      provider: opts.provider,
      toolName: opts.toolName,
      agentName: opts.agentName,
      projectId: opts.projectId,
      userId: opts.userId,
      input: opts.input,
      output: typeof result === "object" && result !== null
        ? (result as Record<string, unknown>)
        : { value: result },
      status: "success",
      durationMs,
    });

    return { result, status: "success", durationMs };
  } catch (e) {
    const durationMs = Date.now() - startTime;
    const errorMessage = e instanceof Error ? e.message : String(e);

    await logToolCall({
      provider: opts.provider,
      toolName: opts.toolName,
      agentName: opts.agentName,
      projectId: opts.projectId,
      userId: opts.userId,
      input: opts.input,
      output: { error: errorMessage.slice(0, 500) },
      status: "failed",
      durationMs,
    });

    throw e;
  }
}
