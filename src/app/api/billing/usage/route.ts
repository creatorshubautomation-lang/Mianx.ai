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

// GET /api/billing/usage
export async function GET(request: Request) {
  return withErrorHandler(async () => {
    const userId = getUserIdFromRequest(request)
    const { searchParams } = new URL(request.url)
    const organizationId = getOrgIdParam(searchParams)
    if (!organizationId) throw new ValidationError('organizationId query parameter is required')

    await requireOrgMember(userId, organizationId)
    await requirePermission(userId, organizationId, [Permissions.BILLING_VIEW])

    const { cursor, limit } = getPaginationParams(searchParams)
    const meterKey = searchParams.get('meterKey') ?? undefined

    const where: Record<string, unknown> = { organizationId }
    if (meterKey) where.meterKey = meterKey

    const [total, items] = await Promise.all([
      db.usageRecord.count({ where }),
      db.usageRecord.findMany({
        where,
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { occurredAt: 'desc' },
      }),
    ])

    const nextCursor = items.length === limit ? items[items.length - 1].id : null

    const data = items.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      meterKey: r.meterKey,
      quantity: r.quantity,
      unit: r.unit,
      source: r.source,
      occurredAt: String(r.occurredAt),
      idempotencyKey: r.idempotencyKey,
      metadata: r.metadata,
      createdAt: String(r.createdAt),
    }))

    return success(data, buildPaginationMeta(total, limit, items, nextCursor))
  })
}
