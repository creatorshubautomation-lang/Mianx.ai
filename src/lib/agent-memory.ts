// Mianx.ai — Agent Memory System (D3 + Phase 4)
//
// Phase 4 upgrades:
//   1. LLM-based memory extraction (replaces hardcoded regex)
//   2. Client-level memory (cross-project preferences)
//   3. Relevance cutoff for long chat histories
//   4. Background extraction (fire-and-forget, non-blocking)
//
// Memory hierarchy:
//   - AgentMemory: per-project, per-agent memories (can also have clientId for cross-project)
//   - ClientMemory: per-client, cross-project memories (high-confidence only)

import { db } from "@/lib/db";
import { callAIWithFallback } from "@/lib/ai-service";

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

interface MemoryEntry {
  projectId: string;
  agentId: string;
  clientId?: string;
  memoryType: "preference" | "decision" | "feedback" | "fact";
  key: string;
  value: string;
  confidence?: number;
  source?: "regex" | "llm";
}

interface ExtractedMemory {
  memoryType: "preference" | "decision" | "feedback" | "fact";
  key: string;
  value: string;
  confidence: number;
}

// ─────────────────────────────────────────────
//  Save a memory (upsert — update if exists)
// ─────────────────────────────────────────────

export async function saveMemory(entry: MemoryEntry): Promise<void> {
  try {
    await db.agentMemory.upsert({
      where: {
        projectId_agentId_key: {
          projectId: entry.projectId,
          agentId: entry.agentId,
          key: entry.key,
        },
      },
      create: {
        projectId: entry.projectId,
        agentId: entry.agentId,
        clientId: entry.clientId || null,
        memoryType: entry.memoryType,
        key: entry.key,
        value: entry.value,
        confidence: entry.confidence ?? 1.0,
        source: entry.source || "regex",
      },
      update: {
        value: entry.value,
        memoryType: entry.memoryType,
        confidence: entry.confidence ?? 1.0,
        source: entry.source || "regex",
        clientId: entry.clientId || null,
        updatedAt: new Date(),
      },
    });
  } catch (e) {
    console.error("[memory] save error:", e);
  }
}

// ─────────────────────────────────────────────
//  Phase 4: Save to client-level memory
//  Promotes high-confidence project memories to cross-project
// ─────────────────────────────────────────────

export async function promoteToClientMemory(
  userId: string,
  memoryType: string,
  key: string,
  value: string,
  confidence: number,
  sourceProjectId: string,
): Promise<void> {
  try {
    await db.clientMemory.upsert({
      where: {
        userId_key: {
          userId,
          key,
        },
      },
      create: {
        userId,
        memoryType,
        key,
        value,
        confidence,
        sourceProjectId,
      },
      update: {
        value,
        confidence: Math.max(confidence, 0.5), // keep higher confidence
        updatedAt: new Date(),
      },
    });
  } catch (e) {
    console.error("[memory] client memory save error:", e);
  }
}

// ─────────────────────────────────────────────
//  Get all memories for a project
// ─────────────────────────────────────────────

export async function getProjectMemories(
  projectId: string,
): Promise<{ agentId: string; key: string; value: string; memoryType: string; source?: string }[]> {
  try {
    const memories = await db.agentMemory.findMany({
      where: { projectId },
      select: {
        agentId: true,
        key: true,
        value: true,
        memoryType: true,
        source: true,
      },
    });
    return memories;
  } catch (e) {
    console.error("[memory] get error:", e);
    return [];
  }
}

// ─────────────────────────────────────────────
//  Phase 4: Get client-level memories (cross-project)
// ─────────────────────────────────────────────

export async function getClientMemories(
  userId: string,
): Promise<{ key: string; value: string; memoryType: string }[]> {
  try {
    const memories = await db.clientMemory.findMany({
      where: { userId },
      select: {
        key: true,
        value: true,
        memoryType: true,
      },
      orderBy: { confidence: "desc" },
    });
    return memories;
  } catch (e) {
    console.error("[memory] client memory get error:", e);
    return [];
  }
}

// ─────────────────────────────────────────────
//  Build memory context string for AI prompts
//  Phase 4: Now includes client-level memories
// ─────────────────────────────────────────────

export async function getMemoryContext(
  projectId: string,
  userId?: string,
): Promise<string> {
  const projectMemories = await getProjectMemories(projectId);

  // Phase 4: Also fetch client-level memories if userId provided
  let clientMemories: { key: string; value: string; memoryType: string }[] = [];
  if (userId) {
    clientMemories = await getClientMemories(userId);
  }

  const hasProjectMemories = projectMemories.length > 0;
  const hasClientMemories = clientMemories.length > 0;

  if (!hasProjectMemories && !hasClientMemories) {
    return "";
  }

  let context = "\n\n## CLIENT PREFERENCES & MEMORY";

  if (hasClientMemories) {
    const clientLines = clientMemories.map(
      (m) => `- ${m.key}: ${m.value} (${m.memoryType}, cross-project)`,
    );
    context += `\n\nCross-project preferences (learned from previous projects):\n${clientLines.join("\n")}`;
  }

  if (hasProjectMemories) {
    const projectLines = projectMemories.map(
      (m) => `- ${m.key}: ${m.value} (${m.memoryType})`,
    );
    context += `\n\nProject-specific preferences:\n${projectLines.join("\n")}`;
  }

  context += "\n\nIMPORTANT: Use these memories to maintain consistency. If the client mentioned a preference, honor it unless they explicitly change it.";

  return context;
}

// ─────────────────────────────────────────────
//  Phase 4: LLM-based memory extraction
//  Replaces hardcoded regex with structured-output LLM call
// ─────────────────────────────────────────────

const MEMORY_EXTRACTION_PROMPT = `You are a memory extraction system for an AI software house. Analyze the user's message and extract any preferences, decisions, feedback, or facts that would be useful to remember for future interactions.

Return ONLY a valid JSON array. No markdown, no explanation.
If no useful memories are found, return: []

JSON format:
[
  {"memoryType": "preference|decision|feedback|fact", "key": "short_key", "value": "extracted_value", "confidence": 0.0-1.0}
]

Rules:
1. Only extract meaningful, actionable information (not greetings, filler, or noise)
2. Keys should be short, descriptive identifiers (e.g., "writing_style", "preferred_color", "budget")
3. Values should be the actual extracted content (e.g., "concise/punchy", "blue", "$5000")
4. Confidence: 0.9+ for explicit statements ("I want X"), 0.7-0.8 for implied preferences, 0.5-0.6 for guesses
5. Do NOT extract facts that are specific to only this conversation (e.g., "current project name")
6. DO extract cross-project preferences (e.g., writing style, design taste, tech preferences)
7. Maximum 5 memories per message — prioritize the most important ones`;

/**
 * Phase 4: Extract memories using LLM structured output.
 * Falls back to regex extraction if LLM call fails.
 * Uses fast-tier model to minimize cost and latency.
 */
export async function extractMemoriesFromMessage(
  projectId: string,
  agentId: string,
  userMessage: string,
  userId?: string,
): Promise<void> {
  // Skip very short messages — unlikely to contain useful memories
  if (userMessage.length < 15) return;

  // Skip if message is just a code block or very technical (unlikely to have preferences)
  const codeBlockCount = (userMessage.match(/```/g) || []).length;
  if (codeBlockCount >= 2 && userMessage.length > 500) {
    // Mostly code — still extract any preferences around it
    // but don't make a dedicated LLM call for this
    await extractMemoriesFromRegex(projectId, agentId, userMessage, userId);
    return;
  }

  try {
    // Phase 4: LLM-based extraction (primary method)
    const response = await callAIWithFallback({
      messages: [
        {
          role: "system",
          content: MEMORY_EXTRACTION_PROMPT,
        },
        {
          role: "user",
          content: `Extract memories from this client message:\n\n"${userMessage}"`,
        },
      ],
      agentName: "MemoryExtractor",
      projectId,
      userId,
      endpoint: "chat", // fast tier — extraction doesn't need premium reasoning
      temperature: 0.1, // very low for structured output consistency
      maxTokens: 300,
    });

    const memories = parseMemoryExtraction(response);

    if (memories.length > 0) {
      // Save each extracted memory
      for (const mem of memories) {
        // Skip low-confidence memories (< 0.5)
        if (mem.confidence < 0.5) continue;

        // Skip keys that are too generic or too long
        if (mem.key.length > 50 || mem.key.length < 2) continue;
        if (mem.value.length > 200) continue;

        await saveMemory({
          projectId,
          agentId,
          clientId: userId,
          memoryType: mem.memoryType,
          key: mem.key,
          value: mem.value,
          confidence: mem.confidence,
          source: "llm",
        });

        // Phase 4: Promote high-confidence memories to client-level
        if (userId && mem.confidence >= 0.8) {
          // Only promote preferences (not project-specific facts)
          if (mem.memoryType === "preference") {
            await promoteToClientMemory(
              userId,
              mem.memoryType,
              mem.key,
              mem.value,
              mem.confidence,
              projectId,
            );
          }
        }
      }

      // Log successful LLM extraction to tool calls
      try {
        const { logToolCall } = await import("@/lib/tool-logger");
        await logToolCall({
          provider: "memory_extractor",
          toolName: "memory_extraction_llm",
          agentName: "MemoryExtractor",
          projectId,
          userId,
          input: { messageLength: userMessage.length },
          output: { memoriesExtracted: memories.length, keys: memories.map((m) => m.key) },
          status: "success",
        });
      } catch {
        // logging best-effort
      }

      return; // LLM extraction succeeded — skip regex fallback
    }
  } catch (e) {
    console.error("[memory] LLM extraction failed, falling back to regex:", e);
  }

  // Fallback: use old regex extraction
  await extractMemoriesFromRegex(projectId, agentId, userMessage, userId);
}

/**
 * Parse LLM JSON response into ExtractedMemory array.
 * Handles: markdown code blocks, partial JSON, empty arrays.
 */
function parseMemoryExtraction(llmResponse: string): ExtractedMemory[] {
  try {
    let jsonStr = llmResponse.trim();

    // Strip markdown code fences
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    // Find JSON array
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) jsonStr = arrayMatch[0];

    const parsed = JSON.parse(jsonStr);

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((m: Record<string, unknown>) =>
        m.memoryType && m.key && m.value && typeof m.confidence === "number"
      )
      .map((m: Record<string, unknown>) => ({
        memoryType: m.memoryType as "preference" | "decision" | "feedback" | "fact",
        key: String(m.key).toLowerCase().replace(/\s+/g, "_"),
        value: String(m.value),
        confidence: Math.min(1.0, Math.max(0.0, Number(m.confidence))),
      }));
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────
//  Legacy regex extraction (now a fallback)
// ─────────────────────────────────────────────

async function extractMemoriesFromRegex(
  projectId: string,
  agentId: string,
  userMessage: string,
  userId?: string,
): Promise<void> {
  const lower = userMessage.toLowerCase();

  let extracted = false;

  // Color preferences
  const colorMatch = lower.match(
    /(?:i (?:like|prefer|want|love)|use|choose)\s+(?:the\s+)?(?:color\s+)?(red|blue|green|yellow|purple|pink|orange|cyan|teal|black|white|gray|grey|navy|violet|indigo|emerald|rose|amber)/,
  );
  if (colorMatch) {
    await saveMemory({
      projectId,
      agentId,
      clientId: userId,
      memoryType: "preference",
      key: "preferred_color",
      value: colorMatch[1],
      source: "regex",
    });
    if (userId) {
      await promoteToClientMemory(userId, "preference", "preferred_color", colorMatch[1], 0.9, projectId);
    }
    extracted = true;
  }

  // Brand voice
  const voiceMatch = lower.match(
    /(?:tone|voice|style)\s+(?:should be|is|must be)\s+(professional|casual|friendly|formal|playful|serious|minimalist|modern|traditional)/,
  );
  if (voiceMatch) {
    await saveMemory({
      projectId,
      agentId,
      clientId: userId,
      memoryType: "preference",
      key: "brand_voice",
      value: voiceMatch[1],
      source: "regex",
    });
    if (userId) {
      await promoteToClientMemory(userId, "preference", "brand_voice", voiceMatch[1], 0.9, projectId);
    }
    extracted = true;
  }

  // Tech stack preferences
  const techMatch = lower.match(
    /(?:use|using|prefer|want)\s+(react|next\.?js|vue|angular|python|django|flask|node|express|go|rust|java|spring|php|laravel)/,
  );
  if (techMatch) {
    await saveMemory({
      projectId,
      agentId,
      clientId: userId,
      memoryType: "preference",
      key: "preferred_tech",
      value: techMatch[1],
      source: "regex",
    });
    extracted = true; // Don't promote tech — may be project-specific
  }

  // Font preferences
  const fontMatch = lower.match(
    /(?:font|typography)\s+(?:should be|is|use)\s+(serif|sans-serif|monospace|inter|roboto|arial|helvetica|poppins|montserrat)/,
  );
  if (fontMatch) {
    await saveMemory({
      projectId,
      agentId,
      clientId: userId,
      memoryType: "preference",
      key: "preferred_font",
      value: fontMatch[1],
      source: "regex",
    });
    if (userId) {
      await promoteToClientMemory(userId, "preference", "preferred_font", fontMatch[1], 0.9, projectId);
    }
    extracted = true;
  }

  // Budget
  const budgetMatch = lower.match(/(?:budget|max|spend)\s*:?\s*\$?(\d+)/);
  if (budgetMatch) {
    await saveMemory({
      projectId,
      agentId,
      clientId: userId,
      memoryType: "fact",
      key: "budget",
      value: `$${budgetMatch[1]}`,
      source: "regex",
    });
    extracted = true; // Budget is project-specific, don't promote
  }

  // Deadline
  const deadlineMatch = lower.match(
    /(?:deadline|due|by|before)\s*:?\s*(today|tomorrow|next week|next month|\d+\s+days?|\d+\s+weeks?|\d+\s+months?)/,
  );
  if (deadlineMatch) {
    await saveMemory({
      projectId,
      agentId,
      clientId: userId,
      memoryType: "fact",
      key: "deadline",
      value: deadlineMatch[1],
      source: "regex",
    });
    extracted = true; // Deadline is project-specific
  }

  if (extracted) {
    try {
      const { logToolCall } = await import("@/lib/tool-logger");
      await logToolCall({
        provider: "memory_extractor",
        toolName: "memory_extraction_regex",
        agentName: "MemoryExtractor",
        projectId,
        userId,
        input: { messageLength: userMessage.length },
        output: { method: "regex_fallback" },
        status: "success",
      });
    } catch {
      // logging best-effort
    }
  }
}

// ─────────────────────────────────────────────
//  Phase 4: Background memory extraction
//  Fire-and-forget after chat message save.
//  Returns immediately — extraction happens async.
// ─────────────────────────────────────────────

export function extractMemoriesInBackground(
  projectId: string,
  agentId: string,
  userMessage: string,
  userId?: string,
): void {
  // Fire-and-forget: don't await, don't block the chat response
  // Using setImmediate to yield to the event loop first
  setImmediate(() => {
    extractMemoriesFromMessage(projectId, agentId, userMessage, userId).catch((e) => {
      console.error("[memory] background extraction error:", e);
    });
  });
}

// ─────────────────────────────────────────────
//  Phase 4: Chat history relevance cutoff
//  For projects with long chat histories, stop stuffing
//  the entire history into every prompt.
// ─────────────────────────────────────────────

export interface ChatHistoryContext {
  messages: { role: string; content: string }[];
  totalMessages: number;
  includedMessages: number;
  truncated: boolean;
  memorySummary: string;
}

/**
 * Build a relevance-limited chat history for prompts.
 * Instead of stuffing ALL messages, use:
 *   - Most recent N messages (configurable, default 20)
 *   - A memory summary of older messages (if available)
 *
 * This prevents token explosion on long projects.
 */
export async function getRelevantChatHistory(
  projectId: string,
  maxMessages: number = 20,
): Promise<ChatHistoryContext> {
  try {
    const allMessages = await db.message.findMany({
      where: { projectId },
      select: {
        role: true,
        content: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const totalMessages = allMessages.length;

    if (totalMessages <= maxMessages) {
      return {
        messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
        totalMessages,
        includedMessages: totalMessages,
        truncated: false,
        memorySummary: "",
      };
    }

    // Take the most recent maxMessages
    const recentMessages = allMessages.slice(-maxMessages);

    // Build a brief summary of older messages
    const olderMessages = allMessages.slice(0, -maxMessages);
    const memorySummary = summarizeOlderMessages(olderMessages);

    return {
      messages: recentMessages.map((m) => ({ role: m.role, content: m.content })),
      totalMessages,
      includedMessages: recentMessages.length,
      truncated: true,
      memorySummary,
    };
  } catch (e) {
    console.error("[memory] chat history error:", e);
    return {
      messages: [],
      totalMessages: 0,
      includedMessages: 0,
      truncated: false,
      memorySummary: "",
    };
  }
}

/**
 * Build a lightweight summary of older messages.
 * Not a full LLM summary — just counts and key topics
 * to give the agent context without blowing up tokens.
 */
function summarizeOlderMessages(messages: { role: string; content: string }[]): string {
  if (messages.length === 0) return "";

  const userMessages = messages.filter((m) => m.role === "user");
  const agentMessages = messages.filter((m) => m.role === "agent");

  // Extract first ~50 chars of each user message as topic hints
  const topicHints = userMessages
    .slice(-10) // last 10 older user messages
    .map((m) => m.content.slice(0, 80).replace(/\n/g, " "))
    .join("; ");

  return `[Earlier conversation summary: ${messages.length} messages (${userMessages.length} client, ${agentMessages.length} agent). Recent topics discussed: ${topicHints}]`;
}
