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

// GET /api/approvals — list pending approvals for org
export async function GET(request: Request) {
  return withErrorHandler(async () => {
    const userId = await getUserIdFromRequest(request)
    const { searchParams } = new URL(request.url)
    const organizationId = getOrgIdParam(searchParams)
    if (!organizationId) throw new ValidationError('organizationId query parameter is required')

    await requireOrgMember(userId, organizationId)
    await requirePermission(userId, organizationId, [Permissions.APPROVAL_VIEW])

    const { cursor, limit } = getPaginationParams(searchParams)

    const where = {
      organizationId,
      decision: null,
    }

    const [total, items] = await Promise.all([
      db.workflowApproval.count({ where }),
      db.workflowApproval.findMany({
        where,
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const nextCursor = items.length === limit ? items[items.length - 1].id : null

    const data = items.map((a) => ({
      ...a,
      expiresAt: a.expiresAt ? String(a.expiresAt) : null,
      createdAt: String(a.createdAt),
      decidedAt: a.decidedAt ? String(a.decidedAt) : null,
    }))

    return success(data, buildPaginationMeta(total, limit, items, nextCursor))
  })
}
