import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  NotFoundError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'

type RouteContext = { params: Promise<{ runId: string }> }

// GET /api/workflows/runs/[runId] — single run with steps
export async function GET(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { runId } = await context.params
    const userId = await getUserIdFromRequest(request)

    const run = await db.workflowRun.findUnique({
      where: { id: runId },
    })
    if (!run) throw new NotFoundError('WorkflowRun')

    await requireOrgMember(userId, run.organizationId)
    await requirePermission(userId, run.organizationId, [Permissions.WORKFLOW_VIEW])

    const [workflow, steps, approvals] = await Promise.all([
      db.workflow.findUnique({
        where: { id: run.workflowId },
        select: { id: true, name: true, slug: true },
      }),
      db.workflowStepRun.findMany({
        where: { workflowRunId: runId },
        orderBy: { id: 'asc' },
      }),
      db.workflowApproval.findMany({
        where: { workflowRunId: runId },
      }),
    ])

    return success({
      ...run,
      workflow,
      steps: steps.map((s) => ({
        ...s,
        startedAt: s.startedAt ? String(s.startedAt) : null,
        completedAt: s.completedAt ? String(s.completedAt) : null,
      })),
      approvals: approvals.map((a) => ({
        ...a,
        expiresAt: a.expiresAt ? String(a.expiresAt) : null,
        createdAt: String(a.createdAt),
        decidedAt: a.decidedAt ? String(a.decidedAt) : null,
      })),
      startedAt: run.startedAt ? String(run.startedAt) : null,
      completedAt: run.completedAt ? String(run.completedAt) : null,
      createdAt: String(run.createdAt),
      updatedAt: String(run.updatedAt),
    })
  })
}
