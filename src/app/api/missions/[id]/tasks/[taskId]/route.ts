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
import type { UpdateMissionTaskDto } from '@/lib/types'

type RouteContext = { params: Promise<{ id: string; taskId: string }> }

// GET /api/missions/[id]/tasks/[taskId]
export async function GET(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id: missionId, taskId } = await context.params
    const userId = await getUserIdFromRequest(request)

    const mission = await db.mission.findUnique({ where: { id: missionId } })
    if (!mission) throw new NotFoundError('Mission')

    await requireOrgMember(userId, mission.organizationId)
    await requirePermission(userId, mission.organizationId, [Permissions.MISSION_VIEW])

    const task = await db.missionTask.findFirst({
      where: { id: taskId, missionId },
      include: {
        agent: { select: { id: true, name: true, slug: true } },
        children: { orderBy: { createdAt: 'asc' } },
        verifications: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!task) throw new NotFoundError('Task')

    return success({
      ...task,
      startedAt: task.startedAt ? String(task.startedAt) : null,
      completedAt: task.completedAt ? String(task.completedAt) : null,
      createdAt: String(task.createdAt),
      updatedAt: String(task.updatedAt),
    })
  })
}

// PUT /api/missions/[id]/tasks/[taskId]
export async function PUT(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id: missionId, taskId } = await context.params
    const userId = await getUserIdFromRequest(request)

    const mission = await db.mission.findUnique({ where: { id: missionId } })
    if (!mission) throw new NotFoundError('Mission')

    await requireOrgMember(userId, mission.organizationId)
    await requirePermission(userId, mission.organizationId, [Permissions.MISSION_UPDATE])

    const existing = await db.missionTask.findFirst({
      where: { id: taskId, missionId },
    })
    if (!existing) throw new NotFoundError('Task')

    const body = await requireBody<UpdateMissionTaskDto>(request)

    // Validate agentId belongs to this organization (cross-tenant prevention)
    if (body.agentId !== undefined) {
      const agentExists = await db.agent.findFirst({
        where: { id: body.agentId, organizationId: mission.organizationId },
        select: { id: true },
      })
      if (!agentExists) {
        throw new ValidationError('Agent does not belong to this organization')
      }
    }

    const task = await db.missionTask.update({
      where: { id: taskId },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.agentId !== undefined ? { agentId: body.agentId } : {}),
        ...(body.assignedTools !== undefined ? { assignedTools: toJsonField(body.assignedTools) } : {}),
        ...(body.dependencies !== undefined ? { dependencies: toJsonField(body.dependencies) } : {}),
        ...(body.verificationConfig !== undefined
          ? { verificationConfig: toJsonField(body.verificationConfig) }
          : {}),
        ...(body.input !== undefined ? { input: toJsonField(body.input) } : {}),
        ...(body.output !== undefined ? { output: toJsonField(body.output) } : {}),
        ...(body.error !== undefined ? { error: body.error } : {}),
        ...(body.maxRetries !== undefined ? { maxRetries: body.maxRetries } : {}),
      },
      include: {
        agent: { select: { id: true, name: true, slug: true } },
      },
    })

    return success({
      ...task,
      startedAt: task.startedAt ? String(task.startedAt) : null,
      completedAt: task.completedAt ? String(task.completedAt) : null,
      createdAt: String(task.createdAt),
      updatedAt: String(task.updatedAt),
    })
  })
}

// DELETE /api/missions/[id]/tasks/[taskId]
export async function DELETE(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id: missionId, taskId } = await context.params
    const userId = await getUserIdFromRequest(request)

    const mission = await db.mission.findUnique({ where: { id: missionId } })
    if (!mission) throw new NotFoundError('Mission')

    await requireOrgMember(userId, mission.organizationId)
    await requirePermission(userId, mission.organizationId, [Permissions.MISSION_UPDATE])

    const task = await db.missionTask.findFirst({
      where: { id: taskId, missionId },
    })
    if (!task) throw new NotFoundError('Task')

    await db.missionTask.delete({ where: { id: taskId } })

    return noContent()
  })
}
