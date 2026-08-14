// Mianx.ai — Agent Memory System (D3)
// Agents remember client preferences, decisions, and feedback per project

import { db } from "@/lib/db";

interface MemoryEntry {
  projectId: string;
  agentId: string;
  memoryType: "preference" | "decision" | "feedback" | "fact";
  key: string;
  value: string;
  confidence?: number;
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
        memoryType: entry.memoryType,
        key: entry.key,
        value: entry.value,
        confidence: entry.confidence ?? 1.0,
      },
      update: {
        value: entry.value,
        memoryType: entry.memoryType,
        confidence: entry.confidence ?? 1.0,
        updatedAt: new Date(),
      },
    });
  } catch (e) {
    console.error("[memory] save error:", e);
  }
}

// ─────────────────────────────────────────────
//  Get all memories for a project
// ─────────────────────────────────────────────

export async function getProjectMemories(
  projectId: string,
): Promise<{ agentId: string; key: string; value: string; memoryType: string }[]> {
  try {
    const memories = await db.agentMemory.findMany({
      where: { projectId },
      select: {
        agentId: true,
        key: true,
        value: true,
        memoryType: true,
      },
    });
    return memories;
  } catch (e) {
    console.error("[memory] get error:", e);
    return [];
  }
}

// ─────────────────────────────────────────────
//  Build memory context string for AI prompts
// ─────────────────────────────────────────────

export async function getMemoryContext(projectId: string): Promise<string> {
  const memories = await getProjectMemories(projectId);

  if (memories.length === 0) {
    return "";
  }

  const memoryLines = memories.map(
    (m) => `- ${m.key}: ${m.value} (${m.memoryType})`,
  );

  return `

## PROJECT MEMORY (Client Preferences & Decisions)
The following preferences have been noted from previous interactions:
${memoryLines.join("\n")}

IMPORTANT: Use these memories to maintain consistency. If the client mentioned a preference, honor it unless they explicitly change it.`;
}

// ─────────────────────────────────────────────
//  Extract memories from a conversation
//  (Simple keyword-based extraction)
// ─────────────────────────────────────────────

export async function extractMemoriesFromMessage(
  projectId: string,
  agentId: string,
  userMessage: string,
): Promise<void> {
  const lower = userMessage.toLowerCase();

  // Color preferences
  const colorMatch = lower.match(
    /(?:i (?:like|prefer|want|love)|use|choose)\s+(?:the\s+)?(?:color\s+)?(red|blue|green|yellow|purple|pink|orange|cyan|teal|black|white|gray|grey|navy|violet|indigo|emerald|rose|amber)/,
  );
  if (colorMatch) {
    await saveMemory({
      projectId,
      agentId,
      memoryType: "preference",
      key: "preferred_color",
      value: colorMatch[1],
    });
  }

  // Brand voice
  const voiceMatch = lower.match(
    /(?:tone|voice|style)\s+(?:should be|is|must be)\s+(professional|casual|friendly|formal|playful|serious|minimalist|modern|traditional)/,
  );
  if (voiceMatch) {
    await saveMemory({
      projectId,
      agentId,
      memoryType: "preference",
      key: "brand_voice",
      value: voiceMatch[1],
    });
  }

  // Tech stack preferences
  const techMatch = lower.match(
    /(?:use|using|prefer|want)\s+(react|next\.?js|vue|angular|python|django|flask|node|express|go|rust|java|spring|php|laravel)/,
  );
  if (techMatch) {
    await saveMemory({
      projectId,
      agentId,
      memoryType: "preference",
      key: "preferred_tech",
      value: techMatch[1],
    });
  }

  // Font preferences
  const fontMatch = lower.match(
    /(?:font|typography)\s+(?:should be|is|use)\s+(serif|sans-serif|monospace|inter|roboto|arial|helvetica|poppins|montserrat)/,
  );
  if (fontMatch) {
    await saveMemory({
      projectId,
      agentId,
      memoryType: "preference",
      key: "preferred_font",
      value: fontMatch[1],
    });
  }

  // Budget
  const budgetMatch = lower.match(/(?:budget|max|spend)\s*:?\s*\$?(\d+)/);
  if (budgetMatch) {
    await saveMemory({
      projectId,
      agentId,
      memoryType: "fact",
      key: "budget",
      value: `$${budgetMatch[1]}`,
    });
  }

  // Deadline
  const deadlineMatch = lower.match(
    /(?:deadline|due|by|before)\s*:?\s*(today|tomorrow|next week|next month|\d+\s+days?|\d+\s+weeks?|\d+\s+months?)/,
  );
  if (deadlineMatch) {
    await saveMemory({
      projectId,
      agentId,
      memoryType: "fact",
      key: "deadline",
      value: deadlineMatch[1],
    });
  }
}
