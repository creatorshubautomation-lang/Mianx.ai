// Mianx.ai — Stripe Configuration
// Pricing plans, currency, and helper functions

import Stripe from "stripe";

// ─────────────────────────────────────────────
//  Plan definitions (sync with Prisma PlanTier enum)
// ─────────────────────────────────────────────

export interface PlanDefinition {
  id: string;
  name: string;
  tier: "FREE" | "STARTER" | "PRO" | "ENTERPRISE";
  priceMonthly: number; // USD
  priceYearly: number; // USD (per month, billed yearly)
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
  description: string;
  features: string[];
  popular?: boolean;
  agentLimit: number;
  projectLimit: number; // -1 = unlimited
  messageLimitPerDay: number; // -1 = unlimited
}

export const PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    tier: "FREE",
    priceMonthly: 0,
    priceYearly: 0,
    description: "Perfect for trying out Mianx.ai",
    features: [
      "1 active project",
      "3 agent team members",
      "Community support",
      "Basic deliverables",
      "5 chat messages / day",
    ],
    agentLimit: 3,
    projectLimit: 1,
    messageLimitPerDay: 5,
  },
  {
    id: "starter",
    name: "Starter",
    tier: "STARTER",
    priceMonthly: 49,
    priceYearly: 39,
    description: "For small projects & solo founders",
    features: [
      "5 active projects",
      "8 agent team members",
      "Priority chat (50/day)",
      "All deliverable types",
      "Email support",
      "Project analytics",
    ],
    popular: false,
    agentLimit: 8,
    projectLimit: 5,
    messageLimitPerDay: 50,
  },
  {
    id: "pro",
    name: "Pro",
    tier: "PRO",
    priceMonthly: 199,
    priceYearly: 159,
    description: "For growing teams & startups",
    features: [
      "Unlimited projects",
      "All 24 agents",
      "Unlimited chat",
      "Real-time agent dashboard",
      "Priority support",
      "Custom agent training",
      "Team collaboration (5 seats)",
      "API access",
    ],
    popular: true,
    agentLimit: 24,
    projectLimit: -1,
    messageLimitPerDay: -1,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tier: "ENTERPRISE",
    priceMonthly: 499,
    priceYearly: 399,
    description: "For large teams & complex projects",
    features: [
      "Everything in Pro",
      "Dedicated agent instances",
      "SSO & SAML",
      "Custom agent development",
      "SLA 99.99%",
      "Dedicated success manager",
      "Unlimited team seats",
      "On-premise option",
    ],
    agentLimit: 24,
    projectLimit: -1,
    messageLimitPerDay: -1,
  },
];

export function getPlanByTier(tier: string): PlanDefinition | undefined {
  return PLANS.find((p) => p.tier === tier);
}

export function getPlanById(id: string): PlanDefinition | undefined {
  return PLANS.find((p) => p.id === id);
}

// ─────────────────────────────────────────────
//  Stripe client (singleton)
// ─────────────────────────────────────────────

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error(
        "STRIPE_SECRET_KEY is not set. Add it in Vercel environment variables.",
      );
    }
    stripeInstance = new Stripe(secretKey, {
      apiVersion: "2025-08-27.basil" as Stripe.LatestApiVersion,
    });
  }
  return stripeInstance;
}

// ─────────────────────────────────────────────
//  Helper: create checkout session
// ─────────────────────────────────────────────

export interface CheckoutOptions {
  planId: string;
  billing: "monthly" | "yearly";
  userId: string;
  userEmail: string;
  userName?: string;
  successUrl: string;
  cancelUrl: string;
}

export async function createCheckoutSession(
  opts: CheckoutOptions,
): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();
  const plan = getPlanById(opts.planId);

  if (!plan) {
    throw new Error(`Plan "${opts.planId}" not found`);
  }

  if (plan.priceMonthly === 0) {
    throw new Error("Free plan doesn't require checkout");
  }

  // For now, use price_data (inline pricing) since we don't have
  // pre-created Stripe Products/Prices. In production, you'd create
  // products in Stripe dashboard and use their price IDs.
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: opts.userEmail,
    client_reference_id: opts.userId,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Mianx.ai ${plan.name} Plan`,
            description: plan.description,
            metadata: {
              plan_id: plan.id,
              plan_tier: plan.tier,
            },
          },
          unit_amount: (opts.billing === "yearly"
            ? plan.priceYearly
            : plan.priceMonthly) * 100, // Stripe uses cents
          recurring: {
            interval: opts.billing === "yearly" ? "year" : "month",
          },
        },
        quantity: 1,
      },
    ],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    metadata: {
      userId: opts.userId,
      userEmail: opts.userEmail,
      userName: opts.userName || "",
      planId: plan.id,
      planTier: plan.tier,
      billing: opts.billing,
    },
    subscription_data: {
      metadata: {
        userId: opts.userId,
        planId: plan.id,
        planTier: plan.tier,
        billing: opts.billing,
      },
    },
  });

  return {
    url: session.url || "",
    sessionId: session.id,
  };
}

// ─────────────────────────────────────────────
//  Helper: create billing portal session
//  (lets users manage their subscription)
// ─────────────────────────────────────────────

export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<string> {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}

// ─────────────────────────────────────────────
//  Helper: get customer by email
// ─────────────────────────────────────────────

export async function findCustomerByEmail(
  email: string,
): Promise<Stripe.Customer | null> {
  const stripe = getStripe();
  const customers = await stripe.customers.list({
    email,
    limit: 1,
  });
  return customers.data[0] || null;
}
