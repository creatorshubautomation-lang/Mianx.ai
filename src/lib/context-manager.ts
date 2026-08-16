// Mianx.ai — Phase 6: Context Window Manager
//
// The Context Window Manager prevents token overflow during long Agent Loop
// executions by intelligently managing the conversation history. Without this,
// the ReAct loop would quickly exceed token limits as iterations accumulate.
//
// Strategies:
//   1. Priority-based retention — keep recent and important messages
//   2. Sliding window — keep last N messages
//   3. Summarization — compress old messages into a summary
//   4. Token budget enforcement — never exceed configured token limit
//   5. Message importance scoring — system msgs + final outputs rank highest

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

export interface ContextMessage {
  role: "system" | "user" | "assistant";
  content: string;
  importance?: number; // 0-100, higher = more important to keep
  createdAt?: number; // timestamp for ordering
}

export interface ContextWindow {
  messages: ContextMessage[];
  systemPrompt: string;
  maxTokens: number;
}

export interface ContextSummary {
  summary: string;
  originalMessageCount: number;
  compressedMessageCount: number;
  tokensSaved: number;
  keyPoints: string[];
}

// ─────────────────────────────────────────────
//  Configuration
// ─────────────────────────────────────────────

const PRESERVE_RECENT_COUNT = 6; // Always keep last N messages intact
const MIN_SUMMARY_TOKENS = 200; // Minimum tokens for a useful summary
const MAX_SUMMARY_TOKENS = 1500; // Maximum tokens for the summary
const IMPORTANCE_THRESHOLD = 70; // Messages above this importance are always preserved

// ─────────────────────────────────────────────
//  Token Estimation
// ─────────────────────────────────────────────

export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Rough estimate: ~4 chars per token for English, ~2 for CJK
  // Using 3.5 as a middle ground
  return Math.ceil(text.length / 3.5);
}

export function estimateMessageTokens(messages: ContextMessage[]): number {
  return messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
}

// ─────────────────────────────────────────────
//  Importance Scoring
// ─────────────────────────────────────────────

/**
 * Score a message's importance for retention.
 * Higher scores = more likely to be preserved during summarization.
 */
function scoreMessageImportance(msg: ContextMessage, index: number, total: number): number {
  let score = 50; // Base score

  // System messages are always important
  if (msg.role === "system") score += 30;

  // Recent messages are more important
  const recencyFactor = index / total; // 0 = oldest, 1 = newest
  score += Math.round(recencyFactor * 20);

  // Messages with tool results are important
  if (msg.content.includes("[TOOL RESULT]")) score += 15;

  // Messages with final outputs are very important
  if (msg.content.includes("[FINAL]")) score += 25;

  // Reflection messages carry quality assessments
  if (msg.content.includes("[REFLECT]")) score += 10;

  // Longer messages tend to have more information
  const length = estimateTokens(msg.content);
  if (length > 500) score += 5;
  if (length > 1000) score += 5;

  // System-level messages (budget, approval) are important
  if (msg.content.includes("[SYSTEM]")) score += 15;

  return Math.min(score, 100);
}

// ─────────────────────────────────────────────
//  Context Summarization
// ─────────────────────────────────────────────

/**
 * Summarize a list of context messages into a compact representation.
 * Uses simple extraction-based summarization (no LLM call needed).
 */
function summarizeMessages(messages: ContextMessage[]): ContextSummary {
  if (messages.length === 0) {
    return { summary: "", originalMessageCount: 0, compressedMessageCount: 0, tokensSaved: 0, keyPoints: [] };
  }

  const originalTokens = estimateMessageTokens(messages);

  // Extract key points from messages
  const keyPoints: string[] = [];

  for (const msg of messages) {
    // Extract action items from [ACT] messages
    const actMatches = msg.content.match(/\[ACT\]\s*(\w+)/g);
    if (actMatches) {
      keyPoints.push(`Actions taken: ${actMatches.map((m) => m.replace("[ACT] ", "")).join(", ")}`);
    }

    // Extract reflection scores
    const reflectScore = msg.content.match(/\[REFLECT\]\s*score\s*:\s*(\d+)/);
    if (reflectScore) {
      keyPoints.push(`Quality assessment: ${reflectScore[1]}/100`);
    }

    // Extract final outputs (but not the full content)
    if (msg.content.includes("[FINAL]") && !msg.content.includes("[SYSTEM]")) {
      const finalContent = msg.content.replace(/\[FINAL\]\s*/, "").trim();
      keyPoints.push(`Final output produced (${estimateTokens(finalContent)} tokens)`);
    }

    // Extract tool results summary
    const toolResults = msg.content.match(/\[TOOL RESULT\]\s*(SUCCESS|FAILED)/g);
    if (toolResults) {
      keyPoints.push(`Tool results: ${toolResults.map((r) => r.replace("[TOOL RESULT] ", "")).join(", ")}`);
    }
  }

  // Build summary
  const summaryParts: string[] = [];
  if (keyPoints.length > 0) {
    summaryParts.push("## Previous Iteration Summary:");
    summaryParts.push(...keyPoints);
  }

  // Include the last think/observation for continuity
  const lastThink = [...messages].reverse().find((m) =>
    m.role === "assistant" && (m.content.includes("[THINK]") || m.content.includes("[OBSERVE]"))
  );
  if (lastThink) {
    const cleanContent = lastThink.content.replace(/\[(THINK|OBSERVE)\]\s*/i, "").trim();
    if (cleanContent.length > 50) {
      summaryParts.push(`\n## Last reasoning: ${cleanContent.slice(0, 500)}${cleanContent.length > 500 ? "..." : ""}`);
    }
  }

  const summary = summaryParts.join("\n");
  const summaryTokens = estimateTokens(summary);

  return {
    summary,
    originalMessageCount: messages.length,
    compressedMessageCount: 1,
    tokensSaved: originalTokens - summaryTokens,
    keyPoints,
  };
}

// ─────────────────────────────────────────────
//  Main Context Manager API
// ─────────────────────────────────────────────

/**
 * Summarize the context window to fit within token budget.
 * Strategy:
 *   1. Calculate current token usage
 *   2. If within budget, return null (no changes needed)
 *   3. If over budget:
 *      a. Separate messages into: recent (preserve), important (preserve), old (summarize)
 *      b. Summarize old messages
 *      c. Return new message list with summary + preserved messages
 *
 * Returns null if no summarization was needed.
 */
export function summarizeContext(
  contextWindow: ContextWindow,
): { messages: ContextMessage[]; summary?: ContextSummary } | null {
  const currentTokens = estimateMessageTokens(contextWindow.messages);

  // If within budget, no need to summarize
  if (currentTokens <= contextWindow.maxTokens) {
    return null;
  }

  const messages = contextWindow.messages;
  const total = messages.length;

  if (total <= PRESERVE_RECENT_COUNT) {
    return null; // Not enough messages to summarize meaningfully
  }

  // Split messages into: old (to summarize) and recent (to preserve)
  const splitIndex = Math.max(0, total - PRESERVE_RECENT_COUNT);
  const oldMessages = messages.slice(0, splitIndex);
  const recentMessages = messages.slice(splitIndex);

  // Among old messages, identify high-importance ones to preserve
  const importantOld: ContextMessage[] = [];
  const toSummarize: ContextMessage[] = [];

  for (const msg of oldMessages) {
    const importance = scoreMessageImportance(msg, oldMessages.indexOf(msg), oldMessages.length);
    if (importance >= IMPORTANCE_THRESHOLD) {
      importantOld.push({ ...msg, importance });
    } else {
      toSummarize.push(msg);
    }
  }

  // If nothing to summarize, no changes needed
  if (toSummarize.length === 0) {
    return null;
  }

  // Summarize the old messages
  const summary = summarizeMessages(toSummarize);

  // Build new message list: summary + important old + recent
  const newMessages: ContextMessage[] = [];

  if (summary.summary) {
    newMessages.push({
      role: "user",
      content: `[CONTEXT SUMMARY — ${summary.originalMessageCount} previous messages compressed]\n${summary.summary}`,
      importance: 90, // Summary is important to keep
    });
  }

  // Add important old messages
  for (const msg of importantOld) {
    newMessages.push(msg);
  }

  // Add recent messages
  for (const msg of recentMessages) {
    newMessages.push(msg);
  }

  const newTokens = estimateMessageTokens(newMessages);

  // Verify we're within budget now
  if (newTokens > contextWindow.maxTokens) {
    // Still over budget — aggressive: keep only summary + last 3 messages
    const aggressiveMessages: ContextMessage[] = [];
    if (summary.summary) {
      aggressiveMessages.push({
        role: "user",
        content: `[CONTEXT SUMMARY]\n${summary.summary}`,
        importance: 90,
      });
    }
    aggressiveMessages.push(...messages.slice(-3));
    return { messages: aggressiveMessages, summary };
  }

  return { messages: newMessages, summary };
}

/**
 * Add a message to the context window with automatic management.
 * If adding the message would exceed the budget, trigger summarization.
 */
export function addToContext(
  contextWindow: ContextWindow,
  message: ContextMessage,
): { added: boolean; summarized: boolean } {
  const newTokens = estimateTokens(message.content);
  const currentTokens = estimateMessageTokens(contextWindow.messages);

  // Check if adding would exceed budget
  if (currentTokens + newTokens > contextWindow.maxTokens * 0.9) {
    // Trigger summarization before adding
    const result = summarizeContext(contextWindow);
    if (result) {
      contextWindow.messages = result.messages;
      return { added: true, summarized: true };
    }
  }

  contextWindow.messages.push(message);
  return { added: true, summarized: false };
}

/**
 * Get the current context utilization as a percentage.
 */
export function getContextUtilization(contextWindow: ContextWindow): number {
  const currentTokens = estimateMessageTokens(contextWindow.messages);
  return Math.round((currentTokens / contextWindow.maxTokens) * 100);
}

/**
 * Get a snapshot of the context window state for logging/debugging.
 */
export function getContextSnapshot(contextWindow: ContextWindow): {
  messageCount: number;
  estimatedTokens: number;
  utilizationPercent: number;
  systemPromptTokens: number;
  messageTokensByRole: { user: number; assistant: number; system: number };
} {
  const msgTokens = estimateMessageTokens(contextWindow.messages);
  const sysTokens = estimateTokens(contextWindow.systemPrompt);

  const byRole = { user: 0, assistant: 0, system: 0 };
  for (const msg of contextWindow.messages) {
    byRole[msg.role] += estimateTokens(msg.content);
  }

  return {
    messageCount: contextWindow.messages.length,
    estimatedTokens: msgTokens + sysTokens,
    utilizationPercent: Math.round(((msgTokens + sysTokens) / contextWindow.maxTokens) * 100),
    systemPromptTokens: sysTokens,
    messageTokensByRole: byRole,
  };
}
