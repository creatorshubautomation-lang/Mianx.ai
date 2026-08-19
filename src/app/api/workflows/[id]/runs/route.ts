import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  created,
  getPaginationParams,
  buildPaginationMeta,
  requireBody,
  NotFoundError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'
import { toJsonField } from '@/lib/types'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/workflows/[id]/runs
export async function GET(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id: workflowId } = await context.params
    const userId = await getUserIdFromRequest(request)

    const workflow = await db.workflow.findUnique({ where: { id: workflowId } })
    if (!workflow) throw new NotFoundError('Workflow')

    await requireOrgMember(userId, workflow.organizationId)
    await requirePermission(userId, workflow.organizationId, [Permissions.WORKFLOW_VIEW])

    const { searchParams } = new URL(request.url)
    const { cursor, limit } = getPaginationParams(searchParams)

    const where = { workflowId }

    const [total, items] = await Promise.all([
      db.workflowRun.count({ where }),
      db.workflowRun.findMany({
        where,
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const nextCursor = items.length === limit ? items[items.length - 1].id : null

    const data = items.map((r) => ({
      ...r,
      startedAt: r.startedAt ? String(r.startedAt) : null,
      completedAt: r.completedAt ? String(r.completedAt) : null,
      createdAt: String(r.createdAt),
      updatedAt: String(r.updatedAt),
    }))

    return success(data, buildPaginationMeta(total, limit, items, nextCursor))
  })
}

// POST /api/workflows/[id]/runs — start a workflow run
export async function POST(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id: workflowId } = await context.params
    const userId = await getUserIdFromRequest(request)

    const workflow = await db.workflow.findUnique({ where: { id: workflowId } })
    if (!workflow) throw new NotFoundError('Workflow')

    await requireOrgMember(userId, workflow.organizationId)
    await requirePermission(userId, workflow.organizationId, [Permissions.WORKFLOW_RUN])

    const body = await requireBody<{ input?: Record<string, unknown> }>(request)
    const input = body?.input ?? {}

    const run = await db.workflowRun.create({
      data: {
        workflowId,
        organizationId: workflow.organizationId,
        status: 'queued',
        input: toJsonField(input),
      },
    })

    return created({
      ...run,
      startedAt: run.startedAt ? String(run.startedAt) : null,
      completedAt: run.completedAt ? String(run.completedAt) : null,
      createdAt: String(run.createdAt),
      updatedAt: String(run.updatedAt),
    })
  })
}
