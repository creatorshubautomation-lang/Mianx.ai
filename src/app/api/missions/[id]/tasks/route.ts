import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  created,
  getPaginationParams,
  buildPaginationMeta,
  requireBody,
  NotFoundError,
  ValidationError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'
import { toJsonField } from '@/lib/types'
import type { CreateMissionTaskDto } from '@/lib/types'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/missions/[id]/tasks
export async function GET(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id: missionId } = await context.params
    const userId = getUserIdFromRequest(request)

    const mission = await db.mission.findUnique({ where: { id: missionId } })
    if (!mission) throw new NotFoundError('Mission')

    await requireOrgMember(userId, mission.organizationId)
    await requirePermission(userId, mission.organizationId, [Permissions.MISSION_VIEW])

    const { searchParams } = new URL(request.url)
    const { cursor, limit } = getPaginationParams(searchParams)
    const status = searchParams.get('status') ?? undefined

    const where: Record<string, unknown> = { missionId }
    if (status) where.status = status

    const [total, items] = await Promise.all([
      db.missionTask.count({ where }),
      db.missionTask.findMany({
        where,
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: 'asc' },
        include: {
          agent: { select: { id: true, name: true, slug: true } },
          _count: { select: { children: true, verifications: true } },
        },
      }),
    ])

    const nextCursor = items.length === limit ? items[items.length - 1].id : null

    const data = items.map((t) => ({
      ...t,
      startedAt: t.startedAt ? String(t.startedAt) : null,
      completedAt: t.completedAt ? String(t.completedAt) : null,
      createdAt: String(t.createdAt),
      updatedAt: String(t.updatedAt),
    }))

    return success(data, buildPaginationMeta(total, limit, items, nextCursor))
  })
}

// POST /api/missions/[id]/tasks
export async function POST(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id: missionId } = await context.params
    const userId = getUserIdFromRequest(request)

    const mission = await db.mission.findUnique({ where: { id: missionId } })
    if (!mission) throw new NotFoundError('Mission')

    await requireOrgMember(userId, mission.organizationId)
    await requirePermission(userId, mission.organizationId, [Permissions.MISSION_UPDATE])

    const body = await requireBody<CreateMissionTaskDto>(request)

    if (!body.title?.trim()) throw new ValidationError('Task title is required')

    const task = await db.missionTask.create({
      data: {
        missionId,
        parentTaskId: body.parentTaskId ?? null,
        title: body.title.trim(),
        description: body.description ?? null,
        agentId: body.agentId ?? null,
        assignedTools: toJsonField(body.assignedTools ?? []),
        dependencies: toJsonField(body.dependencies ?? []),
        verificationConfig: toJsonField(body.verificationConfig ?? {}),
        input: toJsonField(body.input ?? {}),
      },
      include: {
        agent: { select: { id: true, name: true, slug: true } },
      },
    })

    return created({
      ...task,
      startedAt: task.startedAt ? String(task.startedAt) : null,
      completedAt: task.completedAt ? String(task.completedAt) : null,
      createdAt: String(task.createdAt),
      updatedAt: String(task.updatedAt),
    })
  })
}
