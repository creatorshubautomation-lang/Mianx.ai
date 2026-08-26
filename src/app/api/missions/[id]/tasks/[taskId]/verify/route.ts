// POST /api/missions/[id]/tasks/[taskId]/verify — Verify a task's output
// Uses the real verification engine with 10 verification type executors

import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  NotFoundError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'
import { parseJsonField } from '@/lib/types'
import { runVerification } from '@/lib/verification-engine'

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

    // Use the real verification engine (10 verification type executors)
    const verification = await runVerification({
      missionTaskId: taskId,
      missionId,
      organizationId: mission.organizationId,
    })

    return success({
      ...verification,
      config: parseJsonField(verification.config, {}),
      result: parseJsonField(verification.result ?? '{}', {}),
      evidence: parseJsonField(verification.evidence, []),
      verifiedAt: verification.verifiedAt ? String(verification.verifiedAt) : null,
      createdAt: String(verification.createdAt),
    })
  })
}
