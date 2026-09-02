import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  created,
  getPaginationParams,
  buildPaginationMeta,
  requireBody,
  ValidationError,
  NotFoundError,
  errors,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/organizations/[id]/members
export async function GET(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id } = await context.params
    const userId = await getUserIdFromRequest(request)
    await requireOrgMember(userId, id)

    const { searchParams } = new URL(request.url)
    const { cursor, limit } = getPaginationParams(searchParams)

    const where = { organizationId: id }
    const [total, items] = await Promise.all([
      db.organizationMembership.count({ where }),
      db.organizationMembership.findMany({
        where,
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, email: true, displayName: true, avatarUrl: true },
          },
          roles: {
            include: {
              role: {
                include: {
                  permissions: { include: { permission: { select: { key: true, description: true } } } },
                },
              },
            },
          },
        },
      }),
    ])

    const nextCursor = items.length === limit ? items[items.length - 1].id : null

    const data = items.map((m) => ({
      id: m.id,
      organizationId: m.organizationId,
      userId: m.userId,
      status: m.status,
      joinedAt: m.joinedAt ? String(m.joinedAt) : null,
      createdAt: String(m.createdAt),
      updatedAt: String(m.updatedAt),
      user: m.user,
      roles: m.roles.map((mr) => ({
        id: mr.role.id,
        name: mr.role.name,
        slug: mr.role.slug,
        description: mr.role.description,
        isSystem: mr.role.isSystem,
        permissions: mr.role.permissions.map((rp) => ({
          key: rp.permission.key,
          description: rp.permission.description,
        })),
      })),
    }))

    return success(data, buildPaginationMeta(total, limit, items, nextCursor))
  })
}

// POST /api/organizations/[id]/members — invite member
export async function POST(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id } = await context.params
    const userId = await getUserIdFromRequest(request)
    await requireOrgMember(userId, id)
    await requirePermission(userId, id, [Permissions.ORG_MEMBERS_MANAGE])

    const body = await requireBody<{ email: string; roleSlug?: string }>(request)

    if (!body.email?.trim()) {
      throw new ValidationError('Email is required')
    }

    const roleSlug = body.roleSlug ?? 'member'

    // Find or create the target profile
    let targetUser = await db.profile.findUnique({ where: { email: body.email.trim() } })
    if (!targetUser) {
      targetUser = await db.profile.create({
        data: {
          email: body.email.trim(),
          displayName: body.email.trim().split('@')[0],
        },
      })
    }

    // Check existing membership
    const existing = await db.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId: id, userId: targetUser.id } },
    })
    if (existing) {
      throw new ValidationError('User is already a member of this organization')
    }

    // Find or create the role
    let role = await db.role.findFirst({ where: { organizationId: id, slug: roleSlug } })
    if (!role) {
      role = await db.role.create({
        data: {
          organizationId: id,
          name: roleSlug.charAt(0).toUpperCase() + roleSlug.slice(1),
          slug: roleSlug,
          isSystem: false,
        },
      })
    }

    const membership = await db.organizationMembership.create({
      data: {
        organizationId: id,
        userId: targetUser.id,
        status: 'invited',
        roles: {
          create: { roleId: role.id },
        },
      },
      include: {
        user: { select: { id: true, email: true, displayName: true, avatarUrl: true } },
        roles: { include: { role: true } },
      },
    })

    return created({
      id: membership.id,
      organizationId: membership.organizationId,
      userId: membership.userId,
      status: membership.status,
      joinedAt: membership.joinedAt ? String(membership.joinedAt) : null,
      createdAt: String(membership.createdAt),
      updatedAt: String(membership.updatedAt),
      user: membership.user,
      roles: membership.roles.map((mr) => ({
        id: mr.role.id,
        name: mr.role.name,
        slug: mr.role.slug,
      })),
    })
  })
}
