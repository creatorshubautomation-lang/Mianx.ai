import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  requireBody,
  getOrgIdParam,
  ValidationError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'
import { toJsonField } from '@/lib/types'
import type { AutonomyLevel } from '@/lib/types'

// GET /api/autonomy — get org autonomy policy
export async function GET(request: Request) {
  return withErrorHandler(async () => {
    const userId = await getUserIdFromRequest(request)
    const { searchParams } = new URL(request.url)
    const organizationId = getOrgIdParam(searchParams)
    if (!organizationId) throw new ValidationError('organizationId query parameter is required')

    await requireOrgMember(userId, organizationId)

    let policy = await db.autonomyPolicy.findUnique({
      where: { organizationId },
    })

    // Create default policy if not exists
    if (!policy) {
      policy = await db.autonomyPolicy.create({
        data: { organizationId },
      })
    }

    return success({
      ...policy,
      createdAt: String(policy.createdAt),
      updatedAt: String(policy.updatedAt),
    })
  })
}

// PUT /api/autonomy — update policy
export async function PUT(request: Request) {
  return withErrorHandler(async () => {
    const userId = await getUserIdFromRequest(request)
    const { searchParams } = new URL(request.url)
    const organizationId = getOrgIdParam(searchParams)
    if (!organizationId) throw new ValidationError('organizationId query parameter is required')

    await requireOrgMember(userId, organizationId)
    await requirePermission(userId, organizationId, [Permissions.ORG_SETTINGS])

    const body = await requireBody<{
      level?: AutonomyLevel
      config?: Record<string, unknown>
    }>(request)

    const validLevels = ['conservative', 'balanced', 'autonomous']
    if (body.level && !validLevels.includes(body.level)) {
      throw new ValidationError(`Invalid autonomy level: ${body.level}`)
    }

    const policy = await db.autonomyPolicy.upsert({
      where: { organizationId },
      create: {
        organizationId,
        level: body.level ?? 'balanced',
        config: toJsonField(body.config ?? {}),
      },
      update: {
        ...(body.level !== undefined ? { level: body.level } : {}),
        ...(body.config !== undefined ? { config: toJsonField(body.config) } : {}),
      },
    })

    return success({
      ...policy,
      createdAt: String(policy.createdAt),
      updatedAt: String(policy.updatedAt),
    })
  })
}
