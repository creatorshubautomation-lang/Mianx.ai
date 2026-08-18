// GET /api/agents/[id]/capabilities — Agent capabilities & tools

import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  NotFoundError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'
import { parseJsonField } from '@/lib/types'
import { getAgentCapabilities } from '@/lib/agent-workforce'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id } = await context.params
    const userId = getUserIdFromRequest(request)

    const agent = await db.agent.findUnique({
      where: { id },
      include: { tools: true },
    })
    if (!agent) throw new NotFoundError('Agent')

    await requireOrgMember(userId, agent.organizationId)
    await requirePermission(userId, agent.organizationId, [Permissions.AGENT_VIEW])

    // Parse the agent's declared capabilities from JSON string
    const declaredCapabilities: string[] = parseJsonField(agent.capabilities, [])

    // Get merged capabilities from agent-workforce (own + tool-derived)
    const effectiveCapabilities = await getAgentCapabilities(agent.id)

    // Build tool details from the relation
    const tools = agent.tools.map((t) => ({
      id: t.id,
      toolKey: t.toolKey,
      riskLevel: t.riskLevel,
      enabled: t.enabled,
      timeout: t.timeout,
      configuration: parseJsonField(t.configuration, {}),
      retryPolicy: parseJsonField(t.retryPolicy, {}),
      createdAt: String(t.createdAt),
      updatedAt: String(t.updatedAt),
    }))

    // Determine which capabilities come from tools vs declared
    const toolDerivedCapabilities = effectiveCapabilities.filter((c) =>
      c.startsWith('tool:'),
    )
    const ownCapabilities = effectiveCapabilities.filter(
      (c) => !c.startsWith('tool:'),
    )

    return success({
      agentId: agent.id,
      agentName: agent.name,
      declaredCapabilities,
      effectiveCapabilities,
      ownCapabilities,
      toolDerivedCapabilities,
      tools,
    })
  })
}
