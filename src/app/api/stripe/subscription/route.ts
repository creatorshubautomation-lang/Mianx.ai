import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPlanByTier } from "@/lib/stripe";

// GET /api/stripe/subscription
// Returns current user's subscription status

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get user with plan
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get active subscription
    const subscription = await db.subscription.findFirst({
      where: {
        userId: session.user.id,
        status: { in: ["active", "past_due"] },
      },
      orderBy: { createdAt: "desc" },
    });

    const plan = getPlanByTier(user.plan);

    return NextResponse.json({
      currentPlan: user.plan,
      planDetails: plan
        ? {
            name: plan.name,
            tier: plan.tier,
            price: plan.priceMonthly,
            features: plan.features,
            agentLimit: plan.agentLimit,
            projectLimit: plan.projectLimit,
            messageLimitPerDay: plan.messageLimitPerDay,
          }
        : null,
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            plan: subscription.plan,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
            amount: subscription.amount,
            currency: subscription.currency,
          }
        : null,
    });
  } catch (e) {
    console.error("[stripe/subscription] error:", e);
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 },
    );
  }
}
