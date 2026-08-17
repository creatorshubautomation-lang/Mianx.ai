import { db } from "@/lib/db";
import type { OrganizationMembership, Role, Permission, MembershipRole, RolePermission } from "@prisma/client";

// ─────────────────────────────────────────────
//  PERMISSION KEY CONSTANTS
// ─────────────────────────────────────────────

export const CORE_PERMS = {
  ORG_VIEW: "core.org.view",
  ORG_MANAGE: "core.org.manage",
  ORG_DELETE: "core.org.delete",
  ORG_MEMBER_VIEW: "core.org.member.view",
  ORG_MEMBER_MANAGE: "core.org.member.manage",
  ORG_MEMBER_REMOVE: "core.org.member.remove",
  ORG_ROLE_VIEW: "core.org.role.view",
  ORG_ROLE_MANAGE: "core.org.role.manage",
  ORG_DOMAIN_VIEW: "core.org.domain.view",
  ORG_DOMAIN_MANAGE: "core.org.domain.manage",
  ORG_MODULE_VIEW: "core.org.module.view",
  ORG_MODULE_MANAGE: "core.org.module.manage",
  ORG_AUDIT_VIEW: "core.org.audit.view",
  ORG_SETTINGS_VIEW: "core.org.settings.view",
  ORG_SETTINGS_MANAGE: "core.org.settings.manage",
  ORG_BILLING_VIEW: "core.org.billing.view",
  ORG_BILLING_MANAGE: "core.org.billing.manage",
  ORG_INTEGRATION_VIEW: "core.org.integration.view",
  ORG_INTEGRATION_MANAGE: "core.org.integration.manage",
  ORG_WORKFLOW_VIEW: "core.org.workflow.view",
  ORG_WORKFLOW_MANAGE: "core.org.workflow.manage",
  ORG_AGENT_VIEW: "core.org.agent.view",
  ORG_AGENT_MANAGE: "core.org.agent.manage",
  ORG_BRAND_VIEW: "core.org.brand.view",
  ORG_BRAND_MANAGE: "core.org.brand.manage",
  ORG_LOCATION_VIEW: "core.org.location.view",
  ORG_LOCATION_MANAGE: "core.org.location.manage",
  ORG_FILE_UPLOAD: "core.org.file.upload",
  ORG_FILE_DELETE: "core.org.file.delete",
} as const;

/** All core permission keys for convenience */
export const ALL_CORE_PERMISSIONS: readonly string[] = Object.values(CORE_PERMS);

// ─────────────────────────────────────────────
//  SYSTEM ROLE DEFAULT PERMISSIONS
// ─────────────────────────────────────────────

export const SYSTEM_ROLE_SLUGS = [
  "OWNER",
  "ADMIN",
  "MANAGER",
  "OPERATOR",
  "VIEWER",
] as const;

export type SystemRoleSlug = (typeof SYSTEM_ROLE_SLUGS)[number];

/**
 * Default permissions granted to each system role.
 * These are used when seeding roles or as fallback when
 * no Role record exists for a system role slug.
 */
export const SYSTEM_ROLE_DEFAULT_PERMISSIONS: Record<SystemRoleSlug, string[]> = {
  OWNER: [...ALL_CORE_PERMISSIONS],
  ADMIN: [
    CORE_PERMS.ORG_VIEW,
    CORE_PERMS.ORG_MANAGE,
    CORE_PERMS.ORG_MEMBER_VIEW,
    CORE_PERMS.ORG_MEMBER_MANAGE,
    CORE_PERMS.ORG_MEMBER_REMOVE,
    CORE_PERMS.ORG_ROLE_VIEW,
    CORE_PERMS.ORG_ROLE_MANAGE,
    CORE_PERMS.ORG_DOMAIN_VIEW,
    CORE_PERMS.ORG_DOMAIN_MANAGE,
    CORE_PERMS.ORG_MODULE_VIEW,
    CORE_PERMS.ORG_MODULE_MANAGE,
    CORE_PERMS.ORG_AUDIT_VIEW,
    CORE_PERMS.ORG_SETTINGS_VIEW,
    CORE_PERMS.ORG_SETTINGS_MANAGE,
    CORE_PERMS.ORG_BILLING_VIEW,
    CORE_PERMS.ORG_INTEGRATION_VIEW,
    CORE_PERMS.ORG_INTEGRATION_MANAGE,
    CORE_PERMS.ORG_WORKFLOW_VIEW,
    CORE_PERMS.ORG_WORKFLOW_MANAGE,
    CORE_PERMS.ORG_AGENT_VIEW,
    CORE_PERMS.ORG_AGENT_MANAGE,
    CORE_PERMS.ORG_BRAND_VIEW,
    CORE_PERMS.ORG_BRAND_MANAGE,
    CORE_PERMS.ORG_LOCATION_VIEW,
    CORE_PERMS.ORG_LOCATION_MANAGE,
    CORE_PERMS.ORG_FILE_UPLOAD,
    CORE_PERMS.ORG_FILE_DELETE,
  ],
  MANAGER: [
    CORE_PERMS.ORG_VIEW,
    CORE_PERMS.ORG_MEMBER_VIEW,
    CORE_PERMS.ORG_MEMBER_MANAGE,
    CORE_PERMS.ORG_ROLE_VIEW,
    CORE_PERMS.ORG_DOMAIN_VIEW,
    CORE_PERMS.ORG_DOMAIN_MANAGE,
    CORE_PERMS.ORG_MODULE_VIEW,
    CORE_PERMS.ORG_MODULE_MANAGE,
    CORE_PERMS.ORG_AUDIT_VIEW,
    CORE_PERMS.ORG_SETTINGS_VIEW,
    CORE_PERMS.ORG_WORKFLOW_VIEW,
    CORE_PERMS.ORG_WORKFLOW_MANAGE,
    CORE_PERMS.ORG_AGENT_VIEW,
    CORE_PERMS.ORG_AGENT_MANAGE,
    CORE_PERMS.ORG_BRAND_VIEW,
    CORE_PERMS.ORG_BRAND_MANAGE,
    CORE_PERMS.ORG_LOCATION_VIEW,
    CORE_PERMS.ORG_LOCATION_MANAGE,
    CORE_PERMS.ORG_FILE_UPLOAD,
  ],
  OPERATOR: [
    CORE_PERMS.ORG_VIEW,
    CORE_PERMS.ORG_MEMBER_VIEW,
    CORE_PERMS.ORG_DOMAIN_VIEW,
    CORE_PERMS.ORG_MODULE_VIEW,
    CORE_PERMS.ORG_AUDIT_VIEW,
    CORE_PERMS.ORG_WORKFLOW_VIEW,
    CORE_PERMS.ORG_AGENT_VIEW,
    CORE_PERMS.ORG_BRAND_VIEW,
    CORE_PERMS.ORG_LOCATION_VIEW,
    CORE_PERMS.ORG_FILE_UPLOAD,
  ],
  VIEWER: [
    CORE_PERMS.ORG_VIEW,
    CORE_PERMS.ORG_MEMBER_VIEW,
    CORE_PERMS.ORG_DOMAIN_VIEW,
    CORE_PERMS.ORG_MODULE_VIEW,
    CORE_PERMS.ORG_AUDIT_VIEW,
    CORE_PERMS.ORG_BRAND_VIEW,
    CORE_PERMS.ORG_LOCATION_VIEW,
  ],
};

// ─────────────────────────────────────────────
//  PERMISSION CACHE
//  In-memory cache keyed by membershipId.
//  TTL of 60 seconds to balance freshness vs performance.
// ─────────────────────────────────────────────

interface CachedPermissions {
  keys: Set<string>;
  expiresAt: number;
}

const permissionCache = new Map<string, CachedPermissions>();
const CACHE_TTL_MS = 60_000;

function getCachedPermissions(membershipId: string): Set<string> | null {
  const cached = permissionCache.get(membershipId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.keys;
  }
  permissionCache.delete(membershipId);
  return null;
}

function setCachedPermissions(membershipId: string, keys: Set<string>): void {
  permissionCache.set(membershipId, {
    keys,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// Periodically clean expired cache entries (every 5 min)
setInterval(
  () => {
    const now = Date.now();
    for (const [key, val] of permissionCache) {
      if (val.expiresAt <= now) permissionCache.delete(key);
    }
  },
  5 * 60_000,
);

// ─────────────────────────────────────────────
//  CORE FUNCTIONS
// ─────────────────────────────────────────────

export interface MembershipWithRoles extends OrganizationMembership {
  roles: (MembershipRole & {
    role: Role & {
      permissions: (RolePermission & { permission: Permission })[];
    };
  })[];
}

/**
 * Get the user's active membership for an organization, including roles and permissions.
 * Returns null if user has no active membership.
 */
export async function getUserMembership(
  orgId: string,
  userId: string,
): Promise<MembershipWithRoles | null> {
  const membership = await db.organizationMembership.findUnique({
    where: {
      organizationId_userId: { organizationId: orgId, userId },
    },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!membership || membership.status !== "ACTIVE") {
    return null;
  }

  return membership as MembershipWithRoles;
}

/**
 * Resolve the effective permission keys for a membership,
 * combining database-assigned permissions with system role defaults
 * as fallback for system roles that don't have a Role record.
 */
export async function getEffectivePermissions(
  orgId: string,
  userId: string,
): Promise<Set<string>> {
  // Check cache first
  const cacheKey = `${orgId}:${userId}`;
  const cached = getCachedPermissions(cacheKey);
  if (cached) return new Set(cached);

  const membership = await getUserMembership(orgId, userId);

  if (!membership || membership.roles.length === 0) {
    return new Set();
  }

  const permissionKeys = new Set<string>();

  for (const membershipRole of membership.roles) {
    const role = membershipRole.role;

    // If the role has explicit permissions in the DB, use those
    if (role.permissions.length > 0) {
      for (const rp of role.permissions) {
        permissionKeys.add(rp.permission.key);
      }
    }
    // If this is a system role (by slug) with no explicit permissions,
    // fall back to system role defaults
    else if (role.isSystem && role.slug in SYSTEM_ROLE_DEFAULT_PERMISSIONS) {
      const defaults =
        SYSTEM_ROLE_DEFAULT_PERMISSIONS[
          role.slug as SystemRoleSlug
        ];
      for (const key of defaults) {
        permissionKeys.add(key);
      }
    }
  }

  // Cache the result
  setCachedPermissions(cacheKey, permissionKeys);

  return permissionKeys;
}

/**
 * Check if a user has a specific permission in an organization.
 * Returns true/false.
 */
export async function hasPermission(
  orgId: string,
  userId: string,
  permissionKey: string,
): Promise<boolean> {
  const permissions = await getEffectivePermissions(orgId, userId);
  return permissions.has(permissionKey);
}

/**
 * Require a specific permission. Throws an AuthorizationError if the
 * user lacks the permission. Use this in API routes.
 */
export async function requirePermission(
  orgId: string,
  userId: string,
  permissionKey: string,
): Promise<void> {
  const has = await hasPermission(orgId, userId, permissionKey);
  if (!has) {
    throw new AuthorizationError(permissionKey);
  }
}

/**
 * Check if a user has an active membership in the organization.
 */
export async function canAccessOrganization(
  orgId: string,
  userId: string,
): Promise<boolean> {
  const membership = await db.organizationMembership.findUnique({
    where: {
      organizationId_userId: { organizationId: orgId, userId },
    },
    select: { status: true },
  });
  return membership?.status === "ACTIVE";
}

/**
 * Check if a user is the OWNER of an organization.
 * OWNER is determined by having a role with slug "OWNER".
 */
export async function isOrgOwner(
  orgId: string,
  userId: string,
): Promise<boolean> {
  const membership = await db.organizationMembership.findUnique({
    where: {
      organizationId_userId: { organizationId: orgId, userId },
    },
    include: {
      roles: {
        include: {
          role: {
            select: { slug: true, isSystem: true },
          },
        },
      },
    },
  });

  if (!membership || membership.status !== "ACTIVE") return false;

  return membership.roles.some(
    (mr) => mr.role.slug === "OWNER" && mr.role.isSystem,
  );
}

/**
 * List all organizations the user has an active membership in.
 */
export async function getAccessibleOrganizations(userId: string) {
  const memberships = await db.organizationMembership.findMany({
    where: {
      userId,
      status: "ACTIVE",
    },
    include: {
      organization: {
        include: {
          _count: {
            select: {
              memberships: { where: { status: "ACTIVE" } },
              domains: { where: { status: "active" } },
              modules: { where: { status: "active" } },
            },
          },
        },
      },
      roles: {
        include: {
          role: {
            select: {
              id: true,
              name: true,
              slug: true,
              isSystem: true,
            },
          },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return memberships.map((m) => ({
    membershipId: m.id,
    joinedAt: m.joinedAt,
    organization: m.organization,
    roles: m.roles.map((mr) => mr.role),
  }));
}

/**
 * Ensure the system roles exist in the database for a given organization.
 * Called when an organization is created.
 */
export async function ensureSystemRoles(orgId: string): Promise<void> {
  const existingRoles = await db.role.findMany({
    where: {
      organizationId: orgId,
      isSystem: true,
    },
    select: { slug: true },
  });

  const existingSlugs = new Set(existingRoles.map((r) => r.slug));

  for (const slug of SYSTEM_ROLE_SLUGS) {
    if (!existingSlugs.has(slug)) {
      // Create the role
      const role = await db.role.create({
        data: {
          organizationId: orgId,
          name: slug.charAt(0) + slug.slice(1).toLowerCase(),
          slug,
          isSystem: true,
          description: `System role: ${slug}`,
        },
      });

      // Seed permissions for this system role from defaults
      const defaultPerms = SYSTEM_ROLE_DEFAULT_PERMISSIONS[slug];
      const permissions = await db.permission.findMany({
        where: { key: { in: defaultPerms } },
      });

      if (permissions.length > 0) {
        await db.rolePermission.createMany({
          data: permissions.map((p) => ({
            roleId: role.id,
            permissionId: p.id,
          })),
        });
      }
    }
  }
}

/**
 * Ensure all core permissions exist in the Permission table.
 * Should be called during seeding or on first access.
 */
export async function ensureCorePermissions(): Promise<void> {
  for (const key of ALL_CORE_PERMISSIONS) {
    await db.permission.upsert({
      where: { key },
      update: {},
      create: {
        key,
        description: `Permission: ${key}`,
      },
    });
  }
}

// ─────────────────────────────────────────────
//  CUSTOM ERROR CLASS
// ─────────────────────────────────────────────

export class AuthorizationError extends Error {
  public readonly code = "FORBIDDEN";
  public readonly statusCode = 403;
  public readonly permissionKey: string;

  constructor(permissionKey: string) {
    super(`You don't have permission: ${permissionKey}`);
    this.name = "AuthorizationError";
    this.permissionKey = permissionKey;
  }
}

// ─────────────────────────────────────────────
//  SLUG GENERATOR
// ─────────────────────────────────────────────

export function generateOrgSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\-\s]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    + "-" + Math.random().toString(36).slice(2, 8);
}

export function generateRoleSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\-\s]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
