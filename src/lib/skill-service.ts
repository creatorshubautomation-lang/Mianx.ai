// ============================================================
// MIANX.AI V3 — Skill Service
// Skill resolution (WHO-HOW-WHAT-WHY), evaluation, and assignment
// ============================================================

import { db } from '@/lib/db'
import { parseJsonField, toJsonField } from '@/lib/types'
import { getAgentCapabilities } from '@/lib/agent-workforce'

// ============================================================
// Types
// ============================================================

export interface SkillResolutionResult {
  /** WHO — the agent executing the skill */
  agent: {
    id: string
    name: string
    capabilities: string[]
  } | null
  /** HOW — the skill definition */
  skill: {
    id: string
    key: string
    version: string
    description: string | null
    inputs: Record<string, unknown>
    outputs: Record<string, unknown>
    requiredPermissions: string[]
    evaluationPolicy: Record<string, unknown>
  } | null
  /** WHAT — the tools available for this skill */
  tools: {
    id: string
    toolKey: string
    riskLevel: string
    enabled: boolean
  }[]
  /** WHY — the mission context */
  mission: {
    id: string
    title: string
    goal: string
    status: string
  } | null
  /** Permission match analysis */
  permissionMatch: {
    required: string[]
    available: string[]
    missing: string[]
    matchScore: number
  }
}

export interface SkillEvaluationResult {
  score: number
  feedback: string
}

// ============================================================
// Skill Resolution — WHO-HOW-WHAT-WHY
// ============================================================

/**
 * Resolve a skill for a specific agent and mission context.
 * Implements the WHO-HOW-WHAT-WHY framework:
 *
 * - WHO: Which agent has the capabilities to execute this skill?
 * - HOW: What does the skill definition prescribe (inputs, outputs, policy)?
 * - WHAT: Which tools are available to the agent to fulfill the skill's output requirements?
 * - WHY: What mission provides the context and purpose for this skill execution?
 *
 * @param params.skillKey - The unique skill key to resolve
 * @param params.agentId - The agent that would execute the skill
 * @param params.missionId - Optional mission context
 * @param params.organizationId - Organization scope
 */
export async function resolveSkill(params: {
  skillKey: string
  agentId: string
  missionId?: string
  organizationId: string
}): Promise<SkillResolutionResult> {
  const { skillKey, agentId, missionId, organizationId } = params

  // --- HOW: Look up Skill by key ---
  const skill = await db.skill.findUnique({
    where: { key: skillKey },
  })

  let skillData: SkillResolutionResult['skill'] = null
  let requiredPermissions: string[] = []
  let expectedOutputs: string[] = []

  if (skill) {
    const outputs = parseJsonField<Record<string, unknown>>(skill.outputs, {})
    requiredPermissions = parseJsonField<string[]>(skill.requiredPermissions, [])
    expectedOutputs = Object.keys(outputs)

    skillData = {
      id: skill.id,
      key: skill.key,
      version: skill.version,
      description: skill.description,
      inputs: parseJsonField<Record<string, unknown>>(skill.inputs, {}),
      outputs,
      requiredPermissions,
      evaluationPolicy: parseJsonField<Record<string, unknown>>(skill.evaluationPolicy, {}),
    }
  }

  // --- WHO: Get agent capabilities ---
  const agentCapabilities = await getAgentCapabilities(agentId)
  const agent = await db.agent.findUnique({
    where: { id: agentId },
    select: { id: true, name: true, capabilities: true },
  })

  let agentData: SkillResolutionResult['agent'] = null
  if (agent) {
    agentData = {
      id: agent.id,
      name: agent.name,
      capabilities: agentCapabilities,
    }
  }

  // --- Permission Match: skill requiredPermissions vs agent capabilities ---
  const availableSet = new Set(agentCapabilities.map((c) => c.toLowerCase()))
  const matchedPerms = requiredPermissions.filter((p) =>
    availableSet.has(p.toLowerCase()),
  )
  const missingPerms = requiredPermissions.filter(
    (p) => !availableSet.has(p.toLowerCase()),
  )
  const matchScore =
    requiredPermissions.length > 0
      ? matchedPerms.length / requiredPermissions.length
      : 1

  // --- WHAT: Find agent tools that match skill's output requirements ---
  const agentTools = await db.agentTool.findMany({
    where: { agentId, enabled: true },
    select: {
      id: true,
      toolKey: true,
      riskLevel: true,
      enabled: true,
    },
  })

  const tools = agentTools

  // --- WHY: Get mission context if provided ---
  let missionData: SkillResolutionResult['mission'] = null
  if (missionId) {
    const mission = await db.mission.findUnique({
      where: { id: missionId },
      select: { id: true, title: true, goal: true, status: true },
    })
    if (mission) {
      missionData = {
        id: mission.id,
        title: mission.title,
        goal: mission.goal,
        status: mission.status,
      }
    }
  }

  return {
    agent: agentData,
    skill: skillData,
    tools,
    mission: missionData,
    permissionMatch: {
      required: requiredPermissions,
      available: agentCapabilities,
      missing: missingPerms,
      matchScore,
    },
  }
}

// ============================================================
// Skill Evaluation
// ============================================================

/**
 * Evaluate a skill execution outcome against the skill's evaluation policy.
 *
 * Simple evaluation strategy:
 * 1. Parse the skill's evaluationPolicy from the database
 * 2. Parse the skill's expected output keys
 * 3. Check which expected keys are present in the outcome
 * 4. Compute a score (0-1) based on key coverage
 * 5. Generate human-readable feedback
 *
 * @param params.skillKey - The skill to evaluate against
 * @param params.agentId - The agent that executed the skill
 * @param params.outcome - The outcome object produced by skill execution
 * @param params.organizationId - Organization scope
 */
export async function evaluateSkill(params: {
  skillKey: string
  agentId: string
  outcome: Record<string, unknown>
  organizationId: string
}): Promise<SkillEvaluationResult> {
  const { skillKey, outcome } = params

  // 1. Get skill's evaluation policy and outputs from db
  const skill = await db.skill.findUnique({
    where: { key: skillKey },
  })

  if (!skill) {
    return {
      score: 0,
      feedback: `Skill not found: ${skillKey}`,
    }
  }

  const evaluationPolicy = parseJsonField<Record<string, unknown>>(
    skill.evaluationPolicy,
    {},
  )
  const expectedOutputs = parseJsonField<Record<string, unknown>>(
    skill.outputs,
    {},
  )
  const expectedKeys = Object.keys(expectedOutputs)

  // 2. If no expected outputs defined, give a neutral score
  if (expectedKeys.length === 0) {
    return {
      score: 0.5,
      feedback: 'Skill has no defined output keys; cannot evaluate meaningfully.',
    }
  }

  // 3. Check which expected keys are present in the outcome
  const outcomeKeys = new Set(Object.keys(outcome))
  const presentKeys: string[] = []
  const missingKeys: string[] = []

  for (const key of expectedKeys) {
    if (outcomeKeys.has(key) && outcome[key] !== undefined && outcome[key] !== null) {
      presentKeys.push(key)
    } else {
      missingKeys.push(key)
    }
  }

  // 4. Compute score based on key coverage
  const score = expectedKeys.length > 0
    ? presentKeys.length / expectedKeys.length
    : 0

  // 5. Generate feedback
  const parts: string[] = []

  if (presentKeys.length > 0) {
    parts.push(`Present: ${presentKeys.join(', ')}`)
  }
  if (missingKeys.length > 0) {
    parts.push(`Missing: ${missingKeys.join(', ')}`)
  }

  const policyNote = Object.keys(evaluationPolicy).length > 0
    ? ` (policy: ${JSON.stringify(evaluationPolicy)})`
    : ''

  const feedback = parts.length > 0
    ? `${presentKeys.length}/${expectedKeys.length} expected outputs found. ${parts.join('. ')}.${policyNote}`
    : `No expected outputs matched.${policyNote}`

  return { score, feedback }
}

// ============================================================
// Skill Listing
// ============================================================

/**
 * List all skills available in the system.
 *
 * @param organizationId - Organization scope (for future scoping)
 * @returns Array of skill summaries with parsed JSON fields
 */
export async function getAvailableSkills(organizationId: string) {
  const skills = await db.skill.findMany({
    orderBy: { createdAt: 'asc' },
  })

  return skills.map((skill) => ({
    id: skill.id,
    key: skill.key,
    version: skill.version,
    description: skill.description,
    inputs: parseJsonField<Record<string, unknown>>(skill.inputs, {}),
    outputs: parseJsonField<Record<string, unknown>>(skill.outputs, {}),
    requiredPermissions: parseJsonField<string[]>(skill.requiredPermissions, []),
    evaluationPolicy: parseJsonField<Record<string, unknown>>(skill.evaluationPolicy, {}),
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt,
  }))
}

// ============================================================
// Skill Assignment
// ============================================================

/**
 * Assign a skill to an agent at a given proficiency level.
 * Uses upsert to create or update the AgentSkill record.
 *
 * @param params.agentId - The agent to assign the skill to
 * @param params.skillKey - The skill key to assign
 * @param params.level - Proficiency level (1-5, default 1)
 */
export async function assignSkillToAgent(params: {
  agentId: string
  skillKey: string
  level?: number
}): Promise<{ id: string; agentId: string; skillKey: string; level: number }> {
  const { agentId, skillKey, level = 1 } = params

  const agentSkill = await db.agentSkill.upsert({
    where: {
      agentId_skillKey: { agentId, skillKey },
    },
    create: {
      agentId,
      skillKey,
      level,
    },
    update: {
      level,
    },
  })

  return {
    id: agentSkill.id,
    agentId: agentSkill.agentId,
    skillKey: agentSkill.skillKey,
    level: agentSkill.level,
  }
}

/**
 * Remove a skill assignment from an agent.
 *
 * @param params.agentId - The agent to remove the skill from
 * @param params.skillKey - The skill key to remove
 */
export async function removeSkillFromAgent(params: {
  agentId: string
  skillKey: string
}): Promise<void> {
  await db.agentSkill.delete({
    where: {
      agentId_skillKey: { agentId: params.agentId, skillKey: params.skillKey },
    },
  })
}
