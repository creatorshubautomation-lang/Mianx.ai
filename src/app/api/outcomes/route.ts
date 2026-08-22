import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  getPaginationParams,
  buildPaginationMeta,
  getOrgIdParam,
  ValidationError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'

// GET /api/outcomes — list org outcomes
export async function GET(request: Request) {
  return withErrorHandler(async () => {
    const userId = await getUserIdFromRequest(request)
    const { searchParams } = new URL(request.url)
    const organizationId = getOrgIdParam(searchParams)
    if (!organizationId) throw new ValidationError('organizationId query parameter is required')

    await requireOrgMember(userId, organizationId)
    await requirePermission(userId, organizationId, [Permissions.MISSION_VIEW])

    const { cursor, limit } = getPaginationParams(searchParams)
    const status = searchParams.get('status') ?? undefined
    const missionId = searchParams.get('missionId') ?? undefined

    const where: Record<string, unknown> = { organizationId }
    if (status) where.status = status
    if (missionId) where.missionId = missionId

    const [total, items] = await Promise.all([
      db.outcome.count({ where }),
      db.outcome.findMany({
        where,
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: 'desc' },
        include: {
          mission: { select: { id: true, title: true } },
        },
      }),
    ])

    const nextCursor = items.length === limit ? items[items.length - 1].id : null

    const data = items.map((o) => ({
      ...o,
      verifiedAt: o.verifiedAt ? String(o.verifiedAt) : null,
      createdAt: String(o.createdAt),
      updatedAt: String(o.updatedAt),
    }))

    return success(data, buildPaginationMeta(total, limit, items, nextCursor))
  })
}
