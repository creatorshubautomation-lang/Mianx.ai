// Mianx.ai — Phase 3: Real Multi-Agent Orchestration
//
// Replaces the parallel-independent-calls pattern with actual sequential
// planning and handoff. A "Project Lead" (orchestrator) runs first, reads
// the request, decides which agents are needed and in what order, then
// each agent receives the *actual* prior agent's output (not just team
// context).
//
// Orchestration modes:
//   - "parallel"  — current behavior, for simple/quick queries (backward compat)
//   - "sequential" — new pipeline: plan → agent A → agent B sees A's output → ...
//
// Auto-detection logic:
//   - If user @mentions 2+ agents → sequential
//   - If message contains multi-step keywords (build, create, design + code, etc.) → sequential
//   - If only 1 agent or simple question → parallel (single agent, no orchestration needed)

import { callAIWithFallback } from "@/lib/ai-service";
import { AGENT_CATALOG, type AgentDefinition } from "@/lib/agents";
import { db } from "@/lib/db";

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

export type OrchestrationMode = "parallel" | "sequential";

export interface OrchestrationStep {
  agent: string; // agent name from AGENT_CATALOG
  task: string; // specific task for this agent
  team: string; // team name
  role: string; // agent role
}

export interface OrchestrationPlan {
  plan: string; // human-readable summary
  steps: OrchestrationStep[];
  reasoning: string; // why this plan was chosen
}

export interface SequentialResult {
  plan: OrchestrationPlan;
  results: SequentialStepResult[];
  totalDurationMs: number;
}

export interface SequentialStepResult {
  agentName: string;
  agentRole: string;
  agentTeam: string;
  task: string;
  content: string;
  success: boolean;
  error?: string;
  durationMs: number;
  priorAgentOutput?: string; // name of agent whose output this agent received
}

// ─────────────────────────────────────────────
//  Orchestrator system prompt
// ─────────────────────────────────────────────

const ORCHESTRATOR_PROMPT = `You are the Project Lead orchestrator for Mianx.ai, an AI-powered software house. Your job is to analyze a client request and create an execution plan that delegates to the right specialized agents in the right order.

You MUST respond with ONLY a valid JSON object (no markdown, no explanation outside the JSON). The JSON must have this exact structure:

{
  "plan": "Short summary of the overall plan (1-2 sentences)",
  "reasoning": "Why you chose this plan and ordering",
  "steps": [
    {"agent": "AgentName", "task": "Specific task description for this agent"},
    {"agent": "AgentName", "task": "Specific task for the next agent, building on prior output"}
  ]
}

Available agents (use their EXACT names):
DESIGN TEAM:
  - Aria (Brand Strategist): brand identity, voice, positioning, color palettes, typography
  - Kairo (UI Designer): UI components, design systems, accessibility, responsive layouts
  - Mira (UX Researcher): user research, journey mapping, personas, wireframing
  - Nova (Graphic Designer): logos, illustrations, marketing collateral, visual assets

DEVELOPMENT TEAM:
  - Zen (Frontend Developer): React/Next.js, TypeScript, Tailwind CSS, components
  - Atlas (Backend Developer): APIs, database schemas, server logic, authentication
  - Orion (DevOps Engineer): CI/CD, Docker, cloud infrastructure, deployment
  - Vega (Database Architect): schema design, query optimization, indexing

CONTENT TEAM:
  - Lyra (Copywriter): marketing copy, taglines, brand narratives, email sequences
  - Sage (SEO Writer): SEO content, keywords, meta tags, content strategy
  - Echo (Blog Writer): long-form articles, thought leadership, educational content
  - Quill (Script Writer): video scripts, podcast outlines, multimedia narratives

MARKETING TEAM:
  - Flux (SEO Specialist): technical SEO audits, on-page optimization, backlink strategy
  - Pulse (Social Media Manager): social strategy, content calendars, engagement
  - Spark (Ad Copywriter): Google/Meta ad copy, A/B testing, conversion copywriting
  - Insight (Analytics Expert): GA4, conversion tracking, funnel analysis, dashboards

QA TEAM:
  - Shield (Test Engineer): automated testing, test plans, bug reporting
  - Lens (Code Reviewer): code review, best practices, security review
  - Cipher (Security Auditor): security audits, OWASP, vulnerability assessment
  - Radar (Performance Monitor): performance profiling, Lighthouse audits, optimization

SUPPORT TEAM:
  - Halo (Chat Support): live chat, issue triage, product guidance
  - Echo2 (Email Responder): email support, templates, follow-up
  - Triage (Ticket Manager): ticket prioritization, SLA management, routing
  - Sentry (Feedback Collector): surveys, feedback analysis, NPS tracking

RULES:
1. Only include agents that are actually needed for this specific request
2. Order matters: design before code, content before SEO, code before QA
3. Each step should build on the output of the previous step
4. Maximum 5 steps (keep plans focused and efficient)
5. Use the EXACT agent name from the list above
6. If only 1 agent is needed, still output a valid plan with 1 step
7. For code-heavy tasks, always include a QA step (Shield or Lens) at the end`;

// ─────────────────────────────────────────────
//  Plan generation
// ─────────────────────────────────────────────

/**
 * Generate an orchestration plan using a fast-tier LLM call.
 * The orchestrator reads the user message + available agents
 * and decides who should work and in what order.
 */
export async function generateOrchestrationPlan(
  userMessage: string,
  availableAgentNames: string[],
  projectContext: string,
  projectId?: string,
  userId?: string,
): Promise<OrchestrationPlan> {
  // Build list of available agents for the orchestrator
  const agentList = availableAgentNames
    .map((name) => {
      const agent = AGENT_CATALOG.find((a) => a.name === name);
      if (!agent) return null;
      return `- ${agent.name} (${agent.role}, ${agent.team} team): ${agent.description}`;
    })
    .filter(Boolean)
    .join("\n");

  const systemPrompt = `${ORCHESTRATOR_PROMPT}

AVAILABLE AGENTS FOR THIS PROJECT:
${agentList}

IMPORTANT: Only use agents from the "AVAILABLE AGENTS" list above. Do not invent agents that aren't assigned to this project.`;

  const response = await callAIWithFallback({
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: `Create an execution plan for this client request:\n\n${userMessage}\n\nProject context: ${projectContext}`,
      },
    ],
    agentName: "Orchestrator",
    projectId,
    userId,
    endpoint: "chat", // uses fast tier
    temperature: 0.3, // lower temperature for structured output
    maxTokens: 800,
  });

  // Parse the JSON plan from the LLM response
  return parseOrchestrationPlan(response);
}

/**
 * Parse the LLM's JSON response into a typed OrchestrationPlan.
 * Handles common issues: markdown code blocks, partial JSON, etc.
 */
function parseOrchestrationPlan(llmResponse: string): OrchestrationPlan {
  // Strip markdown code fences if present
  let jsonStr = llmResponse.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  // Try to find JSON object in the response
  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    jsonStr = objectMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // Validate and normalize
    const steps: OrchestrationStep[] = (parsed.steps || []).map((step: Record<string, string>) => {
      const agentName = step.agent || "Unknown";
      const agent = AGENT_CATALOG.find((a) => a.name === agentName);
      return {
        agent: agentName,
        task: step.task || "Complete the assigned work",
        team: agent?.team || "UNKNOWN",
        role: agent?.role || "Agent",
      };
    });

    return {
      plan: parsed.plan || "Execute project tasks",
      reasoning: parsed.reasoning || "No reasoning provided",
      steps,
    };
  } catch {
    // If JSON parsing fails, return a minimal plan
    console.error("[orchestrator] Failed to parse plan JSON, using fallback");
    return {
      plan: "Execute tasks with available agents",
      reasoning: "Plan parsing failed, using simple sequential approach",
      steps: [],
    };
  }
}

// ─────────────────────────────────────────────
//  Sequential pipeline execution
// ─────────────────────────────────────────────

/**
 * Execute an orchestration plan sequentially.
 * Each agent receives the *actual* prior agent's output in its prompt,
 * enabling real handoff and coordination.
 */
export async function executeSequentialPlan(
  plan: OrchestrationPlan,
  userMessage: string,
  projectContext: string,
  projectId?: string,
  userId?: string,
): Promise<SequentialResult> {
  const startTime = Date.now();
  const results: SequentialStepResult[] = [];

  // If plan has no steps, return empty result
  if (plan.steps.length === 0) {
    return {
      plan,
      results: [],
      totalDurationMs: Date.now() - startTime,
    };
  }

  // Build running context of prior agent outputs
  let priorOutputSummary = "";
  let priorAgentName = "";

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    const stepStart = Date.now();

    try {
      const agent = AGENT_CATALOG.find((a) => a.name === step.agent);

      if (!agent) {
        results.push({
          agentName: step.agent,
          agentRole: step.role,
          agentTeam: step.team,
          task: step.task,
          content: `Agent "${step.agent}" not found in catalog. Skipping.`,
          success: false,
          error: "Agent not found",
          durationMs: Date.now() - stepStart,
          priorAgentOutput: priorAgentName || undefined,
        });
        continue;
      }

      // Build sequential context — this is the KEY difference from parallel mode
      const sequentialContext = priorOutputSummary
        ? `\n\nPREVIOUS AGENT OUTPUT (${priorAgentName}):\n${priorOutputSummary}\n\nIMPORTANT: You are receiving the actual output from ${priorAgentName}. Build on it, extend it, or use it as input for your specific task. Do NOT repeat what ${priorAgentName} already did — focus on YOUR area of expertise.`
        : "";

      const stepContext = `You are executing Step ${i + 1} of ${plan.steps.length} in the project plan.\nYour specific task: ${step.task}${sequentialContext}`;

      // Get memory context
      let memoryContext = "";
      if (projectId) {
        try {
          const { getMemoryContext } = await import("@/lib/agent-memory");
          memoryContext = await getMemoryContext(projectId, userId);
        } catch {
          // memory module not available
        }
      }

      // Phase 2: Web search for search-enabled agents
      let searchContext = "";
      try {
        const { canAgentSearch, webSearch, formatSearchContext } = await import(
          "@/lib/web-search-tool"
        );
        if (canAgentSearch(agent.name)) {
          const searchQuery = userMessage.slice(0, 200);
          const searchResult = await webSearch(searchQuery, {
            agentName: agent.name,
            projectId,
            userId,
          });
          if (searchResult.totalResults > 0) {
            searchContext = `\n\nWEB SEARCH RESULTS (real-time data):\n${formatSearchContext(searchResult)}`;
          }
        }
      } catch {
        // search not available
      }

      const content = await callAIWithFallback({
        messages: [
          {
            role: "system",
            content: `${agent.systemPrompt}

You are part of a SEQUENTIAL TEAM working on a Mianx.ai client project. Agents execute one at a time, and you receive actual output from the previous agent.

Project context:
${projectContext}
${memoryContext}
${searchContext}

${stepContext}

TEAM GUIDELINES:
1. Focus on YOUR specific task: ${step.task}
2. If you received prior agent output, BUILD ON IT (don't repeat)
3. Be specific and actionable — produce real, usable output
4. If your task involves code, write COMPLETE, runnable code with imports
5. Clearly state what you've produced so the next agent can pick up from here`,
          },
          { role: "user", content: userMessage },
        ],
        agentName: agent.name,
        projectId,
        userId,
        endpoint: "chat",
        temperature: 0.5,
        maxTokens: 1500, // More tokens for sequential (needs to build on prior)
      });

      const durationMs = Date.now() - stepStart;

      results.push({
        agentName: agent.name,
        agentRole: agent.role,
        agentTeam: agent.team,
        task: step.task,
        content,
        success: true,
        durationMs,
        priorAgentOutput: priorAgentName || undefined,
      });

      // Pass this agent's output to the next agent
      // Truncate to prevent context explosion (max 2000 chars of prior output)
      priorOutputSummary = content.length > 2000
        ? content.slice(0, 2000) + "\n\n[... output truncated for context ...]"
        : content;
      priorAgentName = agent.name;
    } catch (e) {
      results.push({
        agentName: step.agent,
        agentRole: step.role,
        agentTeam: step.team,
        task: step.task,
        content: `I encountered an issue generating a response. The pipeline will continue with the next agent.`,
        success: false,
        error: e instanceof Error ? e.message : String(e),
        durationMs: Date.now() - stepStart,
        priorAgentOutput: priorAgentName || undefined,
      });
    }
  }

  return {
    plan,
    results,
    totalDurationMs: Date.now() - startTime,
  };
}

// ─────────────────────────────────────────────
//  Mode auto-detection
// ─────────────────────────────────────────────

// Multi-step keywords that suggest sequential orchestration is needed
const SEQUENTIAL_KEYWORDS = [
  "build", "create", "design and", "develop", "implement", "make a",
  "set up", "architect", "full stack", "full-stack", "end to end", "end-to-end",
  "from scratch", "complete project", "landing page", "website", "web app",
  "mobile app", "dashboard", "e-commerce", "ecommerce", "saas",
  "brand identity", "marketing campaign", "content strategy",
  "design then code", "prototype", "mvp", "minimum viable",
];

// Keywords that suggest simple parallel/single-agent response is fine
const PARALLEL_KEYWORDS = [
  "question", "how do", "what is", "explain", "help me understand",
  "can you", "quick", "simple", "just", "only", "fix", "update",
  "change", "modify", "small", "minor",
];

/**
 * Auto-detect whether to use sequential or parallel orchestration.
 */
export function detectOrchestrationMode(
  userMessage: string,
  mentionedAgents: string[],
  availableAgents: string[],
): OrchestrationMode {
  const lower = userMessage.toLowerCase();

  // If user explicitly @mentioned 2+ agents → sequential
  if (mentionedAgents.length >= 2) {
    return "sequential";
  }

  // If only 1 agent available or 1 mentioned → parallel (single agent, no orchestration needed)
  if (availableAgents.length <= 1 || mentionedAgents.length === 1) {
    return "parallel";
  }

  // Check for sequential keywords
  const hasSequentialKeyword = SEQUENTIAL_KEYWORDS.some((kw) => lower.includes(kw));

  // Check for parallel keywords (override)
  const hasParallelKeyword = PARALLEL_KEYWORDS.some((kw) => lower.includes(kw));

  // If message is long (suggests complex request) → sequential
  const isLongMessage = userMessage.length > 200;

  // If message mentions multiple teams → sequential
  const teamMentions = countTeamMentions(lower);

  if (hasParallelKeyword && !hasSequentialKeyword && teamMentions <= 1) {
    return "parallel";
  }

  if (hasSequentialKeyword || isLongMessage || teamMentions >= 2) {
    return "sequential";
  }

  // Default: parallel for simple queries
  return "parallel";
}

function countTeamMentions(lowerMessage: string): number {
  const teams = ["design", "develop", "code", "content", "market", "qa", "test", "support"];
  return teams.filter((t) => lowerMessage.includes(t)).length;
}

// ─────────────────────────────────────────────
//  Log orchestration to Activity table
// ─────────────────────────────────────────────

/**
 * Log the orchestration plan and each step to the Activity table
 * for visibility in the project activity feed.
 */
export async function logOrchestrationActivity(
  projectId: string,
  userId: string,
  plan: OrchestrationPlan,
  results: SequentialStepResult[],
): Promise<void> {
  try {
    // Log the plan itself
    await db.activity.create({
      data: {
        projectId,
        userId,
        action: "ORCHESTRATION_PLAN_CREATED",
        details: `Sequential plan: ${plan.plan} (${plan.steps.length} steps: ${plan.steps.map((s) => s.agent).join(" → ")})`,
      },
    });

    // Log each step execution
    for (const result of results) {
      await db.activity.create({
        data: {
          projectId,
          userId,
          action: result.success ? "ORCHESTRATION_STEP_COMPLETED" : "ORCHESTRATION_STEP_FAILED",
          details: `Step: ${result.agentName} (${result.agentRole}) — ${result.task}. ${result.success ? "Completed" : `Failed: ${result.error}`}. ${result.priorAgentOutput ? `Built on ${result.priorAgentOutput}'s output.` : "First step."} [${result.durationMs}ms]`,
        },
      });
    }
  } catch (e) {
    console.error("[orchestrator] activity log error:", e);
  }
}

// ─────────────────────────────────────────────
//  QA auto-review for code deliverables
// ─────────────────────────────────────────────

/**
 * Auto-append QA review step for code-type deliverables.
 * QA agents (Shield for testing, Lens for code review) run as mandatory
 * final step when the deliverable involves code.
 */
export function appendQAStep(
  plan: OrchestrationPlan,
  deliverableType: "code" | "content" | "design" | "general",
): OrchestrationPlan {
  // Check if QA step already exists
  const hasQA = plan.steps.some(
    (s) => s.team === "QA" || s.agent === "Shield" || s.agent === "Lens",
  );
  if (hasQA) return plan;

  // For code deliverables, add Lens (Code Reviewer) as mandatory final step
  if (deliverableType === "code") {
    return {
      ...plan,
      plan: `${plan.plan} + QA Code Review`,
      steps: [
        ...plan.steps,
        {
          agent: "Lens",
          task: "Review ALL code produced by the previous agents. Check for: bugs, security issues, performance problems, best practices violations, and missing error handling. Provide specific feedback with line references.",
          team: "QA",
          role: "Code Reviewer",
        },
      ],
    };
  }

  return plan;
}
