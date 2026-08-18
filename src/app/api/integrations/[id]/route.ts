import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  noContent,
  requireBody,
  NotFoundError,
  ValidationError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'
import { toJsonField } from '@/lib/types'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/integrations/[id]
export async function GET(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id } = await context.params
    const userId = getUserIdFromRequest(request)

    const integration = await db.integration.findUnique({ where: { id } })
    if (!integration) throw new NotFoundError('Integration')

    await requireOrgMember(userId, integration.organizationId)
    await requirePermission(userId, integration.organizationId, [Permissions.INTEGRATION_VIEW])

    return success({
      ...integration,
      createdAt: String(integration.createdAt),
      updatedAt: String(integration.updatedAt),
    })
  })
}

// PUT /api/integrations/[id]
export async function PUT(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id } = await context.params
    const userId = getUserIdFromRequest(request)

    const existing = await db.integration.findUnique({ where: { id } })
    if (!existing) throw new NotFoundError('Integration')

    await requireOrgMember(userId, existing.organizationId)
    await requirePermission(userId, existing.organizationId, [Permissions.INTEGRATION_MANAGE])

    const body = await requireBody<{
      name?: string
      status?: string
      configuration?: Record<string, unknown>
    }>(request)

    const integration = await db.integration.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.configuration !== undefined ? { configuration: toJsonField(body.configuration) } : {}),
      },
    })

    return success({
      ...integration,
      createdAt: String(integration.createdAt),
      updatedAt: String(integration.updatedAt),
    })
  })
}

// DELETE /api/integrations/[id]
export async function DELETE(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id } = await context.params
    const userId = getUserIdFromRequest(request)

    const integration = await db.integration.findUnique({ where: { id } })
    if (!integration) throw new NotFoundError('Integration')

    await requireOrgMember(userId, integration.organizationId)
    await requirePermission(userId, integration.organizationId, [Permissions.INTEGRATION_MANAGE])

    await db.integration.delete({ where: { id } })

    return noContent()
  })
}
