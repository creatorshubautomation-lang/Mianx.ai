import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createCheckoutSession } from "@/lib/stripe";

// POST /api/stripe/checkout
// Creates a Stripe Checkout session for subscription
//
// Body: { planId: "starter" | "pro" | "enterprise", billing: "monthly" | "yearly" }
// Returns: { url: "https://checkout.stripe.com/..." }

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { planId, billing } = await req.json();

    if (!planId || !billing) {
      return NextResponse.json(
        { error: "planId and billing are required" },
        { status: 400 },
      );
    }

    if (!["monthly", "yearly"].includes(billing)) {
      return NextResponse.json(
        { error: "billing must be 'monthly' or 'yearly'" },
        { status: 400 },
      );
    }

    if (!["starter", "pro", "enterprise"].includes(planId)) {
      return NextResponse.json(
        { error: "Invalid plan. Free plan doesn't require checkout." },
        { status: 400 },
      );
    }

    // Build success/cancel URLs
    const origin =
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");

    const successUrl = `${origin}/?checkout=success&plan=${planId}`;
    const cancelUrl = `${origin}/?checkout=cancelled`;

    const result = await createCheckoutSession({
      planId,
      billing,
      userId: session.user.id,
      userEmail: session.user.email || "",
      userName: session.user.name || undefined,
      successUrl,
      cancelUrl,
    });

    return NextResponse.json({ url: result.url, sessionId: result.sessionId });
  } catch (e) {
    console.error("[stripe/checkout] error:", e);
    return NextResponse.json(
      {
        error: "Failed to create checkout session",
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
