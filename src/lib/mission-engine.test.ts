import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createMissionFromGoal,
  planMission,
  executeMission,
  getNextExecutableTasks,
  handleTaskFailure,
  completeMission,
} from '@/lib/mission-engine'

// ============================================================
// Mock db
// ============================================================

const mockMissionCreate = vi.fn()
const mockMissionFindUnique = vi.fn()
const mockMissionUpdate = vi.fn()
const mockMissionTaskCreate = vi.fn()
const mockMissionTaskFindUnique = vi.fn()
const mockMissionTaskFindMany = vi.fn()
const mockMissionTaskUpdate = vi.fn()
const mockMissionAgentFindMany = vi.fn()
const mockMissionAgentCreate = vi.fn()
const mockEventCreate = vi.fn()
const mockOutcomeCreate = vi.fn()
const mockWorkflowApprovalCreate = vi.fn()
const mockVerificationCreate = vi.fn()
const mockAgentFindMany = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    mission: {
      create: (...args: unknown[]) => mockMissionCreate(...args),
      findUnique: (...args: unknown[]) => mockMissionFindUnique(...args),
      update: (...args: unknown[]) => mockMissionUpdate(...args),
    },
    missionTask: {
      create: (...args: unknown[]) => mockMissionTaskCreate(...args),
      findUnique: (...args: unknown[]) => mockMissionTaskFindUnique(...args),
      findMany: (...args: unknown[]) => mockMissionTaskFindMany(...args),
      update: (...args: unknown[]) => mockMissionTaskUpdate(...args),
    },
    missionAgent: {
      findMany: (...args: unknown[]) => mockMissionAgentFindMany(...args),
      create: (...args: unknown[]) => mockMissionAgentCreate(...args),
    },
    agent: {
      findMany: (...args: unknown[]) => mockAgentFindMany(...args),
    },
    event: {
      create: (...args: unknown[]) => mockEventCreate(...args),
    },
    outcome: {
      create: (...args: unknown[]) => mockOutcomeCreate(...args),
    },
    workflowApproval: {
      create: (...args: unknown[]) => mockWorkflowApprovalCreate(...args),
    },
    verification: {
      create: (...args: unknown[]) => mockVerificationCreate(...args),
    },
  },
}))

beforeEach(() => {
  vi.resetAllMocks()
})

// ============================================================
// createMissionFromGoal
// ============================================================

describe('createMissionFromGoal', () => {
  it('creates a mission with correct fields', async () => {
    mockMissionCreate.mockResolvedValue({
      id: 'mission_1',
      organizationId: 'org_1',
      userId: 'user_1',
      title: 'Build a REST API',
      goal: 'Build a REST API for the team',
      constraints: '{}',
      budget: 0,
      successCriteria: '[]',
      status: 'draft',
      userMode: 'simple',
      correlationId: 'corr_123',
    })
    mockEventCreate.mockResolvedValue({})

    const mission = await createMissionFromGoal({
      organizationId: 'org_1',
      userId: 'user_1',
      goal: 'Build a REST API for the team',
    })

    expect(mission.id).toBe('mission_1')
    expect(mission.status).toBe('draft')
    expect(mission.organizationId).toBe('org_1')
  })

  it('sets default budget to 0', async () => {
    mockMissionCreate.mockResolvedValue({
      id: 'm1', organizationId: 'o1', userId: 'u1',
      title: 'test', goal: 'test', constraints: '{}',
      budget: 0, successCriteria: '[]', status: 'draft',
      userMode: 'simple', correlationId: 'c1',
    })
    mockEventCreate.mockResolvedValue({})

    await createMissionFromGoal({ organizationId: 'o1', userId: 'u1', goal: 'test' })

    const createCall = mockMissionCreate.mock.calls[0][0] as { data: { budget: number } }
    expect(createCall.data.budget).toBe(0)
  })

  it('uses provided budget', async () => {
    mockMissionCreate.mockResolvedValue({
      id: 'm1', organizationId: 'o1', userId: 'u1',
      title: 'test', goal: 'test', constraints: '{}',
      budget: 500, successCriteria: '[]', status: 'draft',
      userMode: 'simple', correlationId: 'c1',
    })
    mockEventCreate.mockResolvedValue({})

    await createMissionFromGoal({
      organizationId: 'o1', userId: 'u1', goal: 'test', budget: 500,
    })

    const createCall = mockMissionCreate.mock.calls[0][0] as { data: { budget: number } }
    expect(createCall.data.budget).toBe(500)
  })

  it('generates a correlationId', async () => {
    mockMissionCreate.mockResolvedValue({
      id: 'm1', organizationId: 'o1', userId: 'u1',
      title: 'test', goal: 'test', constraints: '{}',
      budget: 0, successCriteria: '[]', status: 'draft',
      userMode: 'simple', correlationId: 'corr_abc',
    })
    mockEventCreate.mockResolvedValue({})

    await createMissionFromGoal({ organizationId: 'o1', userId: 'u1', goal: 'test' })
    expect(mockMissionCreate).toHaveBeenCalledTimes(1)
    const createData = mockMissionCreate.mock.calls[0][0] as { data: { correlationId: string } }
    expect(createData.data.correlationId).toMatch(/^corr_/)
  })

  it('emits a mission.created event', async () => {
    mockMissionCreate.mockResolvedValue({
      id: 'm1', organizationId: 'o1', userId: 'u1',
      title: 'test', goal: 'test', constraints: '{}',
      budget: 0, successCriteria: '[]', status: 'draft',
      userMode: 'simple', correlationId: 'c1',
    })
    mockEventCreate.mockResolvedValue({})

    await createMissionFromGoal({ organizationId: 'o1', userId: 'u1', goal: 'test' })
    expect(mockEventCreate).toHaveBeenCalledTimes(1)

    const eventData = mockEventCreate.mock.calls[0][0] as { data: { eventType: string } }
    expect(eventData.data.eventType).toBe('mission.created')
  })

  it('sets userMode to simple by default', async () => {
    mockMissionCreate.mockResolvedValue({
      id: 'm1', organizationId: 'o1', userId: 'u1',
      title: 'test', goal: 'test', constraints: '{}',
      budget: 0, successCriteria: '[]', status: 'draft',
      userMode: 'simple', correlationId: 'c1',
    })
    mockEventCreate.mockResolvedValue({})

    await createMissionFromGoal({ organizationId: 'o1', userId: 'u1', goal: 'test' })

    const createCall = mockMissionCreate.mock.calls[0][0] as { data: { userMode: string } }
    expect(createCall.data.userMode).toBe('simple')
  })

  it('extracts title from goal', async () => {
    mockMissionCreate.mockImplementation(({ data }) => ({
      ...data, id: 'm1', createdAt: new Date(), updatedAt: new Date(),
    }))
    mockEventCreate.mockResolvedValue({})

    await createMissionFromGoal({ organizationId: 'o1', userId: 'u1', goal: 'Build a REST API.' })

    const createCall = mockMissionCreate.mock.calls[0][0] as { data: { title: string } }
    expect(createCall.data.title).toBe('Build a REST API.')
  })

  it('stores deadline in constraints', async () => {
    const deadline = new Date('2025-12-31')
    mockMissionCreate.mockResolvedValue({
      id: 'm1', organizationId: 'o1', userId: 'u1',
      title: 'test', goal: 'test', constraints: '{}',
      budget: 0, successCriteria: '[]', status: 'draft',
      userMode: 'simple', correlationId: 'c1', deadline,
    })
    mockEventCreate.mockResolvedValue({})

    await createMissionFromGoal({ organizationId: 'o1', userId: 'u1', goal: 'test', deadline })

    const createCall = mockMissionCreate.mock.calls[0][0] as { data: { constraints: string } }
    const constraints = JSON.parse(createCall.data.constraints)
    expect(constraints.deadline).toBe('2025-12-31T00:00:00.000Z')
  })
})

// ============================================================
// planMission
// ============================================================

describe('planMission', () => {
  it('creates tasks and sets status to approved', async () => {
    mockMissionFindUnique.mockResolvedValue({
      id: 'm1', status: 'draft', goal: 'build a new API',
      organizationId: 'o1', correlationId: 'c1',
    })
    mockMissionUpdate.mockResolvedValue({})
    mockMissionTaskCreate.mockImplementation(({ data }) => ({
      ...data, id: `task_${Math.random().toString(36).slice(2)}`,
      missionId: 'm1', createdAt: new Date(), updatedAt: new Date(),
      dependencies: data.dependencies ?? '[]',
      verificationConfig: data.verificationConfig ?? '{}',
      assignedTools: data.assignedTools ?? '[]',
      input: '{}', output: '{}',
      error: null, retryCount: 0, maxRetries: 3,
      startedAt: null, completedAt: null,
      parentTaskId: null, description: null, agentId: null,
    }))
    mockAgentFindMany.mockResolvedValue([])
    mockMissionAgentFindMany.mockResolvedValue([])
    mockMissionTaskFindMany.mockResolvedValue([])
    mockEventCreate.mockResolvedValue({})

    const tasks = await planMission('m1')
    expect(mockMissionUpdate).toHaveBeenCalled()
    // Should update to 'approved' (last update call)
    const lastUpdate = mockMissionUpdate.mock.calls[mockMissionUpdate.mock.calls.length - 1]
    expect((lastUpdate[0] as { data: { status: string } }).data.status).toBe('approved')
  })

  it('throws if mission not found', async () => {
    mockMissionFindUnique.mockResolvedValue(null)
    await expect(planMission('nonexistent')).rejects.toThrow('not found')
  })

  it('throws if mission is not in draft status', async () => {
    mockMissionFindUnique.mockResolvedValue({
      id: 'm1', status: 'executing', goal: 'test',
      organizationId: 'o1', correlationId: 'c1',
    })
    await expect(planMission('m1')).rejects.toThrow('must be in draft status')
  })

  it('creates agents for the mission', async () => {
    mockMissionFindUnique.mockResolvedValue({
      id: 'm1', status: 'draft', goal: 'build a new API',
      organizationId: 'o1', correlationId: 'c1',
    })
    mockMissionUpdate.mockResolvedValue({})
    mockMissionTaskCreate.mockImplementation(({ data }) => ({
      ...data, id: `task_${Math.random().toString(36).slice(2)}`,
      missionId: 'm1', createdAt: new Date(), updatedAt: new Date(),
      dependencies: '[]', verificationConfig: '{}', assignedTools: '[]',
      input: '{}', output: '{}', error: null, retryCount: 0, maxRetries: 3,
      startedAt: null, completedAt: null, parentTaskId: null, description: null, agentId: null,
    }))
    mockAgentFindMany.mockResolvedValue([
      { id: 'agent_1', capabilities: '[]' },
      { id: 'agent_2', capabilities: '[]' },
    ])
    mockMissionAgentFindMany.mockResolvedValue([
      { id: 'agent_1', capabilities: '[]' },
      { id: 'agent_2', capabilities: '[]' },
    ])
    mockMissionAgentCreate.mockResolvedValue({})
    mockMissionTaskFindMany.mockResolvedValue([])
    mockEventCreate.mockResolvedValue({})

    await planMission('m1')
    expect(mockMissionAgentCreate).toHaveBeenCalledTimes(2)
  })

  it('generates build tasks for build-related goals', async () => {
    mockMissionFindUnique.mockResolvedValue({
      id: 'm1', status: 'draft', goal: 'Build a new feature for the app',
      organizationId: 'o1', correlationId: 'c1',
    })
    mockMissionUpdate.mockResolvedValue({})
    mockMissionTaskCreate.mockImplementation(({ data }) => ({
      ...data, id: `task_${Math.random().toString(36).slice(2)}`,
      missionId: 'm1', createdAt: new Date(), updatedAt: new Date(),
      dependencies: '[]', verificationConfig: '{}', assignedTools: '[]',
      input: '{}', output: '{}', error: null, retryCount: 0, maxRetries: 3,
      startedAt: null, completedAt: null, parentTaskId: null, description: null, agentId: null,
    }))
    mockAgentFindMany.mockResolvedValue([])
    mockMissionAgentFindMany.mockResolvedValue([])
    mockMissionTaskFindMany.mockResolvedValue([])
    mockEventCreate.mockResolvedValue({})

    await planMission('m1')
    // Build-related goals should create 4 tasks
    expect(mockMissionTaskCreate).toHaveBeenCalledTimes(4)
  })

  it('generates analyze tasks for analyze-related goals', async () => {
    mockMissionFindUnique.mockResolvedValue({
      id: 'm1', status: 'draft', goal: 'Analyze the sales data',
      organizationId: 'o1', correlationId: 'c1',
    })
    mockMissionUpdate.mockResolvedValue({})
    mockMissionTaskCreate.mockImplementation(({ data }) => ({
      ...data, id: `task_${Math.random().toString(36).slice(2)}`,
      missionId: 'm1', createdAt: new Date(), updatedAt: new Date(),
      dependencies: '[]', verificationConfig: '{}', assignedTools: '[]',
      input: '{}', output: '{}', error: null, retryCount: 0, maxRetries: 3,
      startedAt: null, completedAt: null, parentTaskId: null, description: null, agentId: null,
    }))
    mockAgentFindMany.mockResolvedValue([])
    mockMissionAgentFindMany.mockResolvedValue([])
    mockMissionTaskFindMany.mockResolvedValue([])
    mockEventCreate.mockResolvedValue({})

    await planMission('m1')
    // Analyze-related goals create 3 tasks
    expect(mockMissionTaskCreate).toHaveBeenCalledTimes(3)
  })

  it('transitions mission to planning then approved', async () => {
    mockMissionFindUnique.mockResolvedValue({
      id: 'm1', status: 'draft', goal: 'test',
      organizationId: 'o1', correlationId: 'c1',
    })
    mockMissionUpdate.mockResolvedValue({})
    mockMissionTaskCreate.mockImplementation(({ data }) => ({
      ...data, id: `task_${Math.random().toString(36).slice(2)}`,
      missionId: 'm1', createdAt: new Date(), updatedAt: new Date(),
      dependencies: '[]', verificationConfig: '{}', assignedTools: '[]',
      input: '{}', output: '{}', error: null, retryCount: 0, maxRetries: 3,
      startedAt: null, completedAt: null, parentTaskId: null, description: null, agentId: null,
    }))
    mockAgentFindMany.mockResolvedValue([])
    mockMissionAgentFindMany.mockResolvedValue([])
    mockMissionTaskFindMany.mockResolvedValue([])
    mockEventCreate.mockResolvedValue({})

    await planMission('m1')
    // First update: draft -> planning
    expect((mockMissionUpdate.mock.calls[0][0] as { data: { status: string } }).data.status).toBe('planning')
    // Last update: planning -> approved
    const lastCallIdx = mockMissionUpdate.mock.calls.length - 1
    expect((mockMissionUpdate.mock.calls[lastCallIdx][0] as { data: { status: string } }).data.status).toBe('approved')
  })
})

// ============================================================
// executeMission
// ============================================================

describe('executeMission', () => {
  it('transitions mission to executing', async () => {
    mockMissionFindUnique.mockResolvedValue({
      id: 'm1', status: 'approved', organizationId: 'o1', correlationId: 'c1',
    })
    mockMissionUpdate.mockResolvedValue({})
    mockMissionTaskFindMany.mockResolvedValue([
      { id: 't1', status: 'planned', dependencies: '[]' },
    ])
    mockMissionTaskUpdate.mockResolvedValue({})
    mockEventCreate.mockResolvedValue({})

    await executeMission('m1')
    expect(mockMissionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'm1' }, data: { status: 'executing' } }),
    )
  })

  it('throws if mission not found', async () => {
    mockMissionFindUnique.mockResolvedValue(null)
    await expect(executeMission('nonexistent')).rejects.toThrow('not found')
  })

  it('throws if mission is not approved', async () => {
    mockMissionFindUnique.mockResolvedValue({
      id: 'm1', status: 'draft', organizationId: 'o1', correlationId: 'c1',
    })
    await expect(executeMission('m1')).rejects.toThrow('must be approved')
  })

  it('starts next executable tasks', async () => {
    mockMissionFindUnique.mockResolvedValue({
      id: 'm1', status: 'approved', organizationId: 'o1', correlationId: 'c1',
    })
    mockMissionUpdate.mockResolvedValue({})
    mockMissionTaskFindMany
      .mockResolvedValueOnce([{ id: 't1', status: 'planned', dependencies: '[]' }])
      .mockResolvedValueOnce([{ id: 't1', status: 'planned', dependencies: '[]' }])
    mockEventCreate.mockResolvedValue({})

    await executeMission('m1')
    // Should update the task to running
    expect(mockMissionTaskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 't1' },
        data: expect.objectContaining({ status: 'running' }),
      }),
    )
  })
})

// ============================================================
// getNextExecutableTasks
// ============================================================

describe('getNextExecutableTasks', () => {
  it('returns planned tasks with no dependencies', async () => {
    mockMissionTaskFindMany.mockResolvedValue([
      { id: 't1', status: 'planned', dependencies: '[]' },
      { id: 't2', status: 'planned', dependencies: '[]' },
    ])
    const tasks = await getNextExecutableTasks('m1')
    expect(tasks).toHaveLength(2)
  })

  it('filters out running tasks', async () => {
    mockMissionTaskFindMany.mockResolvedValue([
      { id: 't1', status: 'running', dependencies: '[]' },
      { id: 't2', status: 'planned', dependencies: '[]' },
    ])
    const tasks = await getNextExecutableTasks('m1')
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('t2')
  })

  it('filters out completed tasks', async () => {
    mockMissionTaskFindMany.mockResolvedValue([
      { id: 't1', status: 'completed', dependencies: '[]' },
      { id: 't2', status: 'planned', dependencies: '[]' },
    ])
    const tasks = await getNextExecutableTasks('m1')
    expect(tasks).toHaveLength(1)
  })

  it('filters out failed tasks', async () => {
    mockMissionTaskFindMany.mockResolvedValue([
      { id: 't1', status: 'failed', dependencies: '[]' },
      { id: 't2', status: 'planned', dependencies: '[]' },
    ])
    const tasks = await getNextExecutableTasks('m1')
    expect(tasks).toHaveLength(1)
  })

  it('filters out blocked tasks', async () => {
    mockMissionTaskFindMany.mockResolvedValue([
      { id: 't1', status: 'blocked', dependencies: '[]' },
      { id: 't2', status: 'planned', dependencies: '[]' },
    ])
    const tasks = await getNextExecutableTasks('m1')
    expect(tasks).toHaveLength(1)
  })

  it('does not return tasks with unmet dependencies', async () => {
    mockMissionTaskFindMany.mockResolvedValue([
      { id: 't1', status: 'planned', dependencies: '[]' },
      { id: 't2', status: 'planned', dependencies: '["t1"]' },
    ])
    const tasks = await getNextExecutableTasks('m1')
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('t1')
  })

  it('returns tasks with completed dependencies', async () => {
    mockMissionTaskFindMany.mockResolvedValue([
      { id: 't1', status: 'completed', dependencies: '[]' },
      { id: 't2', status: 'planned', dependencies: '["t1"]' },
    ])
    const tasks = await getNextExecutableTasks('m1')
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('t2')
  })

  it('returns empty array when no tasks are executable', async () => {
    mockMissionTaskFindMany.mockResolvedValue([
      { id: 't1', status: 'running', dependencies: '[]' },
    ])
    const tasks = await getNextExecutableTasks('m1')
    expect(tasks).toHaveLength(0)
  })

  it('filters out cancelled tasks', async () => {
    mockMissionTaskFindMany.mockResolvedValue([
      { id: 't1', status: 'cancelled', dependencies: '[]' },
      { id: 't2', status: 'planned', dependencies: '[]' },
    ])
    const tasks = await getNextExecutableTasks('m1')
    expect(tasks).toHaveLength(1)
  })
})

// ============================================================
// handleTaskFailure
// ============================================================

describe('handleTaskFailure', () => {
  it('retries task when retries remain', async () => {
    mockMissionTaskFindUnique.mockResolvedValue({
      id: 't1', missionId: 'm1', retryCount: 0, maxRetries: 3,
      agentId: null,
    })
    mockMissionFindUnique.mockResolvedValue({
      id: 'm1', organizationId: 'o1',
    })
    mockMissionTaskUpdate.mockResolvedValue({})
    mockEventCreate.mockResolvedValue({})

    const result = await handleTaskFailure('t1', 'timeout error')
    expect(mockMissionTaskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'retrying', retryCount: 1 }),
      }),
    )
  })

  it('marks task as failed when max retries exceeded', async () => {
    mockMissionTaskFindUnique.mockResolvedValue({
      id: 't1', missionId: 'm1', retryCount: 3, maxRetries: 3,
      agentId: null,
    })
    mockMissionFindUnique.mockResolvedValue({
      id: 'm1', organizationId: 'o1',
    })
    mockMissionTaskUpdate.mockResolvedValue({})
    mockEventCreate.mockResolvedValue({})

    await handleTaskFailure('t1', 'fatal error')
    expect(mockMissionTaskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed' }),
      }),
    )
  })

  it('creates approval for authorization errors on failure', async () => {
    mockMissionTaskFindUnique.mockResolvedValue({
      id: 't1', missionId: 'm1', retryCount: 3, maxRetries: 3,
      agentId: null,
    })
    mockMissionFindUnique.mockResolvedValue({
      id: 'm1', organizationId: 'o1',
    })
    mockMissionTaskUpdate.mockResolvedValue({})
    mockEventCreate.mockResolvedValue({})
    mockWorkflowApprovalCreate.mockResolvedValue({})

    await handleTaskFailure('t1', 'unauthorized access denied')
    expect(mockWorkflowApprovalCreate).toHaveBeenCalledTimes(1)
  })

  it('creates approval for budget errors on failure', async () => {
    mockMissionTaskFindUnique.mockResolvedValue({
      id: 't1', missionId: 'm1', retryCount: 3, maxRetries: 3,
      agentId: null,
    })
    mockMissionFindUnique.mockResolvedValue({
      id: 'm1', organizationId: 'o1',
    })
    mockMissionTaskUpdate.mockResolvedValue({})
    mockEventCreate.mockResolvedValue({})
    mockWorkflowApprovalCreate.mockResolvedValue({})

    await handleTaskFailure('t1', 'budget exceeded limit')
    expect(mockWorkflowApprovalCreate).toHaveBeenCalledTimes(1)
    const callData = mockWorkflowApprovalCreate.mock.calls[0][0] as { data: { riskLevel: string } }
    expect(callData.data.riskLevel).toBe('critical')
  })

  it('does not create approval for transient errors', async () => {
    mockMissionTaskFindUnique.mockResolvedValue({
      id: 't1', missionId: 'm1', retryCount: 3, maxRetries: 3,
      agentId: null,
    })
    mockMissionFindUnique.mockResolvedValue({
      id: 'm1', organizationId: 'o1',
    })
    mockMissionTaskUpdate.mockResolvedValue({})
    mockEventCreate.mockResolvedValue({})
    mockWorkflowApprovalCreate.mockResolvedValue({})

    await handleTaskFailure('t1', 'some unknown error')
    expect(mockWorkflowApprovalCreate).not.toHaveBeenCalled()
  })

  it('emits task.retrying event on retry', async () => {
    mockMissionTaskFindUnique.mockResolvedValue({
      id: 't1', missionId: 'm1', retryCount: 0, maxRetries: 3,
      agentId: null,
    })
    mockMissionFindUnique.mockResolvedValue({
      id: 'm1', organizationId: 'o1',
    })
    mockMissionTaskUpdate.mockResolvedValue({})
    mockEventCreate.mockResolvedValue({})

    await handleTaskFailure('t1', 'error')
    const eventData = mockEventCreate.mock.calls[0][0] as { data: { eventType: string } }
    expect(eventData.data.eventType).toBe('task.retrying')
  })

  it('emits task.failed event on final failure', async () => {
    mockMissionTaskFindUnique.mockResolvedValue({
      id: 't1', missionId: 'm1', retryCount: 3, maxRetries: 3,
      agentId: null,
    })
    mockMissionFindUnique.mockResolvedValue({
      id: 'm1', organizationId: 'o1',
    })
    mockMissionTaskUpdate.mockResolvedValue({})
    mockEventCreate.mockResolvedValue({})

    await handleTaskFailure('t1', 'fatal')
    const eventData = mockEventCreate.mock.calls[0][0] as { data: { eventType: string } }
    expect(eventData.data.eventType).toBe('task.failed')
  })

  it('stores the error message on the task', async () => {
    mockMissionTaskFindUnique.mockResolvedValue({
      id: 't1', missionId: 'm1', retryCount: 3, maxRetries: 3,
      agentId: null,
    })
    mockMissionFindUnique.mockResolvedValue({
      id: 'm1', organizationId: 'o1',
    })
    mockMissionTaskUpdate.mockResolvedValue({})
    mockEventCreate.mockResolvedValue({})

    await handleTaskFailure('t1', 'specific error msg')
    const callData = mockMissionTaskUpdate.mock.calls[0][0] as { data: { error: string } }
    expect(callData.data.error).toBe('specific error msg')
  })
})

// ============================================================
// completeMission
// ============================================================

describe('completeMission', () => {
  it('creates outcomes from success criteria', async () => {
    mockMissionFindUnique.mockResolvedValue({
      id: 'm1', organizationId: 'o1', successCriteria: JSON.stringify(['criterion 1', 'criterion 2']),
    })
    mockMissionUpdate.mockResolvedValue({})
    mockOutcomeCreate.mockImplementation(({ data }) => ({
      ...data, id: 'out_1', createdAt: new Date(), updatedAt: new Date(),
    }))
    mockMissionAgentFindMany.mockResolvedValue([])
    mockEventCreate.mockResolvedValue({})

    const outcomes = await completeMission('m1')
    expect(outcomes).toHaveLength(2)
    expect(mockOutcomeCreate).toHaveBeenCalledTimes(2)
  })

  it('transitions mission to completed', async () => {
    mockMissionFindUnique.mockResolvedValue({
      id: 'm1', organizationId: 'o1', successCriteria: JSON.stringify(['done']),
    })
    mockMissionUpdate.mockResolvedValue({})
    mockOutcomeCreate.mockImplementation(({ data }) => ({
      ...data, id: 'out_1', createdAt: new Date(), updatedAt: new Date(),
    }))
    mockMissionAgentFindMany.mockResolvedValue([])
    mockEventCreate.mockResolvedValue({})

    await completeMission('m1')
    // Last update should be to 'completed'
    const lastUpdate = mockMissionUpdate.mock.calls[mockMissionUpdate.mock.calls.length - 1]
    expect((lastUpdate[0] as { data: { status: string } }).data.status).toBe('completed')
  })

  it('calculates actual cost from mission agents', async () => {
    mockMissionFindUnique.mockResolvedValue({
      id: 'm1', organizationId: 'o1', successCriteria: JSON.stringify(['done']),
    })
    mockMissionUpdate.mockResolvedValue({})
    mockOutcomeCreate.mockImplementation(({ data }) => ({
      ...data, id: 'out_1', createdAt: new Date(), updatedAt: new Date(),
    }))
    mockMissionAgentFindMany.mockResolvedValue([
      { costIncurred: 10 },
      { costIncurred: 25 },
    ])
    mockEventCreate.mockResolvedValue({})

    await completeMission('m1')
    const lastUpdate = mockMissionUpdate.mock.calls[mockMissionUpdate.mock.calls.length - 1]
    expect((lastUpdate[0] as { data: { actualCost: number } }).data.actualCost).toBe(35)
  })

  it('emits mission.completed event', async () => {
    mockMissionFindUnique.mockResolvedValue({
      id: 'm1', organizationId: 'o1', successCriteria: JSON.stringify(['done']),
    })
    mockMissionUpdate.mockResolvedValue({})
    mockOutcomeCreate.mockImplementation(({ data }) => ({
      ...data, id: 'out_1', createdAt: new Date(), updatedAt: new Date(),
    }))
    mockMissionAgentFindMany.mockResolvedValue([])
    mockEventCreate.mockResolvedValue({})

    await completeMission('m1')
    expect(mockEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'mission.completed' }),
      }),
    )
  })

  it('throws if mission not found', async () => {
    mockMissionFindUnique.mockResolvedValue(null)
    await expect(completeMission('nonexistent')).rejects.toThrow('not found')
  })

  it('first transitions to verifying', async () => {
    mockMissionFindUnique.mockResolvedValue({
      id: 'm1', organizationId: 'o1', successCriteria: JSON.stringify(['done']),
    })
    mockMissionUpdate.mockResolvedValue({})
    mockOutcomeCreate.mockImplementation(({ data }) => ({
      ...data, id: 'out_1', createdAt: new Date(), updatedAt: new Date(),
    }))
    mockMissionAgentFindMany.mockResolvedValue([])
    mockEventCreate.mockResolvedValue({})

    await completeMission('m1')
    expect((mockMissionUpdate.mock.calls[0][0] as { data: { status: string } }).data.status).toBe('verifying')
  })

  it('creates outcomes with correct initial values', async () => {
    mockMissionFindUnique.mockResolvedValue({
      id: 'm1', organizationId: 'o1', successCriteria: JSON.stringify(['obj1']),
    })
    mockMissionUpdate.mockResolvedValue({})
    mockOutcomeCreate.mockImplementation(({ data }) => ({
      ...data, id: 'out_1', createdAt: new Date(), updatedAt: new Date(),
    }))
    mockMissionAgentFindMany.mockResolvedValue([])
    mockEventCreate.mockResolvedValue({})

    await completeMission('m1')
    const createData = mockOutcomeCreate.mock.calls[0][0] as { data: { status: string; progress: number; confidence: number } }
    expect(createData.data.status).toBe('in_progress')
    expect(createData.data.progress).toBe(0)
    expect(createData.data.confidence).toBe(0.5)
  })
})
