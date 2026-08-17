import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessOrganization } from "@/lib/authorization";

// ─────────────────────────────────────────────
//  GET /api/organizations/[id]/billing/plans
//  List available plans (public — no auth required, but return org's
//  current plan info if authenticated)
// ─────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Auth is optional for this route — we try to get session but don't require it
  let userId: string | null = null;
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      const hasAccess = await canAccessOrganization(id, session.user.id);
      if (hasAccess) {
        userId = session.user.id;
      }
    }
  } catch {
    // Auth is optional — continue without it
  }

  try {
    // Fetch all active plans with their latest active version
    const plans = await db.plan.findMany({
      where: { isActive: true },
      include: {
        versions: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Get org's current subscription if authenticated
    let currentPlanId: string | null = null;
    let currentSubscriptionStatus: string | null = null;

    if (userId) {
      const currentSubscription = await db.orgSubscription.findFirst({
        where: {
          organizationId: id,
          status: { in: ["TRIALING", "ACTIVE", "PAST_DUE", "IN_GRACE_PERIOD", "PAUSED"] },
        },
        orderBy: { createdAt: "desc" },
        select: {
          planId: true,
          status: true,
        },
      });

      if (currentSubscription) {
        currentPlanId = currentSubscription.planId;
        currentSubscriptionStatus = currentSubscription.status;
      }
    }

    const data = plans.map((plan) => {
      const currentVersion = plan.versions[0] ?? null;

      return {
        id: plan.id,
        name: plan.name,
        slug: plan.slug,
        description: plan.description,
        isActive: plan.isActive,
        isCurrentPlan: plan.id === currentPlanId,
        currentSubscriptionStatus: plan.id === currentPlanId ? currentSubscriptionStatus : null,
        currentVersion: currentVersion
          ? {
              id: currentVersion.id,
              version: currentVersion.version,
              priceMonthly: currentVersion.priceMonthly,
              priceAnnual: currentVersion.priceAnnual,
              features: currentVersion.features ? JSON.parse(currentVersion.features) : [],
              limits: currentVersion.limits ? JSON.parse(currentVersion.limits) : {},
            }
          : null,
      };
    });

    return NextResponse.json({
      data,
      meta: {
        total: data.length,
        hasAuthenticatedContext: !!userId,
        currentPlanId,
      },
    });
  } catch (error) {
    console.error("[billing/plans] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch plans" } },
      { status: 500 },
    );
  }
}
