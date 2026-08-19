import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  noContent,
  requireBody,
  NotFoundError,
  ValidationError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'
import { toJsonField } from '@/lib/types'
import type { UpdateMissionDto } from '@/lib/types'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/missions/[id]
export async function GET(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id } = await context.params
    const userId = await getUserIdFromRequest(request)

    const mission = await db.mission.findUnique({
      where: { id },
      include: {
        agents: { include: { agent: { select: { id: true, name: true, slug: true } } } },
        _count: { select: { tasks: true, outcomes: true, verifications: true } },
      },
    })
    if (!mission) throw new NotFoundError('Mission')

    await requireOrgMember(userId, mission.organizationId)
    await requirePermission(userId, mission.organizationId, [Permissions.MISSION_VIEW])

    return success({
      ...mission,
      deadline: mission.deadline ? String(mission.deadline) : null,
      createdAt: String(mission.createdAt),
      updatedAt: String(mission.updatedAt),
    })
  })
}

// PUT /api/missions/[id]
export async function PUT(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id } = await context.params
    const userId = await getUserIdFromRequest(request)

    const existing = await db.mission.findUnique({ where: { id } })
    if (!existing) throw new NotFoundError('Mission')

    await requireOrgMember(userId, existing.organizationId)
    await requirePermission(userId, existing.organizationId, [Permissions.MISSION_UPDATE])

    const body = await requireBody<UpdateMissionDto>(request)

    const mission = await db.mission.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.goal !== undefined ? { goal: body.goal } : {}),
        ...(body.objective !== undefined ? { objective: body.objective } : {}),
        ...(body.constraints !== undefined ? { constraints: toJsonField(body.constraints) } : {}),
        ...(body.budget !== undefined ? { budget: body.budget } : {}),
        ...(body.estimatedCost !== undefined ? { estimatedCost: body.estimatedCost } : {}),
        ...(body.actualCost !== undefined ? { actualCost: body.actualCost } : {}),
        ...(body.deadline !== undefined
          ? { deadline: body.deadline ? new Date(body.deadline) : null }
          : {}),
        ...(body.successCriteria !== undefined ? { successCriteria: toJsonField(body.successCriteria) } : {}),
        ...(body.plan !== undefined ? { plan: toJsonField(body.plan) } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.userMode !== undefined ? { userMode: body.userMode } : {}),
      },
      include: {
        agents: { include: { agent: { select: { id: true, name: true, slug: true } } } },
        _count: { select: { tasks: true, outcomes: true } },
      },
    })

    return success({
      ...mission,
      deadline: mission.deadline ? String(mission.deadline) : null,
      createdAt: String(mission.createdAt),
      updatedAt: String(mission.updatedAt),
    })
  })
}

// DELETE /api/missions/[id]
export async function DELETE(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id } = await context.params
    const userId = await getUserIdFromRequest(request)

    const mission = await db.mission.findUnique({ where: { id } })
    if (!mission) throw new NotFoundError('Mission')

    await requireOrgMember(userId, mission.organizationId)
    await requirePermission(userId, mission.organizationId, [Permissions.MISSION_DELETE])

    await db.mission.delete({ where: { id } })

    return noContent()
  })
}
