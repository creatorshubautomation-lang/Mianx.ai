// POST /api/tools/execute — Execute a tool

import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  created,
  getOrgIdParam,
  requireBody,
  ValidationError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'
import { executeTool } from '@/lib/tool-executor'
import { getTool } from '@/lib/tool-registry'
import { toJsonField } from '@/lib/types'

type ExecuteToolBody = {
  toolKey: string
  input: Record<string, unknown>
  agentId?: string
}

export async function POST(request: Request) {
  return withErrorHandler(async () => {
    const userId = await getUserIdFromRequest(request)
    const { searchParams } = new URL(request.url)
    const organizationId = getOrgIdParam(searchParams)
    if (!organizationId) throw new ValidationError('organizationId query parameter is required')

    await requireOrgMember(userId, organizationId)

    const body = await requireBody<ExecuteToolBody>(request)

    if (!body.toolKey) throw new ValidationError('toolKey is required')
    if (!body.input || typeof body.input !== 'object') throw new ValidationError('input must be an object')

    // If an agent is supplied, bind it explicitly to the authenticated tenant.
    // Never allow an agent ID from another organization to enter execution/logging.
    if (body.agentId) {
      const agent = await db.agent.findFirst({
        where: { id: body.agentId, organizationId },
        select: { id: true },
      })
      if (!agent) {
        throw new ValidationError('Agent not found in this organization')
      }
    }

    // Resolve tool definition for permission check
    const tool = getTool(body.toolKey)
    if (!tool) throw new ValidationError(`Tool not found or disabled: ${body.toolKey}`)

    // Check permissions based on tool's requiredPermissions
    if (tool.requiredPermissions.length > 0) {
      await requirePermission(userId, organizationId, tool.requiredPermissions as unknown as Array<keyof typeof Permissions>)
    }

    // Get org's autonomy policy
    let autonomyPolicy = await db.autonomyPolicy.findUnique({
      where: { organizationId },
    })

    // Create default policy if not exists
    if (!autonomyPolicy) {
      autonomyPolicy = await db.autonomyPolicy.create({
        data: { organizationId },
      })
    }

    // Execute the tool
    const result = await executeTool({
      toolKey: body.toolKey,
      input: body.input,
      organizationId,
      agentId: body.agentId,
      userId,
      autonomyLevel: autonomyPolicy.level,
    })

    // If approval required, create a WorkflowApproval record
    if (result.approvalRequired) {
      const approval = await db.workflowApproval.create({
        data: {
          organizationId,
          requestedBy: userId,
          riskLevel: result.riskLevel ?? 'medium',
          requestedAction: toJsonField({
            type: 'tool_execution',
            toolKey: body.toolKey,
            input: body.input,
            agentId: body.agentId ?? null,
          }),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h expiry
        },
      })

      return created({
        approvalRequired: true,
        approval: {
          id: approval.id,
          riskLevel: approval.riskLevel,
          expiresAt: approval.expiresAt ? String(approval.expiresAt) : null,
          createdAt: String(approval.createdAt),
        },
      })
    }

    if (result.error) {
      return success({
        approvalRequired: false,
        error: result.error,
        output: result.output,
        sanitized: result.sanitized,
        riskLevel: result.riskLevel,
      })
    }

    return success({
      approvalRequired: false,
      output: result.output,
      sanitized: result.sanitized,
      riskLevel: result.riskLevel,
    })
  })
}
