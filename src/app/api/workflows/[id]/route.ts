import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  noContent,
  requireBody,
  NotFoundError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'
import { toJsonField } from '@/lib/types'
import type { UpdateWorkflowDto } from '@/lib/types'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/workflows/[id]
export async function GET(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id } = await context.params
    const userId = getUserIdFromRequest(request)

    const workflow = await db.workflow.findUnique({ where: { id } })
    if (!workflow) throw new NotFoundError('Workflow')

    await requireOrgMember(userId, workflow.organizationId)
    await requirePermission(userId, workflow.organizationId, [Permissions.WORKFLOW_VIEW])

    return success({
      ...workflow,
      createdAt: String(workflow.createdAt),
      updatedAt: String(workflow.updatedAt),
    })
  })
}

// PUT /api/workflows/[id]
export async function PUT(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id } = await context.params
    const userId = getUserIdFromRequest(request)

    const existing = await db.workflow.findUnique({ where: { id } })
    if (!existing) throw new NotFoundError('Workflow')

    await requireOrgMember(userId, existing.organizationId)
    await requirePermission(userId, existing.organizationId, [Permissions.WORKFLOW_UPDATE])

    const body = await requireBody<UpdateWorkflowDto>(request)

    const workflow = await db.workflow.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.slug !== undefined ? { slug: body.slug } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.definition !== undefined ? { definition: toJsonField(body.definition) } : {}),
        ...(body.triggerType !== undefined ? { triggerType: body.triggerType } : {}),
        ...(body.domainId !== undefined ? { domainId: body.domainId } : {}),
      },
    })

    return success({
      ...workflow,
      createdAt: String(workflow.createdAt),
      updatedAt: String(workflow.updatedAt),
    })
  })
}

// DELETE /api/workflows/[id]
export async function DELETE(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id } = await context.params
    const userId = getUserIdFromRequest(request)

    const workflow = await db.workflow.findUnique({ where: { id } })
    if (!workflow) throw new NotFoundError('Workflow')

    await requireOrgMember(userId, workflow.organizationId)
    await requirePermission(userId, workflow.organizationId, [Permissions.WORKFLOW_DELETE])

    await db.workflow.delete({ where: { id } })

    return noContent()
  })
}
