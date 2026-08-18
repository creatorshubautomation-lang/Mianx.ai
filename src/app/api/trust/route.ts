import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  getOrgIdParam,
  ValidationError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember } from '@/lib/authorization'

// GET /api/trust — trust center data: recent executions, agent actions, verifications, approvals
export async function GET(request: Request) {
  return withErrorHandler(async () => {
    const userId = getUserIdFromRequest(request)
    const { searchParams } = new URL(request.url)
    const organizationId = getOrgIdParam(searchParams)
    if (!organizationId) throw new ValidationError('organizationId query parameter is required')

    await requireOrgMember(userId, organizationId)

    const [recentExecutions, recentVerifications, recentApprovals, agentActionSummary] =
      await Promise.all([
        // Recent workflow runs
        db.workflowRun.findMany({
          where: { organizationId },
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            workflow: { select: { id: true, name: true, slug: true } },
            _count: { select: { steps: true, approvals: true } },
          },
        }),

        // Recent verifications
        db.verification.findMany({
          where: { mission: { organizationId } },
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            mission: { select: { id: true, title: true } },
            task: { select: { id: true, title: true } },
          },
        }),

        // Recent approvals
        db.workflowApproval.findMany({
          where: { organizationId },
          take: 10,
          orderBy: { createdAt: 'desc' },
        }),

        // Agent action summary via AI cost records
        db.aiCostRecord.groupBy({
          by: ['organizationId'],
          where: { organizationId },
          _sum: {
            inputTokens: true,
            outputTokens: true,
            totalTokens: true,
            estimatedCost: true,
          },
          _count: true,
        }),
      ])

    const formatExecution = (r: typeof recentExecutions[number]) => ({
      id: r.id,
      workflowId: r.workflowId,
      workflowName: r.workflow.name,
      status: r.status,
      currentStep: r.currentStep,
      error: r.error,
      stepCount: r._count.steps,
      approvalCount: r._count.approvals,
      startedAt: r.startedAt ? String(r.startedAt) : null,
      completedAt: r.completedAt ? String(r.completedAt) : null,
      createdAt: String(r.createdAt),
    })

    const formatVerification = (v: typeof recentVerifications[number]) => ({
      id: v.id,
      missionId: v.missionId,
      missionTitle: v.mission.title,
      taskId: v.missionTaskId,
      taskTitle: v.task?.title ?? null,
      type: v.type,
      passed: v.passed,
      verifiedAt: v.verifiedAt ? String(v.verifiedAt) : null,
      createdAt: String(v.createdAt),
    })

    const formatApproval = (a: typeof recentApprovals[number]) => ({
      id: a.id,
      requestedAction: a.requestedAction,
      riskLevel: a.riskLevel,
      decision: a.decision,
      requestedBy: a.requestedBy,
      approvedBy: a.approvedBy,
      reason: a.reason,
      expiresAt: a.expiresAt ? String(a.expiresAt) : null,
      createdAt: String(a.createdAt),
      decidedAt: a.decidedAt ? String(a.decidedAt) : null,
    })

    const summary = agentActionSummary[0]?._sum
    const actionSummary = {
      totalRuns: agentActionSummary[0]?._count ?? 0,
      totalInputTokens: summary?.inputTokens ?? 0,
      totalOutputTokens: summary?.outputTokens ?? 0,
      totalTokens: summary?.totalTokens ?? 0,
      totalEstimatedCost: summary?.estimatedCost ?? 0,
    }

    return success({
      recentExecutions: recentExecutions.map(formatExecution),
      recentVerifications: recentVerifications.map(formatVerification),
      recentApprovals: recentApprovals.map(formatApproval),
      agentActionSummary: actionSummary,
    })
  })
}
