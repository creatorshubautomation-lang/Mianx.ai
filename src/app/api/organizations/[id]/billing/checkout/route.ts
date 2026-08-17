import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { requirePermission } from "@/lib/authorization";
import { formatErrorResponse } from "@/lib/org-context";

// ─────────────────────────────────────────────
//  SCHEMAS
// ─────────────────────────────────────────────

const createCheckoutSchema = z.object({
  planId: z.string().min(1),
});

// ─────────────────────────────────────────────
//  POST /api/organizations/[id]/billing/checkout
//  Create a checkout session for plan upgrade/downgrade
//  For now returns a mock checkout URL (real Stripe integration later)
//  Requires core.billing.manage
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
    const parsed = createCheckoutSchema.safeParse(body);

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

    const { planId } = parsed.data;

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

    // Check for an existing active subscription to determine upgrade vs new
    const existingSubscription = await db.orgSubscription.findFirst({
      where: {
        organizationId: id,
        status: { in: ["TRIALING", "ACTIVE", "PAST_DUE", "IN_GRACE_PERIOD", "PAUSED"] },
      },
      orderBy: { createdAt: "desc" },
    });

    const isUpgrade = !!existingSubscription;
    const currentVersion = plan.versions[0] ?? null;

    // Mock checkout session — real Stripe integration will replace this
    const mockCheckoutSessionId = `cs_mock_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const mockCheckoutUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/billing/checkout?session_id=${mockCheckoutSessionId}`;

    // Create AuditLog
    await db.auditLog.create({
      data: {
        organizationId: id,
        actorType: "HUMAN",
        actorId: session.user.id,
        action: "billing.checkout.create",
        resourceType: "OrgSubscription",
        resourceId: existingSubscription?.id ?? null,
        metadata: JSON.stringify({
          planId,
          planName: plan.name,
          planSlug: plan.slug,
          isUpgrade,
          previousPlanId: existingSubscription?.planId ?? null,
          mockCheckoutSessionId,
          priceMonthly: currentVersion?.priceMonthly ?? null,
          priceAnnual: currentVersion?.priceAnnual ?? null,
        }),
      },
    });

    return NextResponse.json(
      {
        data: {
          checkoutSessionId: mockCheckoutSessionId,
          checkoutUrl: mockCheckoutUrl,
          planId: plan.id,
          planName: plan.name,
          isUpgrade,
          currentVersion: currentVersion
            ? {
                id: currentVersion.id,
                version: currentVersion.version,
                priceMonthly: currentVersion.priceMonthly,
                priceAnnual: currentVersion.priceAnnual,
              }
            : null,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
          note: "Mock checkout session. Real Stripe integration pending.",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[billing/checkout] POST error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create checkout session" } },
      { status: 500 },
    );
  }
}
