import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  created,
  getPaginationParams,
  buildPaginationMeta,
  requireBody,
  NotFoundError,
  ValidationError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'
import { toJsonField } from '@/lib/types'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/organizations/[id]/domains — org activated domains
export async function GET(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id: organizationId } = await context.params
    const userId = await getUserIdFromRequest(request)
    await requireOrgMember(userId, organizationId)
    await requirePermission(userId, organizationId, [Permissions.DOMAIN_VIEW])

    const { searchParams } = new URL(request.url)
    const { cursor, limit } = getPaginationParams(searchParams)

    const where = { organizationId }

    const [total, items] = await Promise.all([
      db.organizationDomain.count({ where }),
      db.organizationDomain.findMany({
        where,
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: 'desc' },
        include: {
          domain: true,
        },
      }),
    ])

    const nextCursor = items.length === limit ? items[items.length - 1].id : null

    const data = items.map((od) => ({
      ...od,
      domain: {
        ...od.domain,
        createdAt: String(od.domain.createdAt),
        updatedAt: String(od.domain.updatedAt),
      },
      activatedAt: od.activatedAt ? String(od.activatedAt) : null,
      createdAt: String(od.createdAt),
      updatedAt: String(od.updatedAt),
    }))

    return success(data, buildPaginationMeta(total, limit, items, nextCursor))
  })
}

// POST /api/organizations/[id]/domains — activate domain
export async function POST(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id: organizationId } = await context.params
    const userId = await getUserIdFromRequest(request)
    await requireOrgMember(userId, organizationId)
    await requirePermission(userId, organizationId, [Permissions.DOMAIN_MANAGE])

    const body = await requireBody<{
      domainId: string
      configuration?: Record<string, unknown>
    }>(request)

    if (!body.domainId) throw new ValidationError('domainId is required')

    const domain = await db.domain.findUnique({ where: { id: body.domainId } })
    if (!domain) throw new NotFoundError('Domain')

    // Check if already activated
    const existing = await db.organizationDomain.findUnique({
      where: { organizationId_domainId: { organizationId, domainId: body.domainId } },
    })
    if (existing) {
      throw new ValidationError('Domain is already activated for this organization')
    }

    const orgDomain = await db.organizationDomain.create({
      data: {
        organizationId,
        domainId: body.domainId,
        status: 'active',
        configuration: toJsonField(body.configuration ?? {}),
        activatedAt: new Date(),
      },
      include: {
        domain: true,
      },
    })

    return created({
      ...orgDomain,
      domain: {
        ...orgDomain.domain,
        createdAt: String(orgDomain.domain.createdAt),
        updatedAt: String(orgDomain.domain.updatedAt),
      },
      activatedAt: orgDomain.activatedAt ? String(orgDomain.activatedAt) : null,
      createdAt: String(orgDomain.createdAt),
      updatedAt: String(orgDomain.updatedAt),
    })
  })
}
