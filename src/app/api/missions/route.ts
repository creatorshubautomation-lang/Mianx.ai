import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  created,
  getPaginationParams,
  buildPaginationMeta,
  getOrgIdParam,
  requireBody,
  ValidationError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'
import { toJsonField, generateRequestId } from '@/lib/types'
import type { CreateMissionDto } from '@/lib/types'

// GET /api/missions
export async function GET(request: Request) {
  return withErrorHandler(async () => {
    const userId = getUserIdFromRequest(request)
    const { searchParams } = new URL(request.url)
    const organizationId = getOrgIdParam(searchParams)
    if (!organizationId) throw new ValidationError('organizationId query parameter is required')

    await requireOrgMember(userId, organizationId)

    const { cursor, limit } = getPaginationParams(searchParams)
    const status = searchParams.get('status') ?? undefined
    const search = searchParams.get('search') ?? undefined

    const where: Record<string, unknown> = { organizationId }
    if (status) where.status = status
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { goal: { contains: search } },
      ]
    }

    const [total, items] = await Promise.all([
      db.mission.count({ where }),
      db.mission.findMany({
        where,
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: 'desc' },
        include: {
          agents: { include: { agent: { select: { id: true, name: true, slug: true } } } },
          _count: { select: { tasks: true, outcomes: true, verifications: true } },
        },
      }),
    ])

    // Fetch completed task counts per mission for progress
    const missionIds = items.map((m) => m.id)
    const completedCounts = missionIds.length > 0
      ? await db.missionTask.groupBy({
          by: ['missionId'],
          where: { missionId: { in: missionIds }, status: 'completed' },
          _count: { id: true },
        })
      : []
    const completedMap = Object.fromEntries(
      completedCounts.map((c) => [c.missionId, c._count.id]),
    )

    const nextCursor = items.length === limit ? items[items.length - 1].id : null

    const data = items.map((m) => ({
      ...m,
      _completedTasks: completedMap[m.id] ?? 0,
      deadline: m.deadline ? String(m.deadline) : null,
      createdAt: String(m.createdAt),
      updatedAt: String(m.updatedAt),
    }))

    return success(data, buildPaginationMeta(total, limit, items, nextCursor))
  })
}

// POST /api/missions
export async function POST(request: Request) {
  return withErrorHandler(async () => {
    const userId = getUserIdFromRequest(request)
    const { searchParams } = new URL(request.url)
    const organizationId = getOrgIdParam(searchParams)
    if (!organizationId) throw new ValidationError('organizationId query parameter is required')

    await requireOrgMember(userId, organizationId)
    await requirePermission(userId, organizationId, [Permissions.MISSION_CREATE])

    const body = await requireBody<CreateMissionDto>(request)

    if (!body.title?.trim()) throw new ValidationError('Mission title is required')
    if (!body.goal?.trim()) throw new ValidationError('Mission goal is required')

    const correlationId = `mis_${Date.now()}_${generateRequestId().slice(-8)}`

    const mission = await db.mission.create({
      data: {
        organizationId,
        userId,
        title: body.title.trim(),
        goal: body.goal.trim(),
        objective: body.objective ?? null,
        constraints: toJsonField(body.constraints ?? {}),
        budget: body.budget ?? 0,
        estimatedCost: body.estimatedCost ?? 0,
        deadline: body.deadline ? new Date(body.deadline) : null,
        successCriteria: toJsonField(body.successCriteria ?? []),
        plan: toJsonField(body.plan ?? {}),
        userMode: body.userMode ?? 'simple',
        correlationId,
        ...(body.agentIds?.length
          ? {
              agents: {
                create: body.agentIds.map((agentId) => ({
                  agentId,
                  role: 'worker',
                })),
              },
            }
          : {}),
      },
      include: {
        agents: { include: { agent: { select: { id: true, name: true, slug: true } } } },
      },
    })

    return created({
      ...mission,
      deadline: mission.deadline ? String(mission.deadline) : null,
      createdAt: String(mission.createdAt),
      updatedAt: String(mission.updatedAt),
    })
  })
}
