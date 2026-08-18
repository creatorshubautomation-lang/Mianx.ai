import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  noContent,
  requireBody,
 NotFoundError,
  ValidationError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'
import type { MembershipStatus } from '@/lib/types'

type RouteContext = { params: Promise<{ id: string; memberId: string }> }

// PUT /api/organizations/[id]/members/[memberId] — update role/status
export async function PUT(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id, memberId } = await context.params
    const userId = getUserIdFromRequest(request)
    await requireOrgMember(userId, id)
    await requirePermission(userId, id, [Permissions.ORG_MEMBERS_MANAGE])

    const body = await requireBody<{ roleSlug?: string; status?: MembershipStatus }>(request)

    const membership = await db.organizationMembership.findUnique({
      where: { id: memberId },
      include: { roles: true },
    })
    if (!membership || membership.organizationId !== id) {
      throw new NotFoundError('Membership')
    }

    // Update status if provided
    if (body.status) {
      const validStatuses: MembershipStatus[] = ['invited', 'active', 'suspended', 'removed']
      if (!validStatuses.includes(body.status)) {
        throw new ValidationError(
          `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
          { status: body.status },
        )
      }
      await db.organizationMembership.update({
        where: { id: memberId },
        data: { status: body.status },
      })
    }

    // Update role if provided
    if (body.roleSlug) {
      let role = await db.role.findFirst({ where: { organizationId: id, slug: body.roleSlug } })
      if (!role) {
        role = await db.role.create({
          data: {
            organizationId: id,
            name: body.roleSlug.charAt(0).toUpperCase() + body.roleSlug.slice(1),
            slug: body.roleSlug,
            isSystem: false,
          },
        })
      }

      // Remove old roles and assign new one
      await db.membershipRole.deleteMany({ where: { membershipId: memberId } })
      await db.membershipRole.create({
        data: { membershipId: memberId, roleId: role.id },
      })
    }

    const updated = await db.organizationMembership.findUnique({
      where: { id: memberId },
      include: {
        user: { select: { id: true, email: true, displayName: true, avatarUrl: true } },
        roles: { include: { role: true } },
      },
    })

    return success({
      id: updated!.id,
      organizationId: updated!.organizationId,
      userId: updated!.userId,
      status: updated!.status,
      joinedAt: updated!.joinedAt ? String(updated!.joinedAt) : null,
      createdAt: String(updated!.createdAt),
      updatedAt: String(updated!.updatedAt),
      user: updated!.user,
      roles: updated!.roles.map((mr) => ({
        id: mr.role.id,
        name: mr.role.name,
        slug: mr.role.slug,
      })),
    })
  })
}

// DELETE /api/organizations/[id]/members/[memberId] — remove member
export async function DELETE(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id, memberId } = await context.params
    const userId = getUserIdFromRequest(request)
    await requireOrgMember(userId, id)
    await requirePermission(userId, id, [Permissions.ORG_MEMBERS_MANAGE])

    const membership = await db.organizationMembership.findUnique({
      where: { id: memberId },
    })
    if (!membership || membership.organizationId !== id) {
      throw new NotFoundError('Membership')
    }

    await db.organizationMembership.delete({ where: { id: memberId } })

    return noContent()
  })
}
