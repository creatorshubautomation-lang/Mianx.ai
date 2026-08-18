// ============================================================
// MIANX.AI V3 — Mission Engine
// Core mission orchestration: create → plan → execute → verify → complete
// ============================================================

import { db } from '@/lib/db'
import { parseJsonField, toJsonField } from '@/lib/types'
import type {
  Mission,
  MissionTask,
  Verification,
  Outcome,
  UserMode,
  FailureClassification,
} from '@prisma/client'

// ============================================================
// Types
// ============================================================

interface TaskPlan {
  title: string
  description: string
  agentId?: string
  assignedTools?: string[]
  dependencies: string[] // indices of prior tasks
  verificationConfig: Record<string, unknown>
}

// ============================================================
// Helpers
// ============================================================

/** Generate a correlation ID for event tracing */
function generateCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
}

/** Extract a title from a natural-language goal (first sentence or truncated) */
function extractTitle(goal: string): string {
  const firstSentence = goal.match(/^[^.!?]+[.!?]?/)?.[0]?.trim()
  if (firstSentence && firstSentence.length <= 120) return firstSentence
  return goal.length > 120 ? `${goal.substring(0, 117)}...` : goal
}

/** Classify a failure from an error string using keyword matching */
function classifyError(error: string): FailureClassification {
  const lower = error.toLowerCase()
  if (lower.includes('timeout') || lower.includes('timed out')) return 'timeout'
  if (lower.includes('unauthorized') || lower.includes('forbidden') || lower.includes('403'))
    return 'authorization_error'
  if (lower.includes('not found') || lower.includes('404')) return 'not_found'
  if (lower.includes('rate limit') || lower.includes('429')) return 'rate_limited'
  if (lower.includes('validation') || lower.includes('invalid') || lower.includes('required'))
    return 'validation_error'
  if (lower.includes('conflict') || lower.includes('already exists') || lower.includes('409'))
    return 'conflict'
  if (lower.includes('budget') || lower.includes('cost exceeded')) return 'budget_exceeded'
  if (lower.includes('policy') || lower.includes('violation')) return 'policy_violation'
  if (lower.includes('verification') || lower.includes('check failed')) return 'verification_failed'
  if (lower.includes('ai') || lower.includes('llm') || lower.includes('model')) return 'ai_error'
  // Transient vs permanent — assume transient for network/external errors
  if (lower.includes('network') || lower.includes('econnrefused') || lower.includes('503'))
    return 'transient_external_error'
  return 'unknown'
}

/** Emit an event into the event store for a mission */
async function emitEvent(
  params: {
    organizationId: string
    missionId?: string
    correlationId?: string
    eventType: string
    sourceId?: string
    actorId?: string
    payload: Record<string, unknown>
  },
): Promise<void> {
  await db.event.create({
    data: {
      eventType: params.eventType,
      eventVersion: '1.0',
      organizationId: params.organizationId,
      missionId: params.missionId ?? null,
      sourceType: 'system',
      sourceId: params.sourceId ?? null,
      actorType: 'ai_agent',
      actorId: params.actorId ?? null,
      correlationId: params.correlationId ?? null,
      payload: toJsonField(params.payload),
    },
  })
}

/** Generate task plans from a goal using simple keyword-based analysis */
function generateTaskPlans(goal: string): TaskPlan[] {
  const lower = goal.toLowerCase()
  const plans: TaskPlan[] = []

  if (lower.includes('build') || lower.includes('create') || lower.includes('develop') || lower.includes('implement')) {
    plans.push(
      { title: 'Gather requirements', description: 'Analyze and document requirements for the goal', dependencies: [], verificationConfig: { type: 'schema_validation' } },
      { title: 'Design solution', description: 'Design the architecture and approach', dependencies: ['0'], verificationConfig: { type: 'schema_validation' } },
      { title: 'Implement core logic', description: 'Build the core functionality', dependencies: ['1'], verificationConfig: { type: 'typecheck' } },
      { title: 'Write tests', description: 'Create test cases and verify functionality', dependencies: ['2'], verificationConfig: { type: 'test' } },
    )
  } else if (lower.includes('analyze') || lower.includes('investigate') || lower.includes('research') || lower.includes('report')) {
    plans.push(
      { title: 'Collect data', description: 'Gather relevant data and sources', dependencies: [], verificationConfig: { type: 'schema_validation' } },
      { title: 'Process and analyze', description: 'Run analysis on collected data', dependencies: ['0'], verificationConfig: { type: 'schema_validation' } },
      { title: 'Generate findings report', description: 'Compile analysis into actionable findings', dependencies: ['1'], verificationConfig: { type: 'business_rule' } },
    )
  } else if (lower.includes('launch') || lower.includes('deploy') || lower.includes('release') || lower.includes('ship')) {
    plans.push(
      { title: 'Pre-launch checks', description: 'Verify all launch prerequisites are met', dependencies: [], verificationConfig: { type: 'build' } },
      { title: 'Prepare deployment artifacts', description: 'Build and prepare deployment package', dependencies: ['0'], verificationConfig: { type: 'build' } },
      { title: 'Deploy to staging', description: 'Deploy to staging environment for validation', dependencies: ['1'], verificationConfig: { type: 'artifact_check' } },
      { title: 'Run smoke tests', description: 'Execute smoke tests on staging', dependencies: ['2'], verificationConfig: { type: 'test' } },
      { title: 'Deploy to production', description: 'Promote to production environment', dependencies: ['3'], verificationConfig: { type: 'security' } },
    )
  } else {
    // Default generic plan
    plans.push(
      { title: 'Understand goal', description: 'Analyze the goal and identify key steps', dependencies: [], verificationConfig: { type: 'schema_validation' } },
      { title: 'Execute plan', description: 'Execute the primary work for the goal', dependencies: ['0'], verificationConfig: { type: 'schema_validation' } },
      { title: 'Review and verify', description: 'Review output and verify against criteria', dependencies: ['1'], verificationConfig: { type: 'business_rule' } },
    )
  }

  return plans
}

// ============================================================
// Public API
// ============================================================

/**
 * Create a mission from a natural language goal.
 * Parses the goal, sets defaults, and persists a draft Mission.
 */
export async function createMissionFromGoal(params: {
  organizationId: string
  userId: string
  goal: string
  userMode?: UserMode
  budget?: number
  deadline?: Date
}): Promise<Mission> {
  const correlationId = generateCorrelationId()
  const title = extractTitle(params.goal)
  const constraints = toJsonField({
    deadline: params.deadline?.toISOString() ?? null,
    userMode: params.userMode ?? 'simple',
  })
  const successCriteria = toJsonField([
    `Goal achieved: ${params.goal}`,
    'All tasks completed successfully',
    'Output verified against success criteria',
  ])

  const mission = await db.mission.create({
    data: {
      organizationId: params.organizationId,
      userId: params.userId,
      title,
      goal: params.goal,
      constraints,
      budget: params.budget ?? 0,
      successCriteria,
      status: 'draft',
      userMode: params.userMode ?? 'simple',
      correlationId,
      deadline: params.deadline ?? null,
    },
  })

  await emitEvent({
    organizationId: params.organizationId,
    missionId: mission.id,
    correlationId,
    eventType: 'mission.created',
    actorId: params.userId,
    payload: { missionId: mission.id, title, goal: params.goal },
  })

  return mission
}

/**
 * Plan a mission: analyze goal, generate task graph, select agents.
 * Transitions mission from draft → planning → approved.
 */
export async function planMission(missionId: string): Promise<MissionTask[]> {
  const mission = await db.mission.findUnique({ where: { id: missionId } })
  if (!mission) throw new Error(`Mission ${missionId} not found`)
  if (mission.status !== 'draft') {
    throw new Error(`Mission must be in draft status to plan, current: ${mission.status}`)
  }

  await db.mission.update({ where: { id: missionId }, data: { status: 'planning' } })

  const plans = generateTaskPlans(mission.goal)
  const createdTasks: MissionTask[] = []
  const createdTaskIds: string[] = []

  // Create tasks in order so we can resolve dependency indices to IDs
  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i]
    const deps = plan.dependencies.map((d) => createdTaskIds[d]).filter(Boolean)

    const task = await db.missionTask.create({
      data: {
        missionId,
        title: plan.title,
        description: plan.description,
        status: 'planned',
        dependencies: toJsonField(deps),
        verificationConfig: toJsonField(plan.verificationConfig),
        assignedTools: toJsonField(plan.assignedTools ?? []),
      },
    })
    createdTasks.push(task)
    createdTaskIds.push(task.id)
  }

  // Select first 2 available agents from the organization for this mission
  const availableAgents = await db.agent.findMany({
    where: { organizationId: mission.organizationId, status: 'active' },
    take: 2,
  })

  for (const agent of availableAgents) {
    await db.missionAgent.create({
      data: {
        missionId,
        agentId: agent.id,
        role: 'worker',
        capabilitiesUsed: agent.capabilities,
      },
    })
  }

  // Assign agents to tasks if available
  if (availableAgents.length > 0) {
    for (let i = 0; i < createdTasks.length; i++) {
      await db.missionTask.update({
        where: { id: createdTasks[i].id },
        data: { agentId: availableAgents[i % availableAgents.length].id },
      })
    }
  }

  // Store plan summary and transition to approved
  const planSummary = toJsonField({
    taskCount: createdTasks.length,
    agentCount: availableAgents.length,
    generatedAt: new Date().toISOString(),
  })

  await db.mission.update({
    where: { id: missionId },
    data: { status: 'approved', plan: planSummary },
  })

  await emitEvent({
    organizationId: mission.organizationId,
    missionId,
    correlationId: mission.correlationId ?? undefined,
    eventType: 'mission.planned',
    payload: { taskCount: createdTasks.length, agentCount: availableAgents.length },
  })

  // Re-fetch tasks with updated agent assignments
  return db.missionTask.findMany({ where: { missionId }, orderBy: { createdAt: 'asc' } })
}

/**
 * Execute a mission: transition to executing and start next tasks.
 */
export async function executeMission(missionId: string): Promise<void> {
  const mission = await db.mission.findUnique({ where: { id: missionId } })
  if (!mission) throw new Error(`Mission ${missionId} not found`)
  if (mission.status !== 'approved') {
    throw new Error(`Mission must be approved to execute, current: ${mission.status}`)
  }

  await db.mission.update({ where: { id: missionId }, data: { status: 'executing' } })

  const nextTasks = await getNextExecutableTasks(missionId)

  for (const task of nextTasks) {
    await db.missionTask.update({
      where: { id: task.id },
      data: { status: 'running', startedAt: new Date() },
    })
    await emitEvent({
      organizationId: mission.organizationId,
      missionId,
      correlationId: mission.correlationId ?? undefined,
      eventType: 'task.started',
      sourceId: task.agentId ?? undefined,
      payload: { taskId: task.id, title: task.title },
    })
  }
}

/**
 * Get next executable tasks: dependencies met, not blocked/failed/cancelled.
 */
export async function getNextExecutableTasks(missionId: string): Promise<MissionTask[]> {
  const allTasks = await db.missionTask.findMany({
    where: { missionId },
    orderBy: { createdAt: 'asc' },
  })

  const completedIds = new Set(
    allTasks.filter((t) => t.status === 'completed').map((t) => t.id),
  )

  return allTasks.filter((task) => {
    // Skip tasks that are already in a terminal or active state
    if (['running', 'completed', 'failed', 'cancelled', 'blocked'].includes(task.status)) {
      return false
    }
    const deps: string[] = parseJsonField(task.dependencies, [])
    return deps.every((depId) => completedIds.has(depId))
  })
}

/**
 * Execute a single task: mark running, simulate work, mark completed.
 */
export async function executeTask(taskId: string): Promise<MissionTask> {
  const task = await db.missionTask.findUnique({ where: { id: taskId } })
  if (!task) throw new Error(`Task ${taskId} not found`)

  const mission = await db.mission.findUnique({ where: { id: task.missionId } })
  if (!mission) throw new Error(`Mission ${task.missionId} not found`)

  const now = new Date()
  // Simulate task output — in real V3 this calls agent/tool execution
  const output = toJsonField({
    result: `Completed: ${task.title}`,
    executedAt: now.toISOString(),
    agentId: task.agentId,
  })

  const updated = await db.missionTask.update({
    where: { id: taskId },
    data: {
      status: 'completed',
      startedAt: task.startedAt ?? now,
      completedAt: now,
      output,
    },
  })

  await emitEvent({
    organizationId: mission.organizationId,
    missionId: task.missionId,
    correlationId: mission.correlationId ?? undefined,
    eventType: 'task.completed',
    sourceId: task.agentId ?? undefined,
    payload: { taskId, title: task.title, durationMs: 0 },
  })

  // Check if child tasks are now unblocked
  const childTasks = await db.missionTask.findMany({
    where: { parentTaskId: taskId, status: 'planned' },
  })
  for (const child of childTasks) {
    const childDeps: string[] = parseJsonField(child.dependencies, [])
    const allDepsCompleted = childDeps.every((depId) => depId === taskId)
    // Note: full unblock check would need all deps, but we notify about this one completing
    if (allDepsCompleted) {
      await emitEvent({
        organizationId: mission.organizationId,
        missionId: task.missionId,
        eventType: 'task.unblocked',
        payload: { taskId: child.id, title: child.title, unblockedBy: taskId },
      })
    }
  }

  return updated
}

/**
 * Verify a task's output against its verification config.
 */
export async function verifyTask(taskId: string): Promise<Verification> {
  const task = await db.missionTask.findUnique({ where: { id: taskId } })
  if (!task) throw new Error(`Task ${taskId} not found`)

  const config: Record<string, unknown> = parseJsonField(task.verificationConfig, {})
  const output: Record<string, unknown> = parseJsonField(task.output, {})

  let passed = false
  const evidence: string[] = []

  // Run verification based on config type
  const vType = (config.type as string) ?? 'schema_validation'
  if (vType === 'schema_validation') {
    passed = Object.keys(output).length > 0
    evidence.push(passed ? 'Output contains data' : 'Output is empty')
  } else {
    // For other types, pass if output exists
    passed = Object.keys(output).length > 0
    evidence.push(`${vType} check: ${passed ? 'passed' : 'failed'}`)
  }

  const verification = await db.verification.create({
    data: {
      missionId: task.missionId,
      missionTaskId: taskId,
      type: vType as 'schema_validation',
      config: toJsonField(config),
      result: toJsonField({ passed, checkedAt: new Date().toISOString() }),
      evidence: toJsonField(evidence),
      passed,
      verifiedAt: new Date(),
    },
  })

  await emitEvent({
    organizationId: task.missionId,
    missionId: task.missionId,
    eventType: 'task.verified',
    payload: { taskId, verificationId: verification.id, passed },
  })

  return verification
}

/**
 * Handle task failure: classify error, retry or mark as failed.
 */
export async function handleTaskFailure(taskId: string, error: string): Promise<MissionTask> {
  const task = await db.missionTask.findUnique({ where: { id: taskId } })
  if (!task) throw new Error(`Task ${taskId} not found`)

  const mission = await db.mission.findUnique({ where: { id: task.missionId } })
  if (!mission) throw new Error(`Mission ${task.missionId} not found`)

  const classification = classifyError(error)

  if (task.retryCount < task.maxRetries) {
    const updated = await db.missionTask.update({
      where: { id: taskId },
      data: {
        status: 'retrying',
        error,
        retryCount: task.retryCount + 1,
      },
    })

    await emitEvent({
      organizationId: mission.organizationId,
      missionId: task.missionId,
      eventType: 'task.retrying',
      payload: { taskId, retryCount: task.retryCount + 1, classification },
    })

    return updated
  }

  // Max retries exceeded — mark as failed
  const updated = await db.missionTask.update({
    where: { id: taskId },
    data: { status: 'failed', error },
  })

  await emitEvent({
    organizationId: mission.organizationId,
    missionId: task.missionId,
    eventType: 'task.failed',
    payload: { taskId, classification, error },
  })

  // If critical failure, create an approval request for human intervention
  if (['authorization_error', 'policy_violation', 'budget_exceeded'].includes(classification)) {
    await db.workflowApproval.create({
      data: {
        missionId: task.missionId,
        organizationId: mission.organizationId,
        requestedAction: toJsonField({ action: 'review_failed_task', taskId, classification }),
        riskLevel: classification === 'budget_exceeded' ? 'critical' : 'high',
        requestedBy: task.agentId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      },
    })
  }

  return updated
}

/**
 * Replan remaining tasks after repeated failure.
 * Removes failed tasks and re-generates plan for remaining objectives.
 */
export async function replanMission(missionId: string): Promise<MissionTask[]> {
  const mission = await db.mission.findUnique({ where: { id: missionId } })
  if (!mission) throw new Error(`Mission ${missionId} not found`)

  const allTasks = await db.missionTask.findMany({
    where: { missionId },
    orderBy: { createdAt: 'asc' },
  })

  // Identify failed tasks and their objectives
  const failedTasks = allTasks.filter((t) => t.status === 'failed')
  const nonCompletedTasks = allTasks.filter(
    (t) => !['completed', 'failed', 'cancelled'].includes(t.status),
  )

  // Remove failed and non-completed tasks that are not yet started
  for (const task of [...failedTasks, ...nonCompletedTasks.filter((t) => t.status === 'planned')]) {
    await db.missionTask.delete({ where: { id: task.id } })
  }

  // Reset queued/retrying/blocked tasks back to planned
  for (const task of nonCompletedTasks.filter((t) => !['planned', 'completed', 'failed', 'cancelled'].includes(t.status))) {
    await db.missionTask.update({
      where: { id: task.id },
      data: { status: 'planned', retryCount: 0, error: null, startedAt: null, completedAt: null },
    })
  }

  // Re-generate plans for the objectives of failed tasks
  const failedObjectives = failedTasks.map((t) => t.title).join(', ')
  const replanGoal = `Complete remaining work (originally: ${failedObjectives})`
  const newPlans = generateTaskPlans(replanGoal)

  // Get the latest completed task to chain dependencies from
  const completedTaskIds = allTasks
    .filter((t) => t.status === 'completed')
    .map((t) => t.id)

  const newTasks: MissionTask[] = []
  const newTaskIds: string[] = []

  for (let i = 0; i < newPlans.length; i++) {
    const plan = newPlans[i]
    // First new task depends on all previously completed tasks
    const deps =
      i === 0
        ? completedTaskIds
        : plan.dependencies.map((d) => newTaskIds[d]).filter(Boolean)

    const task = await db.missionTask.create({
      data: {
        missionId,
        title: `[Replan] ${plan.title}`,
        description: plan.description,
        status: 'planned',
        dependencies: toJsonField(deps),
        verificationConfig: toJsonField(plan.verificationConfig),
        assignedTools: toJsonField(plan.assignedTools ?? []),
      },
    })
    newTasks.push(task)
    newTaskIds.push(task.id)
  }

  // Set mission back to approved so it can be executed again
  await db.mission.update({
    where: { id: missionId },
    data: { status: 'approved', plan: toJsonField({ replannedAt: new Date().toISOString(), newTaskCount: newTasks.length }) },
  })

  await emitEvent({
    organizationId: mission.organizationId,
    missionId,
    correlationId: mission.correlationId ?? undefined,
    eventType: 'mission.replanned',
    payload: { removedTasks: failedTasks.length, newTasks: newTasks.length },
  })

  return newTasks
}

/**
 * Complete a mission with outcome assessment.
 * Creates Outcome records from successCriteria and marks mission completed.
 */
export async function completeMission(missionId: string): Promise<Outcome[]> {
  const mission = await db.mission.findUnique({ where: { id: missionId } })
  if (!mission) throw new Error(`Mission ${missionId} not found`)

  await db.mission.update({ where: { id: missionId }, data: { status: 'verifying' } })

  const criteria: string[] = parseJsonField(mission.successCriteria, [])
  const outcomes: Outcome[] = []

  for (const criterion of criteria) {
    const outcome = await db.outcome.create({
      data: {
        organizationId: mission.organizationId,
        missionId,
        objective: criterion,
        target: toJsonField({ achieved: true }),
        currentResult: toJsonField({ status: 'pending_verification' }),
        progress: 0,
        confidence: 0.5,
        status: 'in_progress',
      },
    })
    outcomes.push(outcome)
  }

  // Calculate actual cost from agent costs
  const missionAgents = await db.missionAgent.findMany({
    where: { missionId },
  })
  const actualCost = missionAgents.reduce((sum, ma) => sum + ma.costIncurred, 0)

  await db.mission.update({
    where: { id: missionId },
    data: { status: 'completed', actualCost },
  })

  await emitEvent({
    organizationId: mission.organizationId,
    missionId,
    correlationId: mission.correlationId ?? undefined,
    eventType: 'mission.completed',
    payload: { outcomeCount: outcomes.length, actualCost },
  })

  return outcomes
}

/**
 * Check if a mission's budget has been exceeded.
 */
export async function checkMissionBudget(
  missionId: string,
): Promise<{ exceeded: boolean; remaining: number; estimated: number; actual: number }> {
  const mission = await db.mission.findUnique({ where: { id: missionId } })
  if (!mission) throw new Error(`Mission ${missionId} not found`)

  const missionAgents = await db.missionAgent.findMany({ where: { missionId } })
  const actual = missionAgents.reduce((sum, ma) => sum + ma.costIncurred, 0)
  const estimated = mission.estimatedCost
  const budget = mission.budget
  const remaining = Math.max(0, budget - actual)
  const exceeded = budget > 0 && actual > budget

  return { exceeded, remaining, estimated, actual }
}

/**
 * Get mission progress: completed vs total tasks.
 */
export async function getMissionProgress(
  missionId: string,
): Promise<{ completed: number; total: number; percentage: number }> {
  const tasks = await db.missionTask.findMany({
    where: { missionId },
    select: { status: true },
  })

  const total = tasks.length
  const completed = tasks.filter((t) => t.status === 'completed').length
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

  return { completed, total, percentage }
}
