import { NextResponse } from "next/server";
import type { Stripe } from "stripe";
import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/db";

// POST /api/stripe/webhook
// Handles Stripe webhook events (no auth — Stripe calls this directly)
//
// Events we handle:
//   - checkout.session.completed → activate subscription
//   - customer.subscription.updated → update plan if changed
//   - customer.subscription.deleted → downgrade to FREE
//   - invoice.payment_failed → mark subscription past_due

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (e) {
    console.error("[stripe/webhook] signature verification failed:", e);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 },
    );
  }

  console.log(`[stripe/webhook] received event: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(checkoutSession);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`[stripe/webhook] unhandled event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[stripe/webhook] handler error:", e);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  Event handlers
// ─────────────────────────────────────────────

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const userId = session.metadata?.userId;
  const planId = session.metadata?.planId;
  const planTier = session.metadata?.planTier as
    | "STARTER"
    | "PRO"
    | "ENTERPRISE"
    | undefined;
  const billing = session.metadata?.billing as "monthly" | "yearly";

  if (!userId || !planTier) {
    console.error("[stripe/webhook] missing metadata in session:", session.id);
    return;
  }

  // Get subscription details
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(
    session.subscription as string,
  );

  // Calculate amount
  const amount = session.amount_total
    ? session.amount_total / 100
    : 0;
  const interval = billing === "yearly" ? 365 : 30;
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + interval);

  // Create subscription record in DB
  await db.subscription.create({
    data: {
      userId,
      plan: planTier,
      status: "active",
      startDate: new Date(),
      endDate,
      amount,
      currency: "USD",
    },
  });

  // Update user's plan
  const updatedUser = await db.user.update({
    where: { id: userId },
    data: { plan: planTier },
    select: { name: true, email: true },
  });

  console.log(
    `[stripe/webhook] ✅ Subscription activated: user=${userId}, plan=${planTier}, amount=$${amount}`,
  );

  // Send subscription activated email (best-effort)
  try {
    const { sendEmail, subscriptionActivatedEmail } = await import("@/lib/email");
    if (updatedUser.email) {
      // Calculate monthly amount from session
      const monthlyAmount = billing === "yearly"
        ? Math.round((amount / 12) * 100) / 100
        : amount;
      const planDisplayName = planTier.charAt(0) + planTier.slice(1).toLowerCase() + " Plan";
      const { subject, html } = subscriptionActivatedEmail(
        updatedUser.name || "there",
        planDisplayName,
        monthlyAmount,
      );
      await sendEmail({ to: updatedUser.email, subject, html });
    }
  } catch (emailErr) {
    console.error("[stripe/webhook] email failed:", emailErr);
  }
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
): Promise<void> {
  const userId = subscription.metadata?.userId;
  const planTier = subscription.metadata?.planTier as
    | "STARTER"
    | "PRO"
    | "ENTERPRISE"
    | undefined;

  if (!userId || !planTier) return;

  // Determine status
  let status = "active";
  if (subscription.status === "past_due") status = "past_due";
  else if (subscription.status === "canceled") status = "cancelled";
  else if (subscription.status === "unpaid") status = "past_due";

  // Update existing subscription record
  const existing = await db.subscription.findFirst({
    where: { userId, status: { in: ["active", "past_due"] } },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    await db.subscription.update({
      where: { id: existing.id },
      data: {
        plan: planTier,
        status,
        endDate: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : undefined,
      },
    });
  }

  // Update user plan
  if (subscription.status === "active") {
    await db.user.update({
      where: { id: userId },
      data: { plan: planTier },
    });
  }

  console.log(
    `[stripe/webhook] 🔄 Subscription updated: user=${userId}, plan=${planTier}, status=${status}`,
  );
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
): Promise<void> {
  const userId = subscription.metadata?.userId;
  if (!userId) return;

  // Mark subscription as cancelled
  await db.subscription.updateMany({
    where: { userId, status: { in: ["active", "past_due"] } },
    data: { status: "cancelled", endDate: new Date() },
  });

  // Downgrade user to FREE
  await db.user.update({
    where: { id: userId },
    data: { plan: "FREE" },
  });

  console.log(`[stripe/webhook] ❌ Subscription cancelled: user=${userId} → FREE`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.userId;

  if (!userId) return;

  // Mark subscription as past_due
  await db.subscription.updateMany({
    where: { userId, status: "active" },
    data: { status: "past_due" },
  });

  console.log(
    `[stripe/webhook] ⚠️ Payment failed: user=${userId}, invoice=${invoice.id}`,
  );
}
