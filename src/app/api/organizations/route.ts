import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  created,
  errors,
  getPaginationParams,
  buildPaginationMeta,
  getOrgIdParam,
  requireBody,
  ValidationError,
} from '@/lib/api-response'
import { getUserIdFromRequest } from '@/lib/authorization'
import { slugify, toJsonField } from '@/lib/types'
import type { CreateOrganizationDto } from '@/lib/types'

// GET /api/organizations — list orgs the user belongs to
export async function GET(request: Request) {
  return withErrorHandler(async () => {
    const userId = await getUserIdFromRequest(request)
    const { searchParams } = new URL(request.url)
    const { cursor, limit } = getPaginationParams(searchParams)

    const where = {
      memberships: {
        some: {
          userId,
          status: 'active' as const,
        },
      },
    }

    const [total, items] = await Promise.all([
      db.organization.count({ where }),
      db.organization.findMany({
        where,
        take: limit,
        ...(cursor
          ? { cursor: { id: cursor }, skip: 1 }
          : {}),
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const nextCursor =
      items.length === limit ? items[items.length - 1].id : null

    const data = items.map((org) => ({
      ...org,
      createdAt: String(org.createdAt),
      updatedAt: String(org.updatedAt),
    }))

    return success(data, buildPaginationMeta(total, limit, items, nextCursor))
  })
}

// POST /api/organizations — create org + add user as owner
export async function POST(request: Request) {
  return withErrorHandler(async () => {
    const userId = await getUserIdFromRequest(request)
    const body = await requireBody<CreateOrganizationDto>(request)

    if (!body.name?.trim()) {
      throw new ValidationError('Organization name is required')
    }

    const slug = body.slug?.trim() || slugify(body.name)

    // Check slug uniqueness
    const existing = await db.organization.findUnique({ where: { slug } })
    if (existing) {
      throw new ValidationError('An organization with this slug already exists', { slug })
    }

    // Verify user profile exists — do NOT auto-create phantom accounts.
    // Users must register via /api/auth/register before creating orgs.
    const profile = await db.profile.findUnique({ where: { id: userId } })
    if (!profile) {
      throw new ValidationError(
        'User profile not found. Please complete registration before creating an organization.',
      )
    }

    const org = await db.organization.create({
      data: {
        name: body.name.trim(),
        slug,
        timezone: body.timezone ?? 'UTC',
        locale: body.locale ?? 'en',
        currency: body.currency ?? 'USD',
        memberships: {
          create: {
            userId,
            status: 'active',
            roles: {
              create: {
                role: {
                  create: {
                    name: 'Owner',
                    slug: 'owner',
                    description: 'Full access to all organization resources',
                    isSystem: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    return created({
      ...org,
      createdAt: String(org.createdAt),
      updatedAt: String(org.updatedAt),
    })
  })
}
