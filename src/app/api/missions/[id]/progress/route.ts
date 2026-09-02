// GET /api/missions/[id]/progress — Get mission execution progress

import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  NotFoundError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'
import { getMissionProgress } from '@/lib/mission-engine'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id: missionId } = await context.params
    const userId = await getUserIdFromRequest(request)

    const mission = await db.mission.findUnique({ where: { id: missionId } })
    if (!mission) throw new NotFoundError('Mission')

    await requireOrgMember(userId, mission.organizationId)
    await requirePermission(userId, mission.organizationId, [Permissions.MISSION_VIEW])

    const progress = await getMissionProgress(missionId)

    return success(progress)
  })
}
