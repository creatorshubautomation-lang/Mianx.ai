// Mianx.ai — Real AI Agent Service
// Uses z-ai-web-dev-sdk to provide actual LLM responses
// Each agent has its own system prompt that defines its specialty

import ZAI from "z-ai-web-dev-sdk";
import { AGENT_CATALOG, type AgentDefinition } from "@/lib/agents";

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZai() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// Find agent definition by name
export function findAgent(name: string): AgentDefinition | undefined {
  return AGENT_CATALOG.find((a) => a.name === name);
}

// ─────────────────────────────────────────────
//  Chat with a specific agent (non-streaming)
// ─────────────────────────────────────────────
export async function chatWithAgent(
  agentName: string,
  userMessage: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[] = [],
): Promise<string> {
  const agent = findAgent(agentName);
  if (!agent) {
    throw new Error(`Agent "${agentName}" not found`);
  }

  const zai = await getZai();

  const messages: { role: "system" | "user" | "assistant"; content: string }[] =
    [
      { role: "system", content: agent.systemPrompt },
      ...conversationHistory.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: userMessage },
    ];

  const response = await zai.chat.completions.create({
    messages,
    temperature: 0.7,
    max_tokens: 2000,
  });

  return response.choices[0]?.message?.content || "";
}

// ─────────────────────────────────────────────
//  Stream chat with agent (for real-time UX)
// ─────────────────────────────────────────────
export async function streamChatWithAgent(
  agentName: string,
  userMessage: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[] = [],
  onToken: (token: string) => void,
): Promise<string> {
  const agent = findAgent(agentName);
  if (!agent) {
    throw new Error(`Agent "${agentName}" not found`);
  }

  const zai = await getZai();

  const messages: { role: "system" | "user" | "assistant"; content: string }[] =
    [
      { role: "system", content: agent.systemPrompt },
      ...conversationHistory.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: userMessage },
    ];

  const stream = await zai.chat.completions.create({
    messages,
    temperature: 0.7,
    max_tokens: 2000,
    stream: true,
  });

  let fullText = "";
  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content || "";
    if (token) {
      fullText += token;
      onToken(token);
    }
  }

  return fullText;
}

// ─────────────────────────────────────────────
//  Analyze project brief & assign right agents
// ─────────────────────────────────────────────
export async function analyzeProjectBrief(
  projectTitle: string,
  projectDescription: string,
  projectType: string,
): Promise<{
  recommendedAgents: string[];
  estimatedTimeline: string;
  suggestedTasks: { title: string; description: string; agent: string }[];
  summary: string;
}> {
  const zai = await getZai();

  const prompt = `You are a senior project manager at Mianx.ai, an agentic software house. Analyze this project brief and recommend the right agent team.

PROJECT TITLE: ${projectTitle}
PROJECT TYPE: ${projectType}
DESCRIPTION: ${projectDescription}

Available agents (by name):
${AGENT_CATALOG.map((a) => `- ${a.name} (${a.role}, ${a.team})`).join("\n")}

Respond in EXACTLY this JSON format (no markdown, no code fences):
{
  "recommendedAgents": ["AgentName1", "AgentName2"],
  "estimatedTimeline": "e.g. 2-3 weeks",
  "suggestedTasks": [
    {"title": "Task title", "description": "What needs to be done", "agent": "AgentName"}
  ],
  "summary": "One paragraph summary of approach"
}`;

  const response = await zai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    max_tokens: 1500,
  });

  const content = response.choices[0]?.message?.content || "{}";

  // Strip code fences if present
  const cleaned = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    return {
      recommendedAgents: ["Zen", "Lyra"],
      estimatedTimeline: "2-3 weeks",
      suggestedTasks: [],
      summary: "Project analyzed. Agent team assigned.",
    };
  }
}

// ─────────────────────────────────────────────
//  Generate a deliverable (code/doc/design spec)
// ─────────────────────────────────────────────
export async function generateDeliverable(
  agentName: string,
  taskDescription: string,
  projectContext: string,
): Promise<{ title: string; content: string; fileType: string }> {
  const agent = findAgent(agentName);
  if (!agent) {
    throw new Error(`Agent "${agentName}" not found`);
  }

  const zai = await getZai();

  const prompt = `Project context: ${projectContext}

Task: ${taskDescription}

As ${agent.name} (${agent.role}), produce a complete, production-ready deliverable. Include all necessary code, specifications, or content. Be thorough and specific.`;

  const response = await zai.chat.completions.create({
    messages: [
      { role: "system", content: agent.systemPrompt },
      { role: "user", content: prompt },
    ],
    temperature: 0.5,
    max_tokens: 3000,
  });

  const content = response.choices[0]?.message?.content || "";

  // Determine file type based on agent team
  const fileTypeMap: Record<string, string> = {
    DESIGN: "design",
    DEVELOPMENT: "code",
    CONTENT: "document",
    MARKETING: "document",
    QA: "report",
    SUPPORT: "document",
  };

  return {
    title: `${agent.role} Deliverable — ${taskDescription.slice(0, 50)}`,
    content,
    fileType: fileTypeMap[agent.team] || "document",
  };
}

// ─────────────────────────────────────────────
//  Auto-respond to client message from any agent
//  (used for project chat where multiple agents participate)
// ─────────────────────────────────────────────
export async function autoAgentResponse(
  agentName: string,
  userMessage: string,
  projectContext: string,
): Promise<string> {
  const agent = findAgent(agentName);
  if (!agent) {
    throw new Error(`Agent "${agentName}" not found`);
  }

  const zai = await getZai();

  const messages: { role: "system" | "user"; content: string }[] = [
    {
      role: "system",
      content: `${agent.systemPrompt}

You are currently working on a project for a Mianx.ai client. Project context:
${projectContext}

Respond to the client's message. Be helpful, specific, and within your expertise as ${agent.name} (${agent.role}). If the question is outside your scope, briefly say so and suggest which teammate should handle it.`,
    },
    { role: "user", content: userMessage },
  ];

  const response = await zai.chat.completions.create({
    messages,
    temperature: 0.6,
    max_tokens: 1200,
  });

  return response.choices[0]?.message?.content || "";
}
