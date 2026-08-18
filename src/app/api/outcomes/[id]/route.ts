import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  requireBody,
  NotFoundError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'
import { toJsonField } from '@/lib/types'
import type { OutcomeStatus } from '@/lib/types'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/outcomes/[id]
export async function GET(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id } = await context.params
    const userId = getUserIdFromRequest(request)

    const outcome = await db.outcome.findUnique({
      where: { id },
      include: {
        mission: { select: { id: true, title: true } },
      },
    })
    if (!outcome) throw new NotFoundError('Outcome')

    await requireOrgMember(userId, outcome.organizationId)
    await requirePermission(userId, outcome.organizationId, [Permissions.MISSION_VIEW])

    return success({
      ...outcome,
      verifiedAt: outcome.verifiedAt ? String(outcome.verifiedAt) : null,
      createdAt: String(outcome.createdAt),
      updatedAt: String(outcome.updatedAt),
    })
  })
}

// PUT /api/outcomes/[id] — update progress
export async function PUT(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id } = await context.params
    const userId = getUserIdFromRequest(request)

    const existing = await db.outcome.findUnique({ where: { id } })
    if (!existing) throw new NotFoundError('Outcome')

    await requireOrgMember(userId, existing.organizationId)
    await requirePermission(userId, existing.organizationId, [Permissions.MISSION_UPDATE])

    const body = await requireBody<{
      objective?: string
      baseline?: Record<string, unknown>
      target?: Record<string, unknown>
      currentResult?: Record<string, unknown>
      progress?: number
      confidence?: number
      status?: OutcomeStatus
      evidence?: unknown[]
    }>(request)

    const outcome = await db.outcome.update({
      where: { id },
      data: {
        ...(body.objective !== undefined ? { objective: body.objective } : {}),
        ...(body.baseline !== undefined ? { baseline: toJsonField(body.baseline) } : {}),
        ...(body.target !== undefined ? { target: toJsonField(body.target) } : {}),
        ...(body.currentResult !== undefined ? { currentResult: toJsonField(body.currentResult) } : {}),
        ...(body.progress !== undefined ? { progress: body.progress } : {}),
        ...(body.confidence !== undefined ? { confidence: body.confidence } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.evidence !== undefined ? { evidence: toJsonField(body.evidence) } : {}),
      },
      include: {
        mission: { select: { id: true, title: true } },
      },
    })

    return success({
      ...outcome,
      verifiedAt: outcome.verifiedAt ? String(outcome.verifiedAt) : null,
      createdAt: String(outcome.createdAt),
      updatedAt: String(outcome.updatedAt),
    })
  })
}
