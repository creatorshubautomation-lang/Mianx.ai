// GET & POST /api/agents/[id]/memory — Agent memory management

import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  created,
  NotFoundError,
  ValidationError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'
import { toJsonField } from '@/lib/types'
import type { MemoryScope } from '@prisma/client'

type RouteContext = { params: Promise<{ id: string }> }

const VALID_SCOPES = new Set<string>([
  'session',
  'conversation',
  'user',
  'organization',
  'domain',
  'agent',
  'operational',
])

// GET /api/agents/[id]/memory — List memories for an agent
export async function GET(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id } = await context.params
    const userId = await getUserIdFromRequest(request)

    const agent = await db.agent.findUnique({ where: { id } })
    if (!agent) throw new NotFoundError('Agent')

    await requireOrgMember(userId, agent.organizationId)
    await requirePermission(userId, agent.organizationId, [Permissions.AGENT_VIEW])

    // Parse optional scope filter from query params
    const { searchParams } = new URL(request.url)
    const scopeParam = searchParams.get('scope')

    const where: Record<string, unknown> = {
      agentId: id,
      organizationId: agent.organizationId,
    }
    if (scopeParam && VALID_SCOPES.has(scopeParam)) {
      where.scope = scopeParam
    }

    const memories = await db.agentMemory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return success({
      items: memories.map((m) => ({
        ...m,
        createdAt: String(m.createdAt),
        updatedAt: String(m.updatedAt),
      })),
      total: memories.length,
    })
  })
}

// POST /api/agents/[id]/memory — Create a new memory record
export async function POST(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id } = await context.params
    const userId = await getUserIdFromRequest(request)

    const agent = await db.agent.findUnique({ where: { id } })
    if (!agent) throw new NotFoundError('Agent')

    await requireOrgMember(userId, agent.organizationId)
    await requirePermission(userId, agent.organizationId, [Permissions.AGENT_UPDATE])

    const body = await request.json().catch(() => null)
    if (!body || typeof body.content !== 'string' || !body.content.trim()) {
      throw new ValidationError('Request body must include a non-empty "content" string')
    }

    // Validate scope if provided
    const scope: MemoryScope = body.scope && VALID_SCOPES.has(body.scope)
      ? (body.scope as MemoryScope)
      : 'session'

    const metadata = body.metadata && typeof body.metadata === 'object'
      ? toJsonField(body.metadata)
      : '{}'

    const memory = await db.agentMemory.create({
      data: {
        organizationId: agent.organizationId,
        agentId: agent.id,
        scope,
        content: body.content.trim(),
        metadata,
      },
    })

    return created({
      ...memory,
      createdAt: String(memory.createdAt),
      updatedAt: String(memory.updatedAt),
    })
  })
}
