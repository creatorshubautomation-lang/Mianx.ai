"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useApp, useT } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Zap, Crown, Building2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export function PricingView() {
  const t = useT();
  const { setAuthModal, navigate } = useApp();
  const { data: session } = useSession();
  const [yearly, setYearly] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const plans = [
    {
      id: "free",
      name: t("pricing.free"),
      desc: t("pricing.free.desc"),
      price: { monthly: 0, yearly: 0 },
      icon: Sparkles,
      color: "from-gray-500 to-gray-600",
      features: [
        "1 active project",
        "3 agent team members",
        "Community support",
        "Basic deliverables",
        "5 chat messages / day",
      ],
      cta: t("pricing.cta"),
      popular: false,
    },
    {
      id: "starter",
      name: t("pricing.starter"),
      desc: t("pricing.starter.desc"),
      price: { monthly: 49, yearly: 39 },
      icon: Zap,
      color: "from-purple-500 to-violet-500",
      features: [
        "5 active projects",
        "8 agent team members",
        "Priority chat (50/day)",
        "All deliverable types",
        "Email support",
        "Project analytics",
      ],
      cta: t("pricing.cta"),
      popular: false,
    },
    {
      id: "pro",
      name: t("pricing.pro"),
      desc: t("pricing.pro.desc"),
      price: { monthly: 199, yearly: 159 },
      icon: Crown,
      color: "from-pink-500 to-rose-500",
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
      cta: t("pricing.cta"),
      popular: true,
    },
    {
      id: "enterprise",
      name: t("pricing.enterprise"),
      desc: t("pricing.enterprise.desc"),
      price: { monthly: 499, yearly: 399 },
      icon: Building2,
      color: "from-cyan-500 to-blue-500",
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
      cta: t("pricing.contactUs"),
      popular: false,
    },
  ];

  const handleSelect = async (plan: typeof plans[0]) => {
    // Free plan — just prompt signup
    if (plan.id === "free") {
      if (!session?.user) {
        setAuthModal("signup");
      } else {
        navigate("dashboard");
        toast.success("You're on the Free plan!");
      }
      return;
    }

    // Enterprise — contact sales
    if (plan.id === "enterprise") {
      toast.info("Contact us at hello@mianx.ai for Enterprise pricing");
      navigate("contact");
      return;
    }

    // Paid plans (Starter, Pro) — require login first
    if (!session?.user) {
      toast.info("Please sign up first, then choose a plan");
      setAuthModal("signup");
      return;
    }

    // Create Stripe checkout session
    setLoadingPlan(plan.id);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          billing: yearly ? "yearly" : "monthly",
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to start checkout");
        return;
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        toast.success(`Redirecting to Stripe for ${plan.name} plan...`);
        window.location.href = data.url;
      }
    } catch (e) {
      toast.error("Network error — please try again");
      console.error(e);
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="relative min-h-screen pt-24 pb-20">
      <div className="fixed inset-0 mesh-bg-soft -z-10" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold">
            {t("pricing.title")}
          </h1>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            {t("pricing.subtitle")}
          </p>

          {/* Monthly/Yearly toggle */}
          <div className="inline-flex items-center gap-2 mt-6 glass rounded-full p-1">
            <button
              onClick={() => setYearly(false)}
              className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
                !yearly ? "bg-purple-500 text-white" : "text-muted-foreground"
              }`}
            >
              {t("pricing.monthly")}
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all flex items-center gap-2 ${
                yearly ? "bg-purple-500 text-white" : "text-muted-foreground"
              }`}
            >
              {t("pricing.yearly")}
              <Badge className="bg-green-500/20 text-green-300 text-xs">
                {t("pricing.save")}
              </Badge>
            </button>
          </div>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="relative"
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <Badge className="bg-gradient-to-r from-purple-500 to-cyan-500 text-white">
                    {t("pricing.popular")}
                  </Badge>
                </div>
              )}
              <Card
                className={`glass p-6 h-full flex flex-col card-hover ${
                  plan.popular
                    ? "border-purple-500/40 glow"
                    : "border-purple-500/10"
                }`}
              >
                <div
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br ${plan.color} mb-4`}
                >
                  <plan.icon className="h-5 w-5 text-white" />
                </div>

                <h3 className="text-lg font-bold">{plan.name}</h3>
                <p className="text-xs text-muted-foreground mt-1 mb-4 min-h-[2.5rem]">
                  {plan.desc}
                </p>

                <div className="mb-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">
                      ${yearly ? plan.price.yearly : plan.price.monthly}
                    </span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>
                  {yearly && plan.price.yearly > 0 && (
                    <p className="text-xs text-green-400 mt-1">
                      Billed annually (${plan.price.yearly * 12}/yr)
                    </p>
                  )}
                </div>

                <Button
                  onClick={() => handleSelect(plan)}
                  disabled={loadingPlan === plan.id}
                  className={`w-full mb-4 ${
                    plan.popular
                      ? "btn-gradient text-white"
                      : "glass"
                  }`}
                  variant={plan.popular ? "default" : "outline"}
                >
                  {loadingPlan === plan.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Redirecting...
                    </>
                  ) : (
                    plan.cta
                  )}
                </Button>

                <ul className="space-y-2 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* FAQ-style note */}
        <Card className="glass-strong border-purple-500/20 p-8 mt-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-semibold mb-1">No credit card required</h3>
              <p className="text-sm text-muted-foreground">
                Start on the Free plan. Upgrade when you need more agents or projects.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">Cancel anytime</h3>
              <p className="text-sm text-muted-foreground">
                No long-term contracts. Cancel with one click — no questions asked.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">Real agents, real work</h3>
              <p className="text-sm text-muted-foreground">
                Every plan delivers actual AI-generated code, content, and designs. No templates, no fluff.
              </p>
            </div>
          </div>
        </Card>

        <div className="text-center mt-8">
          <Button
            variant="link"
            onClick={() => navigate("contact")}
            className="text-purple-300"
          >
            Have questions? Talk to our team →
          </Button>
        </div>
      </div>
    </div>
  );
}
