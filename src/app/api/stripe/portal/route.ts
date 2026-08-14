import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createBillingPortalSession, findCustomerByEmail } from "@/lib/stripe";

// POST /api/stripe/portal
// Creates a Stripe billing portal session for subscription management
// (cancel, update payment method, switch plans, etc.)

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const customer = await findCustomerByEmail(session.user.email);

    if (!customer) {
      return NextResponse.json(
        { error: "No Stripe customer found. Subscribe to a plan first." },
        { status: 404 },
      );
    }

    const origin =
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");

    const portalUrl = await createBillingPortalSession(
      customer.id,
      `${origin}/?portal=returned`,
    );

    return NextResponse.json({ url: portalUrl });
  } catch (e) {
    console.error("[stripe/portal] error:", e);
    return NextResponse.json(
      {
        error: "Failed to create billing portal session",
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
