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

const VALID_INTEGRATION_STATUSES = [
  "CONNECTED",
  "DEGRADED",
  "REAUTH_REQUIRED",
  "DISABLED",
  "FAILED",
] as const;

const updateIntegrationSchema = z.object({
  status: z
    .enum(VALID_INTEGRATION_STATUSES)
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  scopes: z.array(z.string().max(200)).max(50).optional(),
});

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

function maskCredentialRef(credentialRef: string | null): string | null {
  if (!credentialRef) return null;
  if (credentialRef.length <= 8) return "******";
  return credentialRef.slice(0, 4) + "******" + credentialRef.slice(-4);
}

function formatIntegration(integration: {
  id: string;
  provider: string;
  name: string;
  status: string;
  scopes: string | null;
  credentialRef: string | null;
  metadata: string | null;
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  organizationId: string;
}) {
  return {
    id: integration.id,
    provider: integration.provider,
    name: integration.name,
    status: integration.status,
    scopes: integration.scopes,
    credentialRef: maskCredentialRef(integration.credentialRef),
    metadata: integration.metadata,
    lastSyncAt: integration.lastSyncAt,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
}

// ─────────────────────────────────────────────
//  GET /api/organizations/[id]/integrations/[integrationId]
// ─────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; integrationId: string }> },
) {
  const { id, integrationId } = await params;
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
    const integration = await db.integrationConnection.findFirst({
      where: {
        id: integrationId,
        organizationId: id,
      },
    });

    if (!integration) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Integration not found" } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      data: formatIntegration(integration),
    });
  } catch (error) {
    console.error("[organizations/:id/integrations/:integrationId] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch integration" } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  PATCH /api/organizations/[id]/integrations/[integrationId]
// ─────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; integrationId: string }> },
) {
  const { id, integrationId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  try {
    await requirePermission(id, session.user.id, "core.integration.manage");
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    const body = await request.json();
    const parsed = updateIntegrationSchema.safeParse(body);

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

    const { status, metadata, scopes } = parsed.data;

    // Verify the integration exists and belongs to this org
    const existing = await db.integrationConnection.findFirst({
      where: { id: integrationId, organizationId: id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Integration not found" } },
        { status: 404 },
      );
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (metadata !== undefined) updateData.metadata = JSON.stringify(metadata);
    if (scopes !== undefined) updateData.scopes = JSON.stringify(scopes);

    const updated = await db.integrationConnection.update({
      where: { id: integrationId },
      data: updateData,
    });

    // Audit log
    await db.auditLog.create({
      data: {
        organizationId: id,
        actorType: "HUMAN",
        actorId: session.user.id,
        action: "integration.update",
        resourceType: "IntegrationConnection",
        resourceId: integrationId,
        metadata: JSON.stringify({
          provider: existing.provider,
          changes: { status, scopes, metadata },
        }),
      },
    });

    return NextResponse.json({
      data: formatIntegration(updated),
    });
  } catch (error) {
    console.error("[organizations/:id/integrations/:integrationId] PATCH error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update integration" } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  DELETE /api/organizations/[id]/integrations/[integrationId]
//  Disconnects integration: status → DISABLED, clears credentialRef
// ─────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; integrationId: string }> },
) {
  const { id, integrationId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  try {
    await requirePermission(id, session.user.id, "core.integration.manage");
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    // Verify the integration exists and belongs to this org
    const existing = await db.integrationConnection.findFirst({
      where: { id: integrationId, organizationId: id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Integration not found" } },
        { status: 404 },
      );
    }

    if (existing.status === "DISABLED") {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: "Integration is already disconnected" } },
        { status: 409 },
      );
    }

    const disconnected = await db.integrationConnection.update({
      where: { id: integrationId },
      data: {
        status: "DISABLED",
        credentialRef: null,
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        organizationId: id,
        actorType: "HUMAN",
        actorId: session.user.id,
        action: "integration.disconnect",
        resourceType: "IntegrationConnection",
        resourceId: integrationId,
        metadata: JSON.stringify({
          provider: existing.provider,
          name: existing.name,
          previousStatus: existing.status,
        }),
      },
    });

    return NextResponse.json({
      data: formatIntegration(disconnected),
    });
  } catch (error) {
    console.error("[organizations/:id/integrations/:integrationId] DELETE error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to disconnect integration" } },
      { status: 500 },
    );
  }
}