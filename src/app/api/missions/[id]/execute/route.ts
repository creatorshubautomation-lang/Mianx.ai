import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  NotFoundError,
  ValidationError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'

type RouteContext = { params: Promise<{ id: string }> }

// POST /api/missions/[id]/execute — transition mission to executing
export async function POST(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id } = await context.params
    const userId = getUserIdFromRequest(request)

    const mission = await db.mission.findUnique({
      where: { id },
      include: {
        agents: { include: { agent: true } },
        _count: { select: { tasks: true } },
      },
    })
    if (!mission) throw new NotFoundError('Mission')

    await requireOrgMember(userId, mission.organizationId)
    await requirePermission(userId, mission.organizationId, [Permissions.MISSION_EXECUTE])

    // Validate transition
    const validTransitions: Record<string, string> = {
      draft: 'executing',
      planning: 'executing',
      approved: 'executing',
    }
    const allowedStatuses = Object.keys(validTransitions)
    if (!allowedStatuses.includes(mission.status)) {
      throw new ValidationError(
        `Mission cannot transition from '${mission.status}' to 'executing'. Valid source statuses: ${allowedStatuses.join(', ')}`,
      )
    }

    // If mission is in planning and has no tasks, create initial tasks from the plan
    let tasksCreated = 0
    if (mission.status === 'planning' && mission._count.tasks === 0) {
      let plan: Record<string, unknown> = {}
      try {
        plan = JSON.parse(mission.plan) as Record<string, unknown>
      } catch {
        // ignore parse errors, use empty plan
      }

      const steps = (plan.steps as Array<{ title: string; description?: string; agentId?: string }>) ?? []
      if (steps.length > 0) {
        const createData = steps.map((step, index) => ({
          missionId: id,
          title: step.title || `Step ${index + 1}`,
          description: step.description ?? null,
          agentId: step.agentId ?? null,
          status: 'queued' as const,
          dependencies: JSON.stringify(index > 0 ? [index - 1] : []),
        }))

        await db.missionTask.createMany({ data: createData })
        tasksCreated = createData.length
      }
    }

    const updated = await db.mission.update({
      where: { id },
      data: { status: 'executing' },
      include: {
        agents: { include: { agent: { select: { id: true, name: true, slug: true } } } },
        _count: { select: { tasks: true, outcomes: true } },
      },
    })

    return success({
      ...updated,
      deadline: updated.deadline ? String(updated.deadline) : null,
      createdAt: String(updated.createdAt),
      updatedAt: String(updated.updatedAt),
      _tasksCreated: tasksCreated,
    })
  })
}
