// GET /api/skills — List all skills
// POST /api/skills — Create a new skill

import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  created,
  getOrgIdParam,
  requireBody,
  ValidationError,
  errors,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'
import { getAvailableSkills } from '@/lib/skill-service'
import { toJsonField } from '@/lib/types'

type CreateSkillBody = {
  key: string
  version?: string
  description?: string
  inputs?: Record<string, unknown>
  outputs?: Record<string, unknown>
  requiredPermissions?: string[]
  evaluationPolicy?: Record<string, unknown>
}

// GET /api/skills
export async function GET(request: Request) {
  return withErrorHandler(async () => {
    const userId = await getUserIdFromRequest(request)
    const { searchParams } = new URL(request.url)
    const organizationId = getOrgIdParam(searchParams)
    if (!organizationId) throw new ValidationError('organizationId query parameter is required')

    await requireOrgMember(userId, organizationId)
    await requirePermission(userId, organizationId, [Permissions.AGENT_VIEW])

    const skills = await getAvailableSkills(organizationId)

    return success(skills.map((s) => ({
      ...s,
      createdAt: String(s.createdAt),
      updatedAt: String(s.updatedAt),
    })))
  })
}

// POST /api/skills
export async function POST(request: Request) {
  return withErrorHandler(async () => {
    const userId = await getUserIdFromRequest(request)
    const { searchParams } = new URL(request.url)
    const organizationId = getOrgIdParam(searchParams)
    if (!organizationId) throw new ValidationError('organizationId query parameter is required')

    await requireOrgMember(userId, organizationId)
    await requirePermission(userId, organizationId, [Permissions.AGENT_CREATE])

    const body = await requireBody<CreateSkillBody>(request)

    if (!body.key?.trim()) throw new ValidationError('Skill key is required')

    // Check for existing skill with the same key
    const existing = await db.skill.findUnique({ where: { key: body.key.trim() } })
    if (existing) throw errors.conflict(`Skill with key "${body.key.trim()}" already exists`)

    const skill = await db.skill.create({
      data: {
        key: body.key.trim(),
        version: body.version ?? '1.0.0',
        description: body.description ?? null,
        inputs: toJsonField(body.inputs ?? {}),
        outputs: toJsonField(body.outputs ?? {}),
        requiredPermissions: toJsonField(body.requiredPermissions ?? []),
        evaluationPolicy: toJsonField(body.evaluationPolicy ?? {}),
      },
    })

    return created({
      id: skill.id,
      key: skill.key,
      version: skill.version,
      description: skill.description,
      inputs: body.inputs ?? {},
      outputs: body.outputs ?? {},
      requiredPermissions: body.requiredPermissions ?? [],
      evaluationPolicy: body.evaluationPolicy ?? {},
      createdAt: String(skill.createdAt),
      updatedAt: String(skill.updatedAt),
    })
  })
}
