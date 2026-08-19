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
import type { UpdateAgentDto } from '@/lib/types'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/agents/[id]
export async function GET(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id } = await context.params
    const userId = await getUserIdFromRequest(request)

    const agent = await db.agent.findUnique({ where: { id } })
    if (!agent) throw new NotFoundError('Agent')

    await requireOrgMember(userId, agent.organizationId)
    await requirePermission(userId, agent.organizationId, [Permissions.AGENT_VIEW])

    // Exclude 'configuration' — may contain secrets/prompts
    return success({
      id: agent.id,
      organizationId: agent.organizationId,
      domainId: agent.domainId,
      name: agent.name,
      slug: agent.slug,
      description: agent.description,
      status: agent.status,
      type: agent.type,
      capabilities: agent.capabilities,
      version: agent.version,
      successMetrics: agent.successMetrics,
      createdAt: String(agent.createdAt),
      updatedAt: String(agent.updatedAt),
    })
  })
}

// PUT /api/agents/[id]
export async function PUT(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id } = await context.params
    const userId = await getUserIdFromRequest(request)

    const existing = await db.agent.findUnique({ where: { id } })
    if (!existing) throw new NotFoundError('Agent')

    await requireOrgMember(userId, existing.organizationId)
    await requirePermission(userId, existing.organizationId, [Permissions.AGENT_UPDATE])

    const body = await requireBody<UpdateAgentDto>(request)

    const agent = await db.agent.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.slug !== undefined ? { slug: body.slug } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.domainId !== undefined ? { domainId: body.domainId } : {}),
        ...(body.configuration !== undefined ? { configuration: toJsonField(body.configuration) } : {}),
        ...(body.capabilities !== undefined ? { capabilities: toJsonField(body.capabilities) } : {}),
        ...(body.successMetrics !== undefined ? { successMetrics: toJsonField(body.successMetrics) } : {}),
        ...(body.version !== undefined ? { version: body.version } : {}),
      },
    })

    // Exclude 'configuration' from response
    return success({
      id: agent.id,
      organizationId: agent.organizationId,
      domainId: agent.domainId,
      name: agent.name,
      slug: agent.slug,
      description: agent.description,
      status: agent.status,
      type: agent.type,
      capabilities: agent.capabilities,
      version: agent.version,
      successMetrics: agent.successMetrics,
      createdAt: String(agent.createdAt),
      updatedAt: String(agent.updatedAt),
    })
  })
}

// DELETE /api/agents/[id]
export async function DELETE(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id } = await context.params
    const userId = await getUserIdFromRequest(request)

    const agent = await db.agent.findUnique({ where: { id } })
    if (!agent) throw new NotFoundError('Agent')

    await requireOrgMember(userId, agent.organizationId)
    await requirePermission(userId, agent.organizationId, [Permissions.AGENT_DELETE])

    await db.agent.delete({ where: { id } })

    return noContent()
  })
}
