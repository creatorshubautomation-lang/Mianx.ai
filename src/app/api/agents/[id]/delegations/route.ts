// GET & POST /api/agents/[id]/delegations — Agent delegation management

import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  created,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'
import { canDelegate, createDelegation } from '@/lib/agent-workforce'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/agents/[id]/delegations — List delegations (parent or child)
export async function GET(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id } = await context.params
    const userId = await getUserIdFromRequest(request)

    const agent = await db.agent.findUnique({ where: { id } })
    if (!agent) throw new NotFoundError('Agent')

    await requireOrgMember(userId, agent.organizationId)
    await requirePermission(userId, agent.organizationId, [Permissions.AGENT_RUN])

    // Find delegations where this agent is parent OR child
    const [asParent, asChild] = await Promise.all([
      db.agentDelegation.findMany({
        where: { parentAgentId: id },
        include: {
          parent: { select: { id: true, name: true, slug: true } },
          child: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.agentDelegation.findMany({
        where: { childAgentId: id },
        include: {
          parent: { select: { id: true, name: true, slug: true } },
          child: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const serialize = (d: typeof asParent[number]) => ({
      ...d,
      parent: d.parent,
      child: d.child,
      createdAt: String(d.createdAt),
    })

    // Deduplicate (a delegation may appear in both lists if parent === child, which shouldn't
    // happen but let's be safe)
    const seen = new Set<string>()
    const allDelegations: ReturnType<typeof serialize>[] = []
    for (const d of [...asParent, ...asChild]) {
      if (!seen.has(d.id)) {
        seen.add(d.id)
        allDelegations.push(serialize(d))
      }
    }

    return success({
      items: allDelegations,
      total: allDelegations.length,
      asParentCount: asParent.length,
      asChildCount: asChild.length,
    })
  })
}

// POST /api/agents/[id]/delegations — Create a delegation
export async function POST(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id } = await context.params
    const userId = await getUserIdFromRequest(request)

    const agent = await db.agent.findUnique({ where: { id } })
    if (!agent) throw new NotFoundError('Agent')

    await requireOrgMember(userId, agent.organizationId)
    await requirePermission(userId, agent.organizationId, [Permissions.AGENT_RUN])

    const body = await request.json().catch(() => null)
    if (!body || typeof body.childAgentId !== 'string' || !body.childAgentId.trim()) {
      throw new ValidationError('Request body must include a non-empty "childAgentId" string')
    }
    if (typeof body.task !== 'string' || !body.task.trim()) {
      throw new ValidationError('Request body must include a non-empty "task" string')
    }

    const childAgentId = body.childAgentId.trim()

    // Verify child agent exists
    const childAgent = await db.agent.findUnique({ where: { id: childAgentId } })
    if (!childAgent) throw new NotFoundError('Child agent')

    // Verify both agents belong to the same org
    if (childAgent.organizationId !== agent.organizationId) {
      throw new ForbiddenError('Both agents must belong to the same organization')
    }

    // Check delegation is allowed (capability-based)
    const allowed = await canDelegate(agent.id, childAgentId)
    if (!allowed) {
      throw new ForbiddenError(
        'Delegation not allowed: child agent has capabilities not covered by parent',
      )
    }

    // Create the delegation
    await createDelegation({
      parentAgentId: agent.id,
      childAgentId,
      task: body.task.trim(),
    })

    const delegation = await db.agentDelegation.findUnique({
      where: { parentAgentId_childAgentId: { parentAgentId: agent.id, childAgentId } },
      include: {
        parent: { select: { id: true, name: true, slug: true } },
        child: { select: { id: true, name: true, slug: true } },
      },
    })

    return created({
      ...delegation!,
      parent: delegation!.parent,
      child: delegation!.child,
      createdAt: String(delegation!.createdAt),
    })
  })
}
