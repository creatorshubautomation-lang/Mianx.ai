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

const createOrUpdateSubscriptionSchema = z.object({
  planId: z.string().min(1),
  planVersionId: z.string().min(1).optional(),
});

// ─────────────────────────────────────────────
//  GET /api/organizations/[id]/billing/subscription
//  Get current subscription details with plan info, version, period dates, status
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
        { error: { code: "FORBIDDEN", message: "You don't have an active membership in this organization" } },
        { status: 403 },
      );
    }
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    const subscription = await db.orgSubscription.findFirst({
      where: {
        organizationId: id,
        status: { in: ["TRIALING", "ACTIVE", "PAST_DUE", "IN_GRACE_PERIOD", "PAUSED"] },
      },
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!subscription) {
      return NextResponse.json({
        data: null,
        meta: { hasSubscription: false },
      });
    }

    // Fetch plan and version details
    const plan = await db.plan.findUnique({
      where: { id: subscription.planId },
      include: {
        versions: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    let planVersion: Awaited<ReturnType<typeof db.planVersion.findUnique>> = null;
    if (subscription.planVersionId) {
      planVersion = await db.planVersion.findUnique({
        where: { id: subscription.planVersionId },
      });
    }

    return NextResponse.json({
      data: {
        id: subscription.id,
        organizationId: subscription.organizationId,
        planId: subscription.planId,
        planVersionId: subscription.planVersionId,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        trialEnd: subscription.trialEnd,
        cancelAt: subscription.cancelAt,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        metadata: subscription.metadata ? JSON.parse(subscription.metadata) : {},
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
        plan: plan
          ? {
              id: plan.id,
              name: plan.name,
              slug: plan.slug,
              description: plan.description,
              isActive: plan.isActive,
            }
          : null,
        planVersion: planVersion
          ? {
              id: planVersion.id,
              version: planVersion.version,
              priceMonthly: planVersion.priceMonthly,
              priceAnnual: planVersion.priceAnnual,
              features: planVersion.features ? JSON.parse(planVersion.features) : [],
              limits: planVersion.limits ? JSON.parse(planVersion.limits) : {},
            }
          : null,
      },
      meta: { hasSubscription: true },
    });
  } catch (error) {
    console.error("[billing/subscription] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch subscription" } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  POST /api/organizations/[id]/billing/subscription
//  Create or update subscription (requires core.billing.manage)
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
    await requirePermission(id, session.user.id, "core.org.billing.manage");
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    const body = await request.json();
    const parsed = createOrUpdateSubscriptionSchema.safeParse(body);

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

    const { planId, planVersionId } = parsed.data;

    // Validate the plan exists and is active
    const plan = await db.plan.findUnique({
      where: { id: planId },
      include: {
        versions: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!plan || !plan.isActive) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Plan not found or is not active" } },
        { status: 404 },
      );
    }

    // Resolve the plan version to use
    let resolvedVersionId = planVersionId;
    if (!resolvedVersionId && plan.versions.length > 0) {
      resolvedVersionId = plan.versions[0].id;
    }

    // If a specific version was requested, validate it belongs to this plan
    if (resolvedVersionId) {
      const versionExists = await db.planVersion.findFirst({
        where: { id: resolvedVersionId, planId },
      });
      if (!versionExists) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Specified plan version not found for this plan" } },
          { status: 404 },
        );
      }
    }

    // Check for existing active subscription
    const existingSubscription = await db.orgSubscription.findFirst({
      where: {
        organizationId: id,
        status: { in: ["TRIALING", "ACTIVE", "PAST_DUE", "IN_GRACE_PERIOD", "PAUSED"] },
      },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();
    const trialEndDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days trial

    let subscription;

    if (existingSubscription) {
      // Update existing subscription
      subscription = await db.orgSubscription.update({
        where: { id: existingSubscription.id },
        data: {
          planId,
          planVersionId: resolvedVersionId ?? null,
          status: "TRIALING",
          currentPeriodStart: now,
          currentPeriodEnd: trialEndDate,
          trialEnd: trialEndDate,
          cancelAt: null,
          updatedAt: now,
          metadata: JSON.stringify({
            ...((existingSubscription.metadata ? JSON.parse(existingSubscription.metadata) : {}) as Record<string, unknown>),
            planChangedAt: now.toISOString(),
            previousPlanId: existingSubscription.planId,
          }),
        },
      });
    } else {
      // Create new subscription in TRIALING status
      subscription = await db.orgSubscription.create({
        data: {
          organizationId: id,
          planId,
          planVersionId: resolvedVersionId ?? null,
          status: "TRIALING",
          currentPeriodStart: now,
          currentPeriodEnd: trialEndDate,
          trialEnd: trialEndDate,
          metadata: JSON.stringify({ trialStartedAt: now.toISOString() }),
        },
      });
    }

    // Create entitlements from plan features
    if (resolvedVersionId) {
      const version = await db.planVersion.findUnique({
        where: { id: resolvedVersionId },
      });

      if (version) {
        const features: string[] = version.features ? JSON.parse(version.features) : [];
        const limits: Record<string, number> = version.limits ? JSON.parse(version.limits) : {};

        for (const featureKey of features) {
          await db.entitlement.upsert({
            where: {
              organizationId_featureKey: {
                organizationId: id,
                featureKey,
              },
            },
            update: {
              status: "ENABLED",
              limit: limits[featureKey] ?? null,
              validFrom: now,
              validUntil: trialEndDate,
            },
            create: {
              organizationId: id,
              featureKey,
              status: "ENABLED",
              limit: limits[featureKey] ?? null,
              used: 0,
              validFrom: now,
              validUntil: trialEndDate,
              metadata: JSON.stringify({
                source: "subscription",
                subscriptionId: subscription.id,
                planId,
                planVersionId: resolvedVersionId,
              }),
            },
          });
        }
      }
    }

    // Create AuditLog
    await db.auditLog.create({
      data: {
        organizationId: id,
        actorType: "HUMAN",
        actorId: session.user.id,
        action: existingSubscription ? "billing.subscription.update" : "billing.subscription.create",
        resourceType: "OrgSubscription",
        resourceId: subscription.id,
        metadata: JSON.stringify({
          planId,
          planVersionId: resolvedVersionId ?? null,
          status: subscription.status,
          trialEnd: trialEndDate.toISOString(),
          wasUpdate: !!existingSubscription,
        }),
      },
    });

    return NextResponse.json(
      {
        data: {
          id: subscription.id,
          organizationId: subscription.organizationId,
          planId: subscription.planId,
          planVersionId: subscription.planVersionId,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          trialEnd: subscription.trialEnd,
          createdAt: subscription.createdAt,
          updatedAt: subscription.updatedAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[billing/subscription] POST error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create or update subscription" } },
      { status: 500 },
    );
  }
}
