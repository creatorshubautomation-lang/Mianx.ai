// POST /api/missions/[id]/tasks/[taskId]/execute — Execute a single task

import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  NotFoundError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'
import { parseJsonField } from '@/lib/types'
import { executeTask } from '@/lib/mission-engine'

type RouteContext = { params: Promise<{ id: string; taskId: string }> }

export async function POST(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id: missionId, taskId } = await context.params
    const userId = await getUserIdFromRequest(request)

    const mission = await db.mission.findUnique({ where: { id: missionId } })
    if (!mission) throw new NotFoundError('Mission')

    await requireOrgMember(userId, mission.organizationId)
    await requirePermission(userId, mission.organizationId, [Permissions.MISSION_EXECUTE])

    // Verify the task belongs to this mission
    const existingTask = await db.missionTask.findFirst({
      where: { id: taskId, missionId },
    })
    if (!existingTask) throw new NotFoundError('Task')

    const task = await executeTask(taskId)

    return success({
      ...task,
      dependencies: parseJsonField(task.dependencies, []),
      verificationConfig: parseJsonField(task.verificationConfig, {}),
      assignedTools: parseJsonField(task.assignedTools, []),
      output: parseJsonField(task.output, {}),
      startedAt: task.startedAt ? String(task.startedAt) : null,
      completedAt: task.completedAt ? String(task.completedAt) : null,
      createdAt: String(task.createdAt),
      updatedAt: String(task.updatedAt),
    })
  })
}
