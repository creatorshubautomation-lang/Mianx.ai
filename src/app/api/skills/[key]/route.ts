// GET /api/skills/[key] — Get a single skill (with optional full resolution via agentId)
// DELETE /api/skills/[key] — Remove a skill

import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  noContent,
  getOrgIdParam,
  ValidationError,
  NotFoundError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'
import { resolveSkill } from '@/lib/skill-service'

type RouteContext = { params: Promise<{ key: string }> }

// GET /api/skills/[key]
export async function GET(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { key } = await context.params
    const userId = getUserIdFromRequest(request)
    const { searchParams } = new URL(request.url)
    const organizationId = getOrgIdParam(searchParams)
    if (!organizationId) throw new ValidationError('organizationId query parameter is required')

    await requireOrgMember(userId, organizationId)
    await requirePermission(userId, organizationId, [Permissions.AGENT_VIEW])

    // If agentId is provided, resolve the skill fully
    const agentId = searchParams.get('agentId') ?? undefined
    if (agentId) {
      const resolved = await resolveSkill({
        skillKey: key,
        agentId,
        organizationId,
      })

      return success({
        resolved: true,
        ...resolved,
      })
    }

    // Otherwise, return the basic skill record
    const skill = await db.skill.findUnique({ where: { key } })
    if (!skill) throw new NotFoundError('Skill')

    return success({
      resolved: false,
      id: skill.id,
      key: skill.key,
      version: skill.version,
      description: skill.description,
      createdAt: String(skill.createdAt),
      updatedAt: String(skill.updatedAt),
    })
  })
}

// DELETE /api/skills/[key]
export async function DELETE(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { key } = await context.params
    const userId = getUserIdFromRequest(request)
    const { searchParams } = new URL(request.url)
    const organizationId = getOrgIdParam(searchParams)
    if (!organizationId) throw new ValidationError('organizationId query parameter is required')

    await requireOrgMember(userId, organizationId)
    await requirePermission(userId, organizationId, [Permissions.AGENT_DELETE])

    const skill = await db.skill.findUnique({ where: { key } })
    if (!skill) throw new NotFoundError('Skill')

    await db.skill.delete({ where: { key } })

    return noContent()
  })
}
