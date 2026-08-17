import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  canAccessOrganization,
  requirePermission,
} from "@/lib/authorization";
import { formatErrorResponse } from "@/lib/org-context";

// ─────────────────────────────────────────────
//  SCHEMAS
// ─────────────────────────────────────────────

const VALID_SCOPE_TYPES = [
  "PLATFORM",
  "ORGANIZATION",
  "DOMAIN",
  "MODULE",
  "USER",
] as const;

const upsertSettingSchema = z.object({
  scopeType: z.enum(VALID_SCOPE_TYPES),
  scopeId: z.string().max(100).optional(),
  key: z.string().min(1).max(200),
  value: z.string().max(50000),
});

const deleteSettingSchema = z.object({
  scopeType: z.enum(VALID_SCOPE_TYPES),
  scopeId: z.string().max(100).optional().nullable(),
  key: z.string().min(1).max(200),
});

// ─────────────────────────────────────────────
//  GET /api/organizations/[id]/settings
//  List settings grouped by scopeType
// ─────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  try {
    const hasAccess = await canAccessOrganization(id, session.user.id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Not a member of this organization" } },
        { status: 403 },
      );
    }
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    const { searchParams } = new URL(request.url);
    const scopeTypeFilter = searchParams.get("scopeType");

    const where: Record<string, unknown> = { organizationId: id };

    if (scopeTypeFilter && VALID_SCOPE_TYPES.includes(scopeTypeFilter as (typeof VALID_SCOPE_TYPES)[number])) {
      where.scopeType = scopeTypeFilter;
    }

    const settings = await db.setting.findMany({
      where,
      select: {
        id: true,
        scopeType: true,
        scopeId: true,
        key: true,
        value: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ scopeType: "asc" }, { key: "asc" }],
    });

    // Group by scopeType
    const grouped: Record<string, Array<{ id: string; scopeId: string | null; key: string; value: string; createdAt: Date; updatedAt: Date }>> = {};
    for (const setting of settings) {
      const scope = setting.scopeType;
      if (!grouped[scope]) {
        grouped[scope] = [];
      }
      grouped[scope].push({
        id: setting.id,
        scopeId: setting.scopeId,
        key: setting.key,
        value: setting.value,
        createdAt: setting.createdAt,
        updatedAt: setting.updatedAt,
      });
    }

    return NextResponse.json({
      data: grouped,
      meta: { total: settings.length },
    });
  } catch (error) {
    console.error("[organizations/:id/settings] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch settings" } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  POST /api/organizations/[id]/settings
//  Upsert a setting
// ─────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  try {
    await requirePermission(id, session.user.id, "core.org.settings.manage");
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    const body = await request.json();
    const parsed = upsertSettingSchema.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: firstIssue ? firstIssue.message : "Invalid input",
          },
        },
        { status: 400 },
      );
    }

    const { scopeType, scopeId, key, value } = parsed.data;

    // Use findFirst + create/update pattern since scopeId can be null
    // and Prisma composite unique doesn't handle nulls well
    const existing = await db.setting.findFirst({
      where: { organizationId: id, scopeType, scopeId: scopeId ?? null, key },
    });

    let setting;
    if (existing) {
      setting = await db.setting.update({
        where: { id: existing.id },
        data: { value },
      });
    } else {
      setting = await db.setting.create({
        data: {
          organizationId: id,
          scopeType,
          scopeId: scopeId ?? null,
          key,
          value,
        },
      });
    }

    // Audit log
    await db.auditLog.create({
      data: {
        organizationId: id,
        actorType: "HUMAN",
        actorId: session.user.id,
        action: "setting.upsert",
        resourceType: "Setting",
        resourceId: setting.id,
        metadata: JSON.stringify({ scopeType, scopeId, key }),
      },
    });

    return NextResponse.json({
      data: {
        id: setting.id,
        scopeType: setting.scopeType,
        scopeId: setting.scopeId,
        key: setting.key,
        value: setting.value,
        createdAt: setting.createdAt,
        updatedAt: setting.updatedAt,
      },
    });
  } catch (error) {
    console.error("[organizations/:id/settings] POST error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to upsert setting" } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  DELETE /api/organizations/[id]/settings
//  Delete a setting by scopeType, scopeId, key
// ─────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  try {
    await requirePermission(id, session.user.id, "core.org.settings.manage");
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    const { searchParams } = new URL(request.url);
    const scopeType = searchParams.get("scopeType");
    const scopeId = searchParams.get("scopeId");
    const key = searchParams.get("key");

    const parsed = deleteSettingSchema.safeParse({
      scopeType: scopeType ?? undefined,
      scopeId: scopeId ?? null,
      key: key ?? undefined,
    });

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: firstIssue ? firstIssue.message : "Invalid input. scopeType and key are required query parameters.",
          },
        },
        { status: 400 },
      );
    }

    const { scopeType: validatedScopeType, scopeId: validatedScopeId, key: validatedKey } = parsed.data;

    // Verify the setting exists and belongs to this org
    const existing = await db.setting.findFirst({
      where: {
        organizationId: id,
        scopeType: validatedScopeType,
        scopeId: validatedScopeId ?? null,
        key: validatedKey,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Setting not found" } },
        { status: 404 },
      );
    }

    await db.setting.delete({
      where: { id: existing.id },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        organizationId: id,
        actorType: "HUMAN",
        actorId: session.user.id,
        action: "setting.delete",
        resourceType: "Setting",
        resourceId: existing.id,
        metadata: JSON.stringify({
          scopeType: validatedScopeType,
          scopeId: validatedScopeId,
          key: validatedKey,
        }),
      },
    });

    return NextResponse.json({
      data: { id: existing.id, deleted: true },
    });
  } catch (error) {
    console.error("[organizations/:id/settings] DELETE error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete setting" } },
      { status: 500 },
    );
  }
}
