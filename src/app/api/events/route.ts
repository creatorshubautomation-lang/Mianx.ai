import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  getPaginationParams,
  buildPaginationMeta,
  getOrgIdParam,
  ValidationError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember } from '@/lib/authorization'

// GET /api/events — org events, filterable by missionId, type
export async function GET(request: Request) {
  return withErrorHandler(async () => {
    const userId = getUserIdFromRequest(request)
    const { searchParams } = new URL(request.url)
    const organizationId = getOrgIdParam(searchParams)
    if (!organizationId) throw new ValidationError('organizationId query parameter is required')

    await requireOrgMember(userId, organizationId)

    const { cursor, limit } = getPaginationParams(searchParams)
    const missionId = searchParams.get('missionId') ?? undefined
    const eventType = searchParams.get('eventType') ?? undefined
    const actorType = searchParams.get('actorType') ?? undefined

    const where: Record<string, unknown> = { organizationId }
    if (missionId) where.missionId = missionId
    if (eventType) where.eventType = eventType
    if (actorType) where.actorType = actorType

    const [total, items] = await Promise.all([
      db.event.count({ where }),
      db.event.findMany({
        where,
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { occurredAt: 'desc' },
      }),
    ])

    const nextCursor = items.length === limit ? items[items.length - 1].id : null

    const data = items.map((e) => ({
      ...e,
      occurredAt: String(e.occurredAt),
      createdAt: String(e.createdAt),
    }))

    return success(data, buildPaginationMeta(total, limit, items, nextCursor))
  })
}
