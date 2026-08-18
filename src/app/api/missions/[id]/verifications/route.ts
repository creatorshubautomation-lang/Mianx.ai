import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  getPaginationParams,
  buildPaginationMeta,
  NotFoundError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/missions/[id]/verifications
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

    const where: Record<string, unknown> = { missionId }

    const [total, items] = await Promise.all([
      db.verification.count({ where }),
      db.verification.findMany({
        where,
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: 'desc' },
        include: {
          task: { select: { id: true, title: true } },
        },
      }),
    ])

    const nextCursor = items.length === limit ? items[items.length - 1].id : null

    const data = items.map((v) => ({
      ...v,
      verifiedAt: v.verifiedAt ? String(v.verifiedAt) : null,
      createdAt: String(v.createdAt),
    }))

    return success(data, buildPaginationMeta(total, limit, items, nextCursor))
  })
}
