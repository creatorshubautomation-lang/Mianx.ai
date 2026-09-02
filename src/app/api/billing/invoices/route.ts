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

// GET /api/billing/invoices
export async function GET(request: Request) {
  return withErrorHandler(async () => {
    const userId = await getUserIdFromRequest(request)
    const { searchParams } = new URL(request.url)
    const organizationId = getOrgIdParam(searchParams)
    if (!organizationId) throw new ValidationError('organizationId query parameter is required')

    await requireOrgMember(userId, organizationId)
    await requirePermission(userId, organizationId, [Permissions.BILLING_VIEW])

    const { cursor, limit } = getPaginationParams(searchParams)

    const where = { organizationId }

    const [total, items] = await Promise.all([
      db.invoice.count({ where }),
      db.invoice.findMany({
        where,
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { issuedAt: 'desc' },
      }),
    ])

    const nextCursor = items.length === limit ? items[items.length - 1].id : null

    const data = items.map((inv) => ({
      id: inv.id,
      organizationId: inv.organizationId,
      subscriptionId: inv.subscriptionId,
      periodStart: String(inv.periodStart),
      periodEnd: inv.periodEnd ? String(inv.periodEnd) : null,
      lineItems: inv.lineItems,
      subtotal: inv.subtotal,
      discount: inv.discount,
      tax: inv.tax,
      total: inv.total,
      currency: inv.currency,
      status: inv.status,
      issuedAt: String(inv.issuedAt),
      dueAt: inv.dueAt ? String(inv.dueAt) : null,
      paidAt: inv.paidAt ? String(inv.paidAt) : null,
    }))

    return success(data, buildPaginationMeta(total, limit, items, nextCursor))
  })
}
