// POST /api/missions/[id]/plan — Plan a mission (generate task graph)

import { db } from '@/lib/db'
import {
  withErrorHandler,
  created,
  NotFoundError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'
import { parseJsonField } from '@/lib/types'
import { planMission } from '@/lib/mission-engine'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id: missionId } = await context.params
    const userId = getUserIdFromRequest(request)

    const mission = await db.mission.findUnique({ where: { id: missionId } })
    if (!mission) throw new NotFoundError('Mission')

    await requireOrgMember(userId, mission.organizationId)
    await requirePermission(userId, mission.organizationId, [Permissions.MISSION_EXECUTE])

    const tasks = await planMission(missionId)

    return created({
      tasks: tasks.map((task) => ({
        ...task,
        dependencies: parseJsonField(task.dependencies, []),
        verificationConfig: parseJsonField(task.verificationConfig, {}),
        assignedTools: parseJsonField(task.assignedTools, []),
        startedAt: task.startedAt ? String(task.startedAt) : null,
        completedAt: task.completedAt ? String(task.completedAt) : null,
        createdAt: String(task.createdAt),
        updatedAt: String(task.updatedAt),
      })),
    })
  })
}
