// POST /api/missions/[id]/complete — Complete a mission with outcome assessment

import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  NotFoundError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'
import { parseJsonField } from '@/lib/types'
import { completeMission } from '@/lib/mission-engine'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id: missionId } = await context.params
    const userId = await getUserIdFromRequest(request)

    const mission = await db.mission.findUnique({ where: { id: missionId } })
    if (!mission) throw new NotFoundError('Mission')

    await requireOrgMember(userId, mission.organizationId)
    await requirePermission(userId, mission.organizationId, [Permissions.MISSION_EXECUTE])

    const outcomes = await completeMission(missionId)

    return success({
      outcomes: outcomes.map((outcome) => ({
        ...outcome,
        target: parseJsonField(outcome.target, {}),
        currentResult: parseJsonField(outcome.currentResult, {}),
        createdAt: String(outcome.createdAt),
        updatedAt: String(outcome.updatedAt),
      })),
    })
  })
}
