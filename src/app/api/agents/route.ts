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
  NotFoundError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'
import { toJsonField } from '@/lib/types'
import type { CreateAgentDto } from '@/lib/types'

// GET /api/agents
export async function GET(request: Request) {
  return withErrorHandler(async () => {
    const userId = getUserIdFromRequest(request)
    const { searchParams } = new URL(request.url)
    const organizationId = getOrgIdParam(searchParams)
    if (!organizationId) throw new ValidationError('organizationId query parameter is required')

    await requireOrgMember(userId, organizationId)

    const { cursor, limit } = getPaginationParams(searchParams)
    const status = searchParams.get('status') ?? undefined
    const search = searchParams.get('search') ?? undefined

    const where: Record<string, unknown> = { organizationId }
    if (status) where.status = status
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search } },
      ]
    }

    const [total, items] = await Promise.all([
      db.agent.count({ where }),
      db.agent.findMany({
        where,
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const nextCursor = items.length === limit ? items[items.length - 1].id : null

    const data = items.map((a) => ({
      ...a,
      createdAt: String(a.createdAt),
      updatedAt: String(a.updatedAt),
    }))

    return success(data, buildPaginationMeta(total, limit, items, nextCursor))
  })
}

// POST /api/agents
export async function POST(request: Request) {
  return withErrorHandler(async () => {
    const userId = getUserIdFromRequest(request)
    const { searchParams } = new URL(request.url)
    const organizationId = getOrgIdParam(searchParams)
    if (!organizationId) throw new ValidationError('organizationId query parameter is required')

    await requireOrgMember(userId, organizationId)
    await requirePermission(userId, organizationId, [Permissions.AGENT_CREATE])

    const body = await requireBody<CreateAgentDto>(request)

    if (!body.name?.trim()) throw new ValidationError('Agent name is required')
    if (!body.slug?.trim()) throw new ValidationError('Agent slug is required')

    const existing = await db.agent.findFirst({ where: { organizationId, slug: body.slug } })
    if (existing) throw new ValidationError('An agent with this slug already exists', { slug: body.slug })

    const agent = await db.agent.create({
      data: {
        organizationId,
        domainId: body.domainId ?? null,
        name: body.name.trim(),
        slug: body.slug.trim(),
        description: body.description ?? null,
        status: body.status ?? 'draft',
        type: body.type ?? 'assistant',
        configuration: toJsonField(body.configuration ?? {}),
        capabilities: toJsonField(body.capabilities ?? []),
        successMetrics: toJsonField(body.successMetrics ?? {}),
      },
    })

    return created({
      ...agent,
      createdAt: String(agent.createdAt),
      updatedAt: String(agent.updatedAt),
    })
  })
}
