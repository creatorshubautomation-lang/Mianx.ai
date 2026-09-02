// POST /api/skills/[key]/assign — Assign a skill to an agent

import {
  withErrorHandler,
  success,
  getOrgIdParam,
  requireBody,
  ValidationError,
  NotFoundError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'
import { db } from '@/lib/db'
import { assignSkillToAgent } from '@/lib/skill-service'

type RouteContext = { params: Promise<{ key: string }> }

type AssignSkillBody = {
  agentId: string
  level?: number
}

export async function POST(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { key } = await context.params
    const userId = await getUserIdFromRequest(request)
    const { searchParams } = new URL(request.url)
    const organizationId = getOrgIdParam(searchParams)
    if (!organizationId) throw new ValidationError('organizationId query parameter is required')

    await requireOrgMember(userId, organizationId)
    await requirePermission(userId, organizationId, [Permissions.AGENT_UPDATE])

    const body = await requireBody<AssignSkillBody>(request)

    if (!body.agentId) throw new ValidationError('agentId is required')

    // Verify agent belongs to this organization (cross-tenant prevention)
    const agent = await db.agent.findFirst({
      where: { id: body.agentId, organizationId },
      select: { id: true },
    })
    if (!agent) throw new NotFoundError('Agent')

    if (body.level !== undefined) {
      const level = Number(body.level)
      if (!Number.isInteger(level) || level < 1 || level > 5) {
        throw new ValidationError('level must be an integer between 1 and 5')
      }
    }

    const assignment = await assignSkillToAgent({
      agentId: body.agentId,
      skillKey: key,
      level: body.level,
    })

    return success(assignment)
  })
}
