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
import { toJsonField, slugify } from '@/lib/types'
import type { CreateWorkflowDto } from '@/lib/types'

// GET /api/workflows
export async function GET(request: Request) {
  return withErrorHandler(async () => {
    const userId = getUserIdFromRequest(request)
    const { searchParams } = new URL(request.url)
    const organizationId = getOrgIdParam(searchParams)
    if (!organizationId) throw new ValidationError('organizationId query parameter is required')

    await requireOrgMember(userId, organizationId)
    await requirePermission(userId, organizationId, [Permissions.WORKFLOW_VIEW])

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
      db.workflow.count({ where }),
      db.workflow.findMany({
        where,
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const nextCursor = items.length === limit ? items[items.length - 1].id : null

    const data = items.map((w) => ({
      ...w,
      createdAt: String(w.createdAt),
      updatedAt: String(w.updatedAt),
    }))

    return success(data, buildPaginationMeta(total, limit, items, nextCursor))
  })
}

// POST /api/workflows
export async function POST(request: Request) {
  return withErrorHandler(async () => {
    const userId = getUserIdFromRequest(request)
    const { searchParams } = new URL(request.url)
    const organizationId = getOrgIdParam(searchParams)
    if (!organizationId) throw new ValidationError('organizationId query parameter is required')

    await requireOrgMember(userId, organizationId)
    await requirePermission(userId, organizationId, [Permissions.WORKFLOW_CREATE])

    const body = await requireBody<CreateWorkflowDto>(request)

    if (!body.name?.trim()) throw new ValidationError('Workflow name is required')
    const slug = body.slug?.trim() || slugify(body.name)

    const existing = await db.workflow.findFirst({ where: { organizationId, slug } })
    if (existing) throw new ValidationError('A workflow with this slug already exists', { slug })

    const workflow = await db.workflow.create({
      data: {
        organizationId,
        domainId: body.domainId ?? null,
        name: body.name.trim(),
        slug,
        status: body.status ?? 'draft',
        definition: toJsonField(body.definition ?? {}),
        triggerType: body.triggerType ?? 'manual',
      },
    })

    return created({
      ...workflow,
      createdAt: String(workflow.createdAt),
      updatedAt: String(workflow.updatedAt),
    })
  })
}
