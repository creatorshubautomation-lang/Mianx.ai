// Mianx.ai — Multi-Provider AI Service
//
// Supports multiple AI providers with automatic fallback:
//   1. Tries each enabled provider in priority order
//   2. If one fails (rate limit, quota, network), tries next
//   3. Logs all calls to AiProviderUsage table for admin dashboard
//   4. Tracks cost per provider
//
// Supported providers:
//   - zai (Z.ai — GLM models, Pakistan-friendly, free credits)
//   - gemini (Google Gemini — generous free tier)
//   - groq (Groq — fast inference, free tier)
//   - openai (OpenAI — GPT models, paid)
//   - anthropic (Anthropic — Claude models, paid)
//
// All providers support OpenAI-compatible API format, so we use fetch()
// directly instead of installing separate SDKs.

import { db } from "@/lib/db";

// ─────────────────────────────────────────────
//  Provider configurations
// ─────────────────────────────────────────────

interface ProviderConfig {
  name: string;
  displayName: string;
  envKeyName: string;
  baseUrl: string;
  defaultModel: string;
  // Cost per 1M tokens (input, output) in USD
  costPer1MInput: number;
  costPer1MOutput: number;
  freeLimitUsd: number;
  priority: number;
}

const PROVIDERS: ProviderConfig[] = [
  {
    name: "zai",
    displayName: "Z.ai (GLM)",
    envKeyName: "ZAI_API_KEY",
    baseUrl: "https://api.z.ai/api/paas/v4",
    defaultModel: "glm-4-flash",
    costPer1MInput: 0.1,
    costPer1MOutput: 0.1,
    freeLimitUsd: 18, // $18 free credits on signup
    priority: 1,
  },
  {
    name: "gemini",
    displayName: "Google Gemini",
    envKeyName: "GEMINI_API_KEY",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-1.5-flash",
    costPer1MInput: 0.075,
    costPer1MOutput: 0.3,
    freeLimitUsd: 50, // generous free tier
    priority: 2,
  },
  {
    name: "groq",
    displayName: "Groq (Fast)",
    envKeyName: "GROQ_API_KEY",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.1-8b-instant",
    costPer1MInput: 0.05,
    costPer1MOutput: 0.08,
    freeLimitUsd: 20,
    priority: 3,
  },
  {
    name: "openai",
    displayName: "OpenAI (GPT)",
    envKeyName: "OPENAI_API_KEY",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    costPer1MInput: 0.15,
    costPer1MOutput: 0.6,
    freeLimitUsd: 5, // $5 free on signup
    priority: 4,
  },
  {
    name: "anthropic",
    displayName: "Anthropic (Claude)",
    envKeyName: "ANTHROPIC_API_KEY",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-3-haiku-20240307",
    costPer1MInput: 0.25,
    costPer1MOutput: 1.25,
    freeLimitUsd: 5,
    priority: 5,
  },
];

// ─────────────────────────────────────────────
//  Usage tracking
// ─────────────────────────────────────────────

interface UsageLogOptions {
  provider: string;
  endpoint: string;
  agentName?: string;
  projectId?: string;
  userId?: string;
  inputTokens?: number;
  outputTokens?: number;
  status: "success" | "failed" | "rate_limited" | "quota_exceeded";
  errorMessage?: string;
  responseTimeMs?: number;
}

async function logUsage(opts: UsageLogOptions): Promise<void> {
  try {
    const inputTokens = opts.inputTokens || 0;
    const outputTokens = opts.outputTokens || 0;
    const totalTokens = inputTokens + outputTokens;

    // Calculate cost
    const provider = PROVIDERS.find((p) => p.name === opts.provider);
    const costUsd = provider
      ? (inputTokens / 1_000_000) * provider.costPer1MInput +
        (outputTokens / 1_000_000) * provider.costPer1MOutput
      : 0;

    await db.aiProviderUsage.create({
      data: {
        provider: opts.provider,
        endpoint: opts.endpoint,
        agentName: opts.agentName,
        projectId: opts.projectId,
        userId: opts.userId,
        inputTokens,
        outputTokens,
        totalTokens,
        costUsd,
        status: opts.status,
        errorMessage: opts.errorMessage,
        responseTimeMs: opts.responseTimeMs,
      },
    });

    // Update running total in config table
    if (opts.status === "success") {
      await db.aiProviderConfig.upsert({
        where: { provider: opts.provider },
        create: {
          provider: opts.provider,
          displayName: provider?.displayName || opts.provider,
          envKeyName: provider?.envKeyName || "",
          freeLimitUsd: provider?.freeLimitUsd || 0,
          usedUsd: costUsd,
          models: JSON.stringify([provider?.defaultModel || ""]),
        },
        update: {
          usedUsd: { increment: costUsd },
        },
      });
    }
  } catch (e) {
    console.error("[ai-service] logUsage error:", e);
    // Don't throw — logging is best-effort
  }
}

// ─────────────────────────────────────────────
//  Provider call helpers
// ─────────────────────────────────────────────

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface CallProviderOptions {
  messages: ChatMessage[];
  agentName?: string;
  projectId?: string;
  userId?: string;
  endpoint?: string; // chat | analyze | deliverable
  temperature?: number;
  maxTokens?: number;
}

// Call a single provider using OpenAI-compatible format
async function callProvider(
  provider: ProviderConfig,
  opts: CallProviderOptions,
): Promise<{
  content: string;
  inputTokens: number;
  outputTokens: number;
}> {
  const apiKey = process.env[provider.envKeyName];

  if (!apiKey) {
    throw new Error(`API key not configured: ${provider.envKeyName}`);
  }

  const startTime = Date.now();
  const endpoint = opts.endpoint || "chat";

  try {
    // Use OpenAI-compatible chat completions endpoint (works for zai, groq, openai)
    let url: string;
    let body: Record<string, unknown>;
    let headers: Record<string, string>;

    if (provider.name === "gemini") {
      // Gemini has its own format
      url = `${provider.baseUrl}/models/${provider.defaultModel}:generateContent?key=${apiKey}`;
      headers = { "Content-Type": "application/json" };
      body = {
        contents: opts.messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          temperature: opts.temperature ?? 0.7,
          maxOutputTokens: opts.maxTokens ?? 2000,
        },
      };
    } else if (provider.name === "anthropic") {
      // Anthropic uses different format
      url = `${provider.baseUrl}/messages`;
      headers = {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      };
      const systemMsg = opts.messages.find((m) => m.role === "system");
      const otherMsgs = opts.messages.filter((m) => m.role !== "system");
      body = {
        model: provider.defaultModel,
        system: systemMsg?.content,
        messages: otherMsgs.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: opts.maxTokens ?? 2000,
        temperature: opts.temperature ?? 0.7,
      };
    } else {
      // OpenAI-compatible (zai, groq, openai)
      url = `${provider.baseUrl}/chat/completions`;
      headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      };
      body = {
        model: provider.defaultModel,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 2000,
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const responseTimeMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      let status: "failed" | "rate_limited" | "quota_exceeded" = "failed";

      if (response.status === 429) {
        status = "rate_limited";
      } else if (response.status === 402 || response.status === 403) {
        status = "quota_exceeded";
      }

      await logUsage({
        provider: provider.name,
        endpoint,
        agentName: opts.agentName,
        projectId: opts.projectId,
        userId: opts.userId,
        status,
        errorMessage: `HTTP ${response.status}: ${errorText.slice(0, 200)}`,
        responseTimeMs,
      });

      throw new Error(
        `${provider.name} returned ${response.status}: ${errorText.slice(0, 100)}`,
      );
    }

    const data = await response.json();

    // Extract content + usage based on provider format
    let content = "";
    let inputTokens = 0;
    let outputTokens = 0;

    if (provider.name === "gemini") {
      content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      inputTokens = data.usageMetadata?.promptTokenCount || 0;
      outputTokens = data.usageMetadata?.candidatesTokenCount || 0;
    } else if (provider.name === "anthropic") {
      content = data.content?.[0]?.text || "";
      inputTokens = data.usage?.input_tokens || 0;
      outputTokens = data.usage?.output_tokens || 0;
    } else {
      // OpenAI-compatible
      content = data.choices?.[0]?.message?.content || "";
      inputTokens = data.usage?.prompt_tokens || 0;
      outputTokens = data.usage?.completion_tokens || 0;
    }

    await logUsage({
      provider: provider.name,
      endpoint,
      agentName: opts.agentName,
      projectId: opts.projectId,
      userId: opts.userId,
      inputTokens,
      outputTokens,
      status: "success",
      responseTimeMs,
    });

    return { content, inputTokens, outputTokens };
  } catch (e) {
    const responseTimeMs = Date.now() - startTime;
    const errorMessage = e instanceof Error ? e.message : String(e);

    // Only log if not already logged above
    if (!errorMessage.includes("returned")) {
      await logUsage({
        provider: provider.name,
        endpoint: opts.endpoint || "chat",
        agentName: opts.agentName,
        projectId: opts.projectId,
        userId: opts.userId,
        status: "failed",
        errorMessage: errorMessage.slice(0, 500),
        responseTimeMs,
      });
    }

    throw e;
  }
}

// ─────────────────────────────────────────────
//  Main entry: try providers in order with fallback
// ─────────────────────────────────────────────

export async function callAIWithFallback(
  opts: CallProviderOptions,
): Promise<string> {
  // Sort providers by priority
  const sortedProviders = [...PROVIDERS].sort(
    (a, b) => a.priority - b.priority,
  );

  const errors: string[] = [];

  for (const provider of sortedProviders) {
    const apiKey = process.env[provider.envKeyName];

    if (!apiKey) {
      errors.push(`${provider.name}: no API key set`);
      continue;
    }

    // Check if provider has exceeded free limit
    try {
      const config = await db.aiProviderConfig.findUnique({
        where: { provider: provider.name },
      });

      if (config && config.usedUsd >= provider.freeLimitUsd) {
        errors.push(
          `${provider.name}: free limit exceeded ($${config.usedUsd.toFixed(2)}/$${provider.freeLimitUsd})`,
        );
        continue;
      }
    } catch {
      // DB check failed, proceed anyway
    }

    try {
      const result = await callProvider(provider, opts);
      return result.content;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      errors.push(`${provider.name}: ${errMsg}`);
      console.log(
        `[ai-service] ${provider.name} failed, trying next:`,
        errMsg,
      );
      continue;
    }
  }

  throw new Error(
    `All AI providers failed:\n${errors.join("\n")}\n\n` +
      "To fix: Add API keys in Vercel environment variables. " +
      "Free options: ZAI_API_KEY (z.ai), GEMINI_API_KEY (ai.google.dev), GROQ_API_KEY (console.groq.com)",
  );
}

// ─────────────────────────────────────────────
//  Backward-compatible wrappers (drop-in replacements for old functions)
// ─────────────────────────────────────────────

import { AGENT_CATALOG, type AgentDefinition } from "@/lib/agents";

export function findAgent(name: string): AgentDefinition | undefined {
  return AGENT_CATALOG.find((a) => a.name === name);
}

export async function chatWithAgent(
  agentName: string,
  userMessage: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[] = [],
  projectId?: string,
  userId?: string,
): Promise<string> {
  const agent = findAgent(agentName);
  if (!agent) throw new Error(`Agent "${agentName}" not found`);

  const messages: ChatMessage[] = [
    { role: "system", content: agent.systemPrompt },
    ...conversationHistory.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  return callAIWithFallback({
    messages,
    agentName,
    projectId,
    userId,
    endpoint: "chat",
  });
}

export async function analyzeProjectBrief(
  projectTitle: string,
  projectDescription: string,
  projectType: string,
  userId?: string,
): Promise<{
  recommendedAgents: string[];
  estimatedTimeline: string;
  suggestedTasks: { title: string; description: string; agent: string }[];
  summary: string;
}> {
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

  const response = await callAIWithFallback({
    messages: [{ role: "user", content: prompt }],
    endpoint: "analyze",
    userId,
    temperature: 0.4,
    maxTokens: 1500,
  });

  const cleaned = response
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

export async function generateDeliverable(
  agentName: string,
  taskDescription: string,
  projectContext: string,
  projectId?: string,
  userId?: string,
  language?: string,
): Promise<{ title: string; content: string; fileType: string }> {
  const agent = findAgent(agentName);
  if (!agent) throw new Error(`Agent "${agentName}" not found`);

  // Use POWER MODE prompt
  const { getPowerPrompt, POWER_MODE } = await import("@/lib/agent-power");
  const powerPrompt = getPowerPrompt(agentName);
  const systemPrompt = powerPrompt || agent.systemPrompt;

  // Build language-specific prompt extension
  let languagePrompt = "";
  if (language && language !== "typescript") {
    try {
      const { getLanguageById, getLanguagePromptExtension } = await import(
        "@/lib/languages"
      );
      const langConfig = getLanguageById(language as never);
      if (langConfig) {
        languagePrompt = getLanguagePromptExtension(langConfig.id);
      }
    } catch {
      // languages module not available — skip
    }
  }

  // Get memory context
  let memoryContext = "";
  if (projectId) {
    try {
      const { getMemoryContext } = await import("@/lib/agent-memory");
      memoryContext = await getMemoryContext(projectId);
    } catch {
      // skip
    }
  }

  const prompt = `${projectContext}
${memoryContext}

Task: ${taskDescription}
${languagePrompt}

As ${agent.name} (${agent.role}), produce a COMPLETE, PRODUCTION-READY deliverable.

POWER MODE REQUIREMENTS:
1. Generate COMPLETE code — no placeholders, no TODOs
2. Use proper markdown code blocks: \`\`\`language:filepath
3. Include ALL imports and dependencies
4. Generate MULTIPLE files when needed
5. Include error handling, types, and tests
6. Follow best practices for ${language || "TypeScript"}

Example format:
\`\`\`${language || "typescript"}:src/components/Button.tsx
import React from 'react';
// ... complete code
\`\`\``;

  const content = await callAIWithFallback({
    messages: [
      { role: "system", content: systemPrompt + languagePrompt },
      { role: "user", content: prompt },
    ],
    agentName,
    projectId,
    userId,
    endpoint: "deliverable",
    temperature: POWER_MODE.temperature,
    maxTokens: POWER_MODE.maxTokens,
  });

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

export async function autoAgentResponse(
  agentName: string,
  userMessage: string,
  projectContext: string,
  projectId?: string,
  userId?: string,
): Promise<string> {
  const agent = findAgent(agentName);
  if (!agent) throw new Error(`Agent "${agentName}" not found`);

  // Use POWER MODE prompt if available (Cursor-level capability)
  const { getPowerPrompt } = await import("@/lib/agent-power");
  const powerPrompt = getPowerPrompt(agentName);
  const systemPrompt = powerPrompt || agent.systemPrompt;

  // Get agent memory context (D3)
  let memoryContext = "";
  if (projectId) {
    try {
      const { getMemoryContext } = await import("@/lib/agent-memory");
      memoryContext = await getMemoryContext(projectId);
    } catch {
      // memory module not available — skip
    }
  }

  return callAIWithFallback({
    messages: [
      {
        role: "system",
        content: `${systemPrompt}

You are currently working on a project for a Mianx.ai client. Project context:
${projectContext}
${memoryContext}

Respond to the client's message. Be helpful, specific, and within your expertise as ${agent.name} (${agent.role}).

POWER MODE ACTIVE: Generate COMPLETE, PRODUCTION-READY code when coding is needed. Use proper file paths in code blocks. Include ALL imports. No placeholders. No TODOs. If the question is outside your scope, briefly say so and tag the right teammate (@AgentName).`,
      },
      { role: "user", content: userMessage },
    ],
    agentName,
    projectId,
    userId,
    endpoint: "chat",
    temperature: 0.6,
    maxTokens: 1200,
  });
}

// ─────────────────────────────────────────────
//  Multi-Agent Team Response (NEW!)
//  Multiple agents respond in parallel, each aware of the team
// ─────────────────────────────────────────────

export interface TeamAgentInfo {
  name: string;
  role: string;
  team: string;
}

export interface TeamResponseResult {
  agentName: string;
  agentRole: string;
  agentTeam: string;
  content: string;
  success: boolean;
  error?: string;
}

/**
 * Get responses from multiple agents in parallel.
 * Each agent knows:
 *   - Who else is on the team
 *   - What their specialties are
 *   - Their role in this response
 *
 * Agents respond simultaneously (parallel) for speed.
 * Each focuses on their expertise area.
 */
export async function teamAgentResponse(
  agents: TeamAgentInfo[],
  userMessage: string,
  projectContext: string,
  projectId?: string,
  userId?: string,
): Promise<TeamResponseResult[]> {
  // If only 1 agent, use simple response (faster)
  if (agents.length === 1) {
    try {
      const content = await autoAgentResponse(
        agents[0].name,
        userMessage,
        projectContext,
        projectId,
        userId,
      );
      return [
        {
          agentName: agents[0].name,
          agentRole: agents[0].role,
          agentTeam: agents[0].team,
          content,
          success: true,
        },
      ];
    } catch (e) {
      return [
        {
          agentName: agents[0].name,
          agentRole: agents[0].role,
          agentTeam: agents[0].team,
          content: `I'm ${agents[0].name}, your ${agents[0].role}. I encountered an issue. Please try again.`,
          success: false,
          error: e instanceof Error ? e.message : String(e),
        },
      ];
    }
  }

  // Multiple agents — build team context
  const teamSummary = agents
    .map((a) => `- ${a.name} (${a.role}, ${a.team} team)`)
    .join("\n");

  // Get responses from all agents IN PARALLEL
  const responsePromises = agents.map(async (agentInfo) => {
    const agent = findAgent(agentInfo.name);
    if (!agent) {
      return {
        agentName: agentInfo.name,
        agentRole: agentInfo.role,
        agentTeam: agentInfo.team,
        content: `Agent ${agentInfo.name} not found.`,
        success: false,
        error: "Agent not found in catalog",
      } as TeamResponseResult;
    }

    try {
      const content = await callAIWithFallback({
        messages: [
          {
            role: "system",
            content: `${agent.systemPrompt}

You are part of a TEAM working on a Mianx.ai client project. Other team members responding to this same message:
${teamSummary}

Project context:
${projectContext}

IMPORTANT TEAM GUIDELINES:
1. Focus ONLY on your area of expertise (${agent.role})
2. Don't repeat what other team members would cover
3. Be concise — 1-3 paragraphs max
4. If you need to coordinate with another agent, mention them by name (e.g., "@Zen will handle the frontend")
5. If the message is outside your scope, briefly say so and tag the right teammate

Respond to the client's message from your expertise perspective:`,
          },
          { role: "user", content: userMessage },
        ],
        agentName: agent.name,
        projectId,
        userId,
        endpoint: "chat",
        temperature: 0.6,
        maxTokens: 800, // Shorter since multiple agents respond
      });

      return {
        agentName: agent.name,
        agentRole: agent.role,
        agentTeam: agent.team,
        content,
        success: true,
      } as TeamResponseResult;
    } catch (e) {
      return {
        agentName: agent.name,
        agentRole: agent.role,
        agentTeam: agent.team,
        content: `I'm ${agent.name}, your ${agent.role}. I encountered an issue generating a response. The team will continue without me — please try again if needed.`,
        success: false,
        error: e instanceof Error ? e.message : String(e),
      } as TeamResponseResult;
    }
  });

  // Wait for all responses in parallel
  const results = await Promise.all(responsePromises);
  return results;
}
