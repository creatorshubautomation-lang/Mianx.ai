import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  created,
  getPaginationParams,
  buildPaginationMeta,
  requireBody,
  ValidationError,
  ForbiddenError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requirePermission, Permissions } from '@/lib/authorization'
import { toJsonField, slugify } from '@/lib/types'

// GET /api/domains — available domains (platform-level)
export async function GET(request: Request) {
  return withErrorHandler(async () => {
    const userId = await getUserIdFromRequest(request)
    const { searchParams } = new URL(request.url)
    const { cursor, limit } = getPaginationParams(searchParams)
    const status = searchParams.get('status') ?? undefined

    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const [total, items] = await Promise.all([
      db.domain.count({ where }),
      db.domain.findMany({
        where,
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const nextCursor = items.length === limit ? items[items.length - 1].id : null

    const data = items.map((d) => ({
      ...d,
      createdAt: String(d.createdAt),
      updatedAt: String(d.updatedAt),
    }))

    return success(data, buildPaginationMeta(total, limit, items, nextCursor))
  })
}

// POST /api/domains — admin: create domain (platform-level, requires any org membership as guard)
export async function POST(request: Request) {
  return withErrorHandler(async () => {
    const userId = await getUserIdFromRequest(request)
    // SECURITY: Require at least one active org membership to create domains
    // In production this should be restricted to platform admins only
    const memberCount = await db.organizationMembership.count({
      where: { userId, status: 'active' },
    })
    if (memberCount === 0) {
      throw new ForbiddenError('Only authenticated members can create domains')
    }

    const body = await requireBody<{
      name: string
      slug?: string
      version?: string
      description?: string
      status?: string
      manifest?: Record<string, unknown>
    }>(request)

    if (!body.name?.trim()) throw new ValidationError('Domain name is required')
    const slug = body.slug?.trim() || slugify(body.name)

    const existing = await db.domain.findUnique({ where: { slug } })
    if (existing) throw new ValidationError('A domain with this slug already exists', { slug })

    const domain = await db.domain.create({
      data: {
        name: body.name.trim(),
        slug,
        version: body.version ?? '1.0.0',
        description: body.description ?? null,
        status: (body.status as 'draft' | 'development' | 'published' | 'active') ?? 'draft',
        manifest: toJsonField(body.manifest ?? {}),
      },
    })

    return created({
      ...domain,
      createdAt: String(domain.createdAt),
      updatedAt: String(domain.updatedAt),
    })
  })
}
