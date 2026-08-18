import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  trackOutcome,
  updateOutcomeProgress,
  assessOutcomeStatus,
  getMissionOutcomes,
} from '@/lib/outcome-engine'

// ============================================================
// Mock db
// ============================================================

const mockOutcomeFindFirst = vi.fn()
const mockOutcomeFindUnique = vi.fn()
const mockOutcomeCreate = vi.fn()
const mockOutcomeUpdate = vi.fn()
const mockOutcomeFindMany = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    outcome: {
      findFirst: (...args: unknown[]) => mockOutcomeFindFirst(...args),
      findUnique: (...args: unknown[]) => mockOutcomeFindUnique(...args),
      create: (...args: unknown[]) => mockOutcomeCreate(...args),
      update: (...args: unknown[]) => mockOutcomeUpdate(...args),
      findMany: (...args: unknown[]) => mockOutcomeFindMany(...args),
    },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

// ============================================================
// trackOutcome
// ============================================================

describe('trackOutcome', () => {
  it('creates a new outcome when none exists', async () => {
    mockOutcomeFindFirst.mockResolvedValue(null)
    mockOutcomeCreate.mockImplementation(({ data }) => ({
      ...data, id: 'out_1', createdAt: new Date(), updatedAt: new Date(),
    }))

    const result = await trackOutcome({
      missionId: 'm1',
      organizationId: 'o1',
      objective: 'Increase revenue',
      baseline: { revenue: 1000 },
      target: { revenue: 2000 },
    })

    expect(mockOutcomeCreate).toHaveBeenCalledTimes(1)
    expect(result.id).toBe('out_1')
  })

  it('updates existing outcome when found', async () => {
    mockOutcomeFindFirst.mockResolvedValue({
      id: 'out_1',
      objective: 'Increase revenue',
      baseline: JSON.stringify({ revenue: 1000 }),
      target: JSON.stringify({ revenue: 1500 }),
    })
    mockOutcomeUpdate.mockImplementation(({ data }) => ({
      id: 'out_1', ...data, createdAt: new Date(), updatedAt: new Date(),
    }))

    const result = await trackOutcome({
      missionId: 'm1',
      organizationId: 'o1',
      objective: 'Increase revenue',
      baseline: { revenue: 1000 },
      target: { revenue: 2500 },
    })

    expect(mockOutcomeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'out_1' } }),
    )
  })

  it('creates with default empty baseline/target', async () => {
    mockOutcomeFindFirst.mockResolvedValue(null)
    mockOutcomeCreate.mockImplementation(({ data }) => ({
      ...data, id: 'out_2', createdAt: new Date(), updatedAt: new Date(),
    }))

    await trackOutcome({
      missionId: 'm1',
      organizationId: 'o1',
      objective: 'Some objective',
    })

    const createData = mockOutcomeCreate.mock.calls[0][0] as { data: { baseline: string; target: string } }
    expect(JSON.parse(createData.data.baseline)).toEqual({})
    expect(JSON.parse(createData.data.target)).toEqual({})
  })

  it('new outcome starts with progress 0 and confidence 0', async () => {
    mockOutcomeFindFirst.mockResolvedValue(null)
    mockOutcomeCreate.mockImplementation(({ data }) => ({
      ...data, id: 'out_3', createdAt: new Date(), updatedAt: new Date(),
    }))

    const result = await trackOutcome({
      missionId: 'm1', organizationId: 'o1', objective: 'obj',
    })

    expect(result.progress).toBe(0)
    expect(result.confidence).toBe(0)
  })

  it('new outcome has status not_started', async () => {
    mockOutcomeFindFirst.mockResolvedValue(null)
    mockOutcomeCreate.mockImplementation(({ data }) => ({
      ...data, id: 'out_4', createdAt: new Date(), updatedAt: new Date(),
    }))

    const result = await trackOutcome({
      missionId: 'm1', organizationId: 'o1', objective: 'obj',
    })

    expect(result.status).toBe('not_started')
  })

  it('updated outcome has status in_progress', async () => {
    mockOutcomeFindFirst.mockResolvedValue({
      id: 'out_1', objective: 'obj', baseline: '{}', target: '{}',
    })
    mockOutcomeUpdate.mockImplementation(({ data }) => ({
      id: 'out_1', ...data, createdAt: new Date(), updatedAt: new Date(),
    }))

    const result = await trackOutcome({
      missionId: 'm1', organizationId: 'o1', objective: 'obj',
    })

    expect(result.status).toBe('in_progress')
  })
})

// ============================================================
// updateOutcomeProgress
// ============================================================

describe('updateOutcomeProgress', () => {
  it('recalculates progress based on current data', async () => {
    mockOutcomeFindUnique.mockResolvedValue({
      id: 'out_1',
      baseline: JSON.stringify({ revenue: 1000 }),
      target: JSON.stringify({ revenue: 2000 }),
    })
    mockOutcomeUpdate.mockImplementation(({ data }) => ({
      id: 'out_1', ...data, createdAt: new Date(), updatedAt: new Date(),
    }))

    const result = await updateOutcomeProgress('out_1', { revenue: 1500 })

    // 1500 is 50% of the way from 1000 to 2000
    expect(result.progress).toBe(50)
  })

  it('throws when outcome not found', async () => {
    mockOutcomeFindUnique.mockResolvedValue(null)
    await expect(
      updateOutcomeProgress('nonexistent', { revenue: 100 }),
    ).rejects.toThrow('not found')
  })

  it('sets verifiedAt when status is achieved', async () => {
    mockOutcomeFindUnique.mockResolvedValue({
      id: 'out_1',
      baseline: JSON.stringify({ revenue: 1000 }),
      target: JSON.stringify({ revenue: 2000 }),
    })
    mockOutcomeUpdate.mockImplementation(({ data }) => ({
      id: 'out_1', ...data, createdAt: new Date(), updatedAt: new Date(),
    }))

    const result = await updateOutcomeProgress('out_1', { revenue: 2000 })

    expect(result.verifiedAt).toBeDefined()
  })

  it('sets verifiedAt to null when not achieved', async () => {
    mockOutcomeFindUnique.mockResolvedValue({
      id: 'out_1',
      baseline: JSON.stringify({ revenue: 1000 }),
      target: JSON.stringify({ revenue: 2000 }),
    })
    mockOutcomeUpdate.mockImplementation(({ data }) => ({
      id: 'out_1', ...data, createdAt: new Date(), updatedAt: new Date(),
    }))

    const result = await updateOutcomeProgress('out_1', { revenue: 1200 })

    expect(result.verifiedAt).toBeNull()
  })
})

// ============================================================
// assessOutcomeStatus
// ============================================================

describe('assessOutcomeStatus', () => {
  it('returns not_started when no current data', () => {
    const result = assessOutcomeStatus({
      baseline: { revenue: 1000 },
      target: { revenue: 2000 },
      current: {},
    })
    expect(result.status).toBe('not_started')
    expect(result.progress).toBe(0)
  })

  it('returns in_progress for partial progress', () => {
    const result = assessOutcomeStatus({
      baseline: { revenue: 1000 },
      target: { revenue: 2000 },
      current: { revenue: 1300 },
    })
    expect(result.status).toBe('in_progress')
    expect(result.progress).toBe(30)
  })

  it('returns achieved when progress >= 90%', () => {
    const result = assessOutcomeStatus({
      baseline: { revenue: 1000 },
      target: { revenue: 2000 },
      current: { revenue: 1950 },
    })
    expect(result.status).toBe('achieved')
    expect(result.progress).toBe(95)
  })

  it('returns near_target for progress between 50-89%', () => {
    const result = assessOutcomeStatus({
      baseline: { revenue: 1000 },
      target: { revenue: 2000 },
      current: { revenue: 1600 },
    })
    expect(result.status).toBe('near_target')
    expect(result.progress).toBe(60)
  })

  it('returns missed when metric regressed below baseline', () => {
    const result = assessOutcomeStatus({
      baseline: { revenue: 1000 },
      target: { revenue: 2000 },
      current: { revenue: 800 },
    })
    expect(result.status).toBe('missed')
  })

  it('returns not_started for empty baseline and target', () => {
    const result = assessOutcomeStatus({
      baseline: {},
      target: {},
      current: { revenue: 100 },
    })
    expect(result.status).toBe('not_started')
    expect(result.progress).toBe(0)
  })

  it('calculates confidence based on metrics with data', () => {
    const result = assessOutcomeStatus({
      baseline: { revenue: 1000, users: 500 },
      target: { revenue: 2000, users: 1000 },
      current: { revenue: 1500 },
    })
    // 1 of 2 metrics has data
    expect(result.confidence).toBeCloseTo(0.5)
  })

  it('handles 100% progress exactly', () => {
    const result = assessOutcomeStatus({
      baseline: { revenue: 1000 },
      target: { revenue: 2000 },
      current: { revenue: 2000 },
    })
    expect(result.status).toBe('achieved')
    expect(result.progress).toBe(100)
  })
})

// ============================================================
// getMissionOutcomes
// ============================================================

describe('getMissionOutcomes', () => {
  it('returns array of outcomes', async () => {
    const outcomes = [
      { id: 'out_1', missionId: 'm1', objective: 'obj1' },
      { id: 'out_2', missionId: 'm1', objective: 'obj2' },
    ]
    mockOutcomeFindMany.mockResolvedValue(outcomes)

    const result = await getMissionOutcomes('m1')
    expect(result).toEqual(outcomes)
  })

  it('queries with correct missionId and order', async () => {
    mockOutcomeFindMany.mockResolvedValue([])

    await getMissionOutcomes('m1')

    expect(mockOutcomeFindMany).toHaveBeenCalledWith({
      where: { missionId: 'm1' },
      orderBy: { createdAt: 'asc' },
    })
  })

  it('returns empty array when no outcomes', async () => {
    mockOutcomeFindMany.mockResolvedValue([])

    const result = await getMissionOutcomes('m1')
    expect(result).toEqual([])
  })
})
