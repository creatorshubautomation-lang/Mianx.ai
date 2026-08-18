// ============================================================
// MIANX.AI V3 — Agent Workforce Management
// Agent selection, delegation, capability resolution
// ============================================================

import { db } from '@/lib/db'
import { parseJsonField } from '@/lib/types'
import type { Agent } from '@prisma/client'

// ============================================================
// Public API
// ============================================================

/**
 * Select the best agents for a mission based on task requirements.
 * Scores agents by capability overlap with required capabilities,
 * preferring active agents with higher overlap.
 *
 * @param params.organizationId - Organization to search agents within
 * @param params.missionId - Mission to assign agents to
 * @param params.requiredCapabilities - Capabilities needed (e.g. ['code_generation', 'web_search'])
 * @param params.maxAgents - Maximum agents to select (default 2)
 * @returns Array of selected Agent records
 */
export async function selectWorkforce(params: {
  organizationId: string
  missionId: string
  requiredCapabilities: string[]
  maxAgents?: number
}): Promise<Agent[]> {
  const maxAgents = params.maxAgents ?? 2

  const agents = await db.agent.findMany({
    where: { organizationId: params.organizationId, status: 'active' },
  })

  if (agents.length === 0) return []

  // Score each agent by capability overlap
  const scored = agents.map((agent) => {
    const caps: string[] = parseJsonField(agent.capabilities, [])
    const overlap = caps.filter((c) =>
      params.requiredCapabilities.some(
        (rc) => c.toLowerCase() === rc.toLowerCase(),
      ),
    ).length
    return { agent, score: overlap }
  })

  // Sort by score descending, then by creation date (prefer experienced agents)
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.agent.createdAt.getTime() - b.agent.createdAt.getTime()
  })

  const selected = scored.slice(0, maxAgents)

  // Create MissionAgent records for the selected agents
  for (const { agent, score } of selected) {
    await db.missionAgent.create({
      data: {
        missionId: params.missionId,
        agentId: agent.id,
        role: score > 0 ? 'worker' : 'observer',
        capabilitiesUsed: JSON.stringify(
          (parseJsonField<string[]>(agent.capabilities, [])).filter((c: string) =>
            params.requiredCapabilities.some(
              (rc) => c.toLowerCase() === rc.toLowerCase(),
            ),
          ),
        ),
      },
    }).catch(() => {
      // Ignore unique constraint violation if already assigned
    })
  }

  return selected.map((s) => s.agent)
}

/**
 * Check if a parent agent can delegate to a child agent.
 * Delegation is allowed when the child's effective permissions
 * are a subset of the parent's effective permissions.
 */
export async function canDelegate(
  parentAgentId: string,
  childAgentId: string,
): Promise<boolean> {
  const parentCaps = await getAgentCapabilities(parentAgentId)
  const childCaps = await getAgentCapabilities(childAgentId)

  // Every child capability must exist in the parent's set
  const parentSet = new Set(parentCaps.map((c) => c.toLowerCase()))
  return childCaps.every((c) => parentSet.has(c.toLowerCase()))
}

/**
 * Get an agent's effective capabilities.
 * Combines the agent's own capabilities with those derived from its assigned tools.
 */
export async function getAgentCapabilities(agentId: string): Promise<string[]> {
  const agent = await db.agent.findUnique({
    where: { id: agentId },
    include: { tools: true },
  })

  if (!agent) return []

  const ownCaps: string[] = parseJsonField(agent.capabilities, [])
  const toolCaps: string[] = agent.tools
    .filter((t) => t.enabled)
    .map((t) => `tool:${t.toolKey}`)

  // Deduplicate while preserving order
  const seen = new Set<string>()
  const combined: string[] = []
  for (const cap of [...ownCaps, ...toolCaps]) {
    const key = cap.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      combined.push(cap)
    }
  }

  return combined
}

/**
 * Record a delegation from a parent agent to a child agent.
 * Creates an AgentDelegation record linking the two agents.
 */
export async function createDelegation(params: {
  parentAgentId: string
  childAgentId: string
  task: string
}): Promise<void> {
  await db.agentDelegation.create({
    data: {
      parentAgentId: params.parentAgentId,
      childAgentId: params.childAgentId,
      task: params.task,
      status: 'active',
    },
  }).catch(() => {
    // Ignore unique constraint if delegation already exists
  })
}

/**
 * Get an agent's execution history and success rate.
 * Calculated from completed vs total assigned mission tasks.
 *
 * @param agentId - The agent to compute metrics for
 * @returns Object with total tasks, completed count, and success rate (0-1)
 */
export async function getAgentSuccessRate(
  agentId: string,
): Promise<{ total: number; completed: number; rate: number }> {
  const tasks = await db.missionTask.findMany({
    where: { agentId },
    select: { status: true },
  })

  const total = tasks.length
  const completed = tasks.filter((t) => t.status === 'completed').length
  const rate = total > 0 ? completed / total : 0

  return { total, completed, rate }
}
