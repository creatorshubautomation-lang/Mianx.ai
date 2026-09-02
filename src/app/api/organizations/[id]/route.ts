import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  noContent,
  errors,
  requireBody,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'
import type { UpdateOrganizationDto } from '@/lib/types'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/organizations/[id]
export async function GET(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id } = await context.params
    const userId = await getUserIdFromRequest(request)
    await requireOrgMember(userId, id)

    const org = await db.organization.findUnique({ where: { id } })
    if (!org) throw new NotFoundError('Organization')

    return success({
      ...org,
      createdAt: String(org.createdAt),
      updatedAt: String(org.updatedAt),
    })
  })
}

// PUT /api/organizations/[id]
export async function PUT(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id } = await context.params
    const userId = await getUserIdFromRequest(request)
    await requireOrgMember(userId, id)
    await requirePermission(userId, id, [Permissions.ORG_MANAGE])

    const body = await requireBody<UpdateOrganizationDto>(request)

    const existing = await db.organization.findUnique({ where: { id } })
    if (!existing) throw new NotFoundError('Organization')

    if (body.slug && body.slug !== existing.slug) {
      const slugTaken = await db.organization.findUnique({ where: { slug: body.slug } })
      if (slugTaken) {
        throw new ValidationError('An organization with this slug already exists', { slug: body.slug })
      }
    }

    const org = await db.organization.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.slug !== undefined ? { slug: body.slug } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
        ...(body.locale !== undefined ? { locale: body.locale } : {}),
        ...(body.currency !== undefined ? { currency: body.currency } : {}),
      },
    })

    return success({
      ...org,
      createdAt: String(org.createdAt),
      updatedAt: String(org.updatedAt),
    })
  })
}

// DELETE /api/organizations/[id]
export async function DELETE(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id } = await context.params
    const userId = await getUserIdFromRequest(request)
    await requireOrgMember(userId, id)
    await requirePermission(userId, id, [Permissions.ORG_DELETE])

    const existing = await db.organization.findUnique({ where: { id } })
    if (!existing) throw new NotFoundError('Organization')

    await db.organization.delete({ where: { id } })

    return noContent()
  })
}
