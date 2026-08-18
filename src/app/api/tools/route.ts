// GET /api/tools — List all registered tools from the tool registry

import {
  withErrorHandler,
  success,
  getOrgIdParam,
  ValidationError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember } from '@/lib/authorization'
import { getToolRegistry } from '@/lib/tool-registry'

export async function GET(request: Request) {
  return withErrorHandler(async () => {
    const userId = getUserIdFromRequest(request)
    const { searchParams } = new URL(request.url)
    const organizationId = getOrgIdParam(searchParams)
    if (!organizationId) throw new ValidationError('organizationId query parameter is required')

    await requireOrgMember(userId, organizationId)

    const tools = getToolRegistry()

    return success(tools)
  })
}
