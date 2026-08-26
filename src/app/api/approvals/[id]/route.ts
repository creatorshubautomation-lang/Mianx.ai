import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  requireBody,
  NotFoundError,
  ValidationError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/approvals/[id]
export async function GET(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id } = await context.params
    const userId = await getUserIdFromRequest(request)

    const approval = await db.workflowApproval.findUnique({ where: { id } })
    if (!approval) throw new NotFoundError('Approval')

    await requireOrgMember(userId, approval.organizationId)
    await requirePermission(userId, approval.organizationId, [Permissions.APPROVAL_VIEW])

    return success({
      id: approval.id,
      workflowRunId: approval.workflowRunId,
      missionId: approval.missionId,
      organizationId: approval.organizationId,
      riskLevel: approval.riskLevel,
      requestedBy: approval.requestedBy,
      approvedBy: approval.approvedBy,
      decision: approval.decision,
      reason: approval.reason,
      expiresAt: approval.expiresAt ? String(approval.expiresAt) : null,
      createdAt: String(approval.createdAt),
      decidedAt: approval.decidedAt ? String(approval.decidedAt) : null,
    })
  })
}

// POST /api/approvals/[id] — decide: approve/reject
export async function POST(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id } = await context.params
    const userId = await getUserIdFromRequest(request)

    const approval = await db.workflowApproval.findUnique({ where: { id } })
    if (!approval) throw new NotFoundError('Approval')

    await requireOrgMember(userId, approval.organizationId)
    await requirePermission(userId, approval.organizationId, [Permissions.APPROVAL_DECIDE])

    if (approval.decision) {
      throw new ValidationError('This approval has already been decided')
    }

    const body = await requireBody<{ decision: 'approved' | 'rejected'; reason?: string }>(request)

    if (!body.decision || !['approved', 'rejected'].includes(body.decision)) {
      throw new ValidationError('decision must be "approved" or "rejected"')
    }

    const updated = await db.workflowApproval.update({
      where: { id },
      data: {
        decision: body.decision,
        approvedBy: userId,
        reason: body.reason ?? null,
        decidedAt: new Date(),
      },
    })

    return success({
      id: updated.id,
      workflowRunId: updated.workflowRunId,
      missionId: updated.missionId,
      organizationId: updated.organizationId,
      riskLevel: updated.riskLevel,
      requestedBy: updated.requestedBy,
      approvedBy: updated.approvedBy,
      decision: updated.decision,
      reason: updated.reason,
      expiresAt: updated.expiresAt ? String(updated.expiresAt) : null,
      createdAt: String(updated.createdAt),
      decidedAt: updated.decidedAt ? String(updated.decidedAt) : null,
    })
  })
}
