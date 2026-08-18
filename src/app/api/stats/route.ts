import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  getOrgIdParam,
  ValidationError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember } from '@/lib/authorization'

// GET /api/stats — org dashboard stats
export async function GET(request: Request) {
  return withErrorHandler(async () => {
    const userId = getUserIdFromRequest(request)
    const { searchParams } = new URL(request.url)
    const organizationId = getOrgIdParam(searchParams)
    if (!organizationId) throw new ValidationError('organizationId query parameter is required')

    await requireOrgMember(userId, organizationId)

    const [
      agentCount,
      missionCount,
      workflowCount,
      memberCount,
      integrationCount,
      domainCount,
      missionStats,
      taskStats,
      aiCostSummary,
      recentMissions,
    ] = await Promise.all([
      db.agent.count({ where: { organizationId } }),
      db.mission.count({ where: { organizationId } }),
      db.workflow.count({ where: { organizationId } }),
      db.organizationMembership.count({ where: { organizationId, status: 'active' } }),
      db.integration.count({ where: { organizationId } }),
      db.organizationDomain.count({ where: { organizationId } }),

      // Mission status breakdown
      db.mission.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: true,
      }),

      // Task status breakdown
      db.missionTask.groupBy({
        by: ['status'],
        where: { mission: { organizationId } },
        _count: true,
      }),

      // AI cost summary
      db.aiCostRecord.aggregate({
        where: { organizationId },
        _sum: {
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
          estimatedCost: true,
          actualCost: true,
        },
        _count: true,
      }),

      // Recent missions
      db.mission.findMany({
        where: { organizationId },
        take: 5,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true, status: true, updatedAt: true },
      }),
    ])

    const missionByStatus: Record<string, number> = {}
    for (const group of missionStats) {
      missionByStatus[group.status] = group._count
    }

    const taskByStatus: Record<string, number> = {}
    for (const group of taskStats) {
      taskByStatus[group.status] = group._count
    }

    const totalTasks = Object.values(taskByStatus).reduce((a, b) => a + b, 0)
    const completedTasks = taskByStatus['completed'] ?? 0
    const failedTasks = taskByStatus['failed'] ?? 0

    return success({
      agentCount,
      missionCount,
      workflowCount,
      activeMemberCount: memberCount,
      integrationCount,
      domainCount,
      missionByStatus,
      taskByStatus,
      taskSummary: {
        total: totalTasks,
        completed: completedTasks,
        failed: failedTasks,
        successRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      },
      aiCostSummary: {
        totalRuns: aiCostSummary._count,
        inputTokens: aiCostSummary._sum.inputTokens ?? 0,
        outputTokens: aiCostSummary._sum.outputTokens ?? 0,
        totalTokens: aiCostSummary._sum.totalTokens ?? 0,
        estimatedCost: aiCostSummary._sum.estimatedCost ?? 0,
        actualCost: aiCostSummary._sum.actualCost ?? 0,
      },
      recentMissions: recentMissions.map((m) => ({
        id: m.id,
        title: m.title,
        status: m.status,
        updatedAt: String(m.updatedAt),
      })),
    })
  })
}
