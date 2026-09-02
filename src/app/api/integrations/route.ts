import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  created,
  getPaginationParams,
  buildPaginationMeta,
  getOrgIdParam,
  requireBody,
  ValidationError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'
import { toJsonField } from '@/lib/types'

// GET /api/integrations
export async function GET(request: Request) {
  return withErrorHandler(async () => {
    const userId = await getUserIdFromRequest(request)
    const { searchParams } = new URL(request.url)
    const organizationId = getOrgIdParam(searchParams)
    if (!organizationId) throw new ValidationError('organizationId query parameter is required')

    await requireOrgMember(userId, organizationId)
    await requirePermission(userId, organizationId, [Permissions.INTEGRATION_VIEW])

    const { cursor, limit } = getPaginationParams(searchParams)
    const status = searchParams.get('status') ?? undefined
    const provider = searchParams.get('provider') ?? undefined

    const where: Record<string, unknown> = { organizationId }
    if (status) where.status = status
    if (provider) where.provider = provider

    const [total, items] = await Promise.all([
      db.integration.count({ where }),
      db.integration.findMany({
        where,
        select: {
          id: true, organizationId: true, provider: true,
          name: true, status: true,
          createdAt: true, updatedAt: true,
          // Explicitly exclude 'configuration' — may contain API keys/secrets
        },
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const nextCursor = items.length === limit ? items[items.length - 1].id : null

    const data = items.map((i) => ({
      ...i,
      createdAt: String(i.createdAt),
      updatedAt: String(i.updatedAt),
    }))

    return success(data, buildPaginationMeta(total, limit, items, nextCursor))
  })
}

// POST /api/integrations
export async function POST(request: Request) {
  return withErrorHandler(async () => {
    const userId = await getUserIdFromRequest(request)
    const { searchParams } = new URL(request.url)
    const organizationId = getOrgIdParam(searchParams)
    if (!organizationId) throw new ValidationError('organizationId query parameter is required')

    await requireOrgMember(userId, organizationId)
    await requirePermission(userId, organizationId, [Permissions.INTEGRATION_MANAGE])

    const body = await requireBody<{
      provider: string
      name: string
      configuration?: Record<string, unknown>
      status?: string
    }>(request)

    if (!body.provider?.trim()) throw new ValidationError('Provider is required')
    if (!body.name?.trim()) throw new ValidationError('Integration name is required')

    const integration = await db.integration.create({
      data: {
        organizationId,
        provider: body.provider.trim(),
        name: body.name.trim(),
        status: body.status ?? 'disconnected',
        configuration: toJsonField(body.configuration ?? {}),
      },
    })

    // Exclude 'configuration' from response — may contain API keys/secrets
    return created({
      id: integration.id,
      organizationId: integration.organizationId,
      provider: integration.provider,
      name: integration.name,
      status: integration.status,
      createdAt: String(integration.createdAt),
      updatedAt: String(integration.updatedAt),
    })
  })
}
