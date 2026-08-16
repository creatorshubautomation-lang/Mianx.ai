// Mianx.ai — Mission Engine: AI Planner
//
// The Planner takes a user's objective (natural language) and
// produces a structured execution plan with:
//   - Dependency-aware task graph
//   - Agent/tool assignment
//   - Risk assessment
//   - Verification criteria per task
//   - Schema-validated JSON output

import { callAIWithFallback } from "@/lib/ai-service";
import { AGENT_CATALOG } from "@/lib/agents";
import { db } from "@/lib/db";
import { logMissionEvent } from "./mission-engine";
import type { MissionPlan } from "./mission-types";

// ─────────────────────────────────────────────
//  Planner System Prompt
// ─────────────────────────────────────────────

const PLANNER_SYSTEM_PROMPT = `You are the Mission Planner for Mianx.ai Agentic AI Platform. Your job is to analyze a user's objective and create a detailed, structured execution plan that the AI system will autonomously execute.

CRITICAL RULES:
1. Respond with ONLY a valid JSON object — no markdown, no explanation outside JSON
2. The plan must be executable by AI agents without human intervention
3. Each task must have clear, verifiable success criteria
4. Dependencies must form a valid DAG (no circular dependencies)
5. Tasks that can run in parallel should NOT depend on each other
6. Assign the most appropriate agent for each task
7. Estimate realistic costs based on AI token usage

OUTPUT FORMAT (exact JSON structure):
{
  "summary": "1-2 sentence overview of what this mission will accomplish",
  "reasoning": "Why you chose this specific plan structure",
  "estimatedSteps": <number of tasks>,
  "estimatedCostUsd": <estimated total AI cost in USD>,
  "riskAssessment": "LOW | MEDIUM | HIGH | CRITICAL",
  "tasks": [
    {
      "id": "task_1",
      "title": "Short descriptive title",
      "description": "Detailed description of what this task does",
      "priority": 10,
      "dependencies": [],
      "assignedAgent": "AgentName",
      "agentTeam": "TEAM_NAME",
      "agentRole": "Agent's specific role",
      "requiredTools": ["tool_name"],
      "riskLevel": "LOW",
      "verificationCriteria": "How to verify this task succeeded",
      "outputType": "text|code|file|url|json",
      "approvalRequired": false
    }
  ],
  "tools": [
    {
      "name": "web_search",
      "category": "WEB",
      "riskLevel": "LOW",
      "purpose": "Why this tool is needed"
    }
  ],
  "agents": [
    {
      "name": "Zen",
      "team": "DEVELOPMENT",
      "role": "Frontend Developer",
      "tasks": ["task_1", "task_2"]
    }
  ]
}

AVAILABLE AGENTS (use EXACT names):
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

AVAILABLE TOOLS:
  - web_search (WEB): Search the web for real-time information
  - code_verify (CODE): Verify code quality via TypeScript compiler
  - file_write (FILE): Write/create files
  - file_read (FILE): Read file contents
  - git_commit (GIT): Commit code to git repository
  - db_query (DATABASE): Execute database queries
  - ai_generate (AI): Generate content using AI
  - deploy (DEPLOY): Deploy to production

PLANNING GUIDELINES:
1. Break complex objectives into 3-8 concrete, sequential or parallel tasks
2. Design tasks should come before development tasks
3. Content tasks can often run parallel with design
4. QA/testing should always be a final step
5. Each task must produce a verifiable output
6. Set approvalRequired=true for tasks involving: deployments, database changes, external API calls with side effects, or HIGH/CRITICAL risk actions
7. Risk assessment should consider: data sensitivity, external system impact, irreversibility
8. Estimate cost conservatively (assume ~$0.002 per task for fast tier, ~$0.008 for quality tier)`;

// ─────────────────────────────────────────────
//  Plan Generation
// ─────────────────────────────────────────────

/**
 * Generate a structured mission plan using AI.
 * The planner analyzes the objective and creates a
 * dependency-aware execution plan with agent/tool assignments.
 */
export async function generateMissionPlan(
  objective: string,
  projectId?: string,
  userId?: string,
): Promise<MissionPlan> {
  // Get project context if linked to a project
  let projectContext = "";
  if (projectId) {
    try {
      const project = await db.project.findUnique({
        where: { id: projectId },
        select: { title: true, description: true, requirements: true, projectType: true },
      });
      if (project) {
        projectContext = `\n\nEXISTING PROJECT CONTEXT:\nTitle: ${project.title}\nType: ${project.projectType}\nDescription: ${project.description}\nRequirements: ${project.requirements}`;
      }
    } catch {
      // project not found, proceed without context
    }
  }

  const userPrompt = `Create a detailed execution plan for this objective:\n\n"${objective}"${projectContext}\n\nRemember: Output ONLY valid JSON with the exact structure specified. Make tasks concrete and verifiable.`;

  const response = await callAIWithFallback({
    messages: [
      { role: "system", content: PLANNER_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    agentName: "MissionPlanner",
    projectId,
    userId,
    endpoint: "chat", // uses fast tier for planning
    temperature: 0.3, // low temperature for structured output
    maxTokens: 2000,
  });

  return parseMissionPlan(response);
}

/**
 * Parse the LLM's JSON response into a typed MissionPlan.
 * Handles: markdown code blocks, partial JSON, missing fields.
 */
function parseMissionPlan(llmResponse: string): MissionPlan {
  // Strip markdown code fences
  let jsonStr = llmResponse.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  // Find JSON object
  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    jsonStr = objectMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // Validate and normalize tasks
    const tasks = (parsed.tasks || []).map((task: Record<string, unknown>, index: number) => {
      const agentName = String(task.assignedAgent || "Unknown");
      const agent = AGENT_CATALOG.find((a) => a.name === agentName);

      return {
        id: String(task.id || `task_${index + 1}`),
        title: String(task.title || `Task ${index + 1}`),
        description: String(task.description || ""),
        priority: Number(task.priority) || (10 - index) * 10,
        dependencies: Array.isArray(task.dependencies) ? task.dependencies.map(String) : [],
        assignedAgent: agentName,
        agentTeam: String(task.agentTeam || agent?.team || "DEVELOPMENT"),
        agentRole: String(task.agentRole || agent?.role || "Agent"),
        requiredTools: Array.isArray(task.requiredTools) ? task.requiredTools.map(String) : [],
        riskLevel: validateRiskLevel(task.riskLevel),
        verificationCriteria: String(task.verificationCriteria || "Output is non-empty and valid"),
        outputType: String(task.outputType || "text"),
        approvalRequired: Boolean(task.approvalRequired),
      };
    });

    // Validate and normalize tools
    const tools = (parsed.tools || []).map((tool: Record<string, unknown>) => ({
      name: String(tool.name || "unknown"),
      category: validateToolCategory(tool.category),
      riskLevel: validateRiskLevel(tool.riskLevel),
      purpose: String(tool.purpose || ""),
    }));

    // Validate and normalize agents
    const agents = (parsed.agents || []).map((agent: Record<string, unknown>) => ({
      name: String(agent.name || "Unknown"),
      team: String(agent.team || "DEVELOPMENT"),
      role: String(agent.role || "Agent"),
      tasks: Array.isArray(agent.tasks) ? agent.tasks.map(String) : [],
    }));

    return {
      summary: String(parsed.summary || "Execute mission tasks"),
      reasoning: String(parsed.reasoning || "No reasoning provided"),
      estimatedSteps: tasks.length,
      estimatedCostUsd: Number(parsed.estimatedCostUsd) || tasks.length * 0.005,
      riskAssessment: validateRiskLevel(parsed.riskAssessment),
      tasks,
      tools,
      agents,
    };
  } catch (error) {
    console.error("[mission-planner] Failed to parse plan JSON:", error);

    // Return minimal fallback plan
    return {
      summary: "Execute the user's objective",
      reasoning: "Plan parsing failed, using minimal fallback",
      estimatedSteps: 1,
      estimatedCostUsd: 0.005,
      riskAssessment: "LOW",
      tasks: [
        {
          id: "task_1",
          title: "Complete the objective",
          description: "Execute the user's requested objective using available agents and tools",
          priority: 10,
          dependencies: [],
          assignedAgent: "Zen",
          agentTeam: "DEVELOPMENT",
          agentRole: "Frontend Developer",
          requiredTools: [],
          riskLevel: "LOW",
          verificationCriteria: "Output is non-empty and addresses the objective",
          outputType: "text",
          approvalRequired: false,
        },
      ],
      tools: [],
      agents: [],
    };
  }
}

// ─────────────────────────────────────────────
//  Validators
// ─────────────────────────────────────────────

function validateRiskLevel(value: unknown): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  const valid = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const str = String(value || "").toUpperCase();
  return valid.includes(str) ? (str as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL") : "LOW";
}

function validateToolCategory(value: unknown): "FILE" | "CODE" | "GIT" | "DATABASE" | "WEB" | "DEPLOY" | "AI" | "SYSTEM" {
  const valid = ["FILE", "CODE", "GIT", "DATABASE", "WEB", "DEPLOY", "AI", "SYSTEM"];
  const str = String(value || "").toUpperCase();
  return valid.includes(str)
    ? (str as "FILE" | "CODE" | "GIT" | "DATABASE" | "WEB" | "DEPLOY" | "AI" | "SYSTEM")
    : "SYSTEM";
}

// ─────────────────────────────────────────────
//  Plan Persistence
// ─────────────────────────────────────────────

/**
 * Save the plan to the Mission record and create MissionTask rows.
 * Also logs the plan generation event.
 */
export async function persistMissionPlan(
  missionId: string,
  plan: MissionPlan,
): Promise<void> {
  // Calculate the max order from existing tasks
  await db.mission.update({
    where: { id: missionId },
    data: {
      planJson: JSON.stringify(plan),
      planSummary: plan.summary,
      planReasoning: plan.reasoning,
      totalTasks: plan.tasks.length,
    },
  });

  // Create task records
  for (let i = 0; i < plan.tasks.length; i++) {
    const taskDef = plan.tasks[i];

    await db.missionTask.create({
      data: {
        missionId,
        title: taskDef.title,
        description: taskDef.description,
        status: "PENDING",
        priority: taskDef.priority,
        dependencies: JSON.stringify(taskDef.dependencies),
        dependents: JSON.stringify([]), // will be populated below
        assignedAgent: taskDef.assignedAgent,
        agentTeam: taskDef.agentTeam,
        agentRole: taskDef.agentRole,
        requiredTools: JSON.stringify(taskDef.requiredTools),
        riskLevel: taskDef.riskLevel,
        input: JSON.stringify({ verificationCriteria: taskDef.verificationCriteria }),
        outputType: taskDef.outputType,
        approvalStatus: taskDef.approvalRequired ? "PENDING" : "NOT_REQUIRED",
        approvalReason: taskDef.approvalRequired
          ? `Task requires approval (risk: ${taskDef.riskLevel})`
          : null,
        order: i,
        maxRetries: taskDef.riskLevel === "CRITICAL" ? 1 : 3,
      },
    });
  }

  // Populate dependents (reverse of dependencies)
  const allTasks = await db.missionTask.findMany({
    where: { missionId },
    select: { id: true, dependencies: true },
  });

  for (const task of allTasks) {
    const deps: string[] = JSON.parse(task.dependencies);
    for (const depId of deps) {
      await db.missionTask.update({
        where: { id: depId },
        data: {
          dependents: {
            // This is a string field, we need to read-modify-write
          },
        },
      });
    }
  }

  // Log event
  await logMissionEvent(missionId, {
    eventType: "PLAN_GENERATED",
    title: "Mission Plan Generated",
    description: `${plan.tasks.length} tasks planned: ${plan.summary}`,
    level: "success",
    metadata: {
      taskCount: plan.tasks.length,
      riskLevel: plan.riskAssessment,
      estimatedCost: plan.estimatedCostUsd,
    },
  });
}

/**
 * Populate the dependents field for all tasks in a mission.
 * dependents = reverse mapping of dependencies.
 */
export async function populateDependents(missionId: string): Promise<void> {
  const allTasks = await db.missionTask.findMany({
    where: { missionId },
    select: { id: true, dependencies: true },
  });

  // Build dependents map
  const dependentsMap: Record<string, string[]> = {};
  for (const task of allTasks) {
    const deps: string[] = JSON.parse(task.dependencies);
    for (const depId of deps) {
      if (!dependentsMap[depId]) dependentsMap[depId] = [];
      dependentsMap[depId].push(task.id);
    }
  }

  // Update each task's dependents
  for (const [taskId, dependentIds] of Object.entries(dependentsMap)) {
    await db.missionTask.update({
      where: { id: taskId },
      data: { dependents: JSON.stringify(dependentIds) },
    });
  }
}
