"use client";

// Mianx.ai — Billing & Subscription Management View
//
// Comprehensive billing dashboard with 4 tabs:
//   - Overview: Current plan, usage meters, quick stats
//   - Plans: Available plans with checkout flow
//   - Entitlements: Feature entitlements table with search
//   - Invoices: Invoice history with pagination

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/lib/store";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CreditCard,
  Crown,
  Sparkles,
  Zap,
  HardDrive,
  Bot,
  Check,
  X,
  Download,
  Calendar,
  Clock,
  TrendingUp,
  DollarSign,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ArrowRight,
  Star,
  Shield,
  Receipt,
  BarChart3,
  Loader2,
  Building2,
} from "lucide-react";

// ─────────────────────────────────────────────
//  TypeScript Types
// ─────────────────────────────────────────────

interface Subscription {
  id: string;
  planName: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEnd: string | null;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  interval: string;
  features: string[];
}

interface UsageMetric {
  metric: string;
  used: number;
  limit: number;
  unit: string;
}

interface Entitlement {
  feature: string;
  status: string;
  limit: number;
  used: number;
}

interface Invoice {
  id: string;
  amount: number;
  status: string;
  date: string;
  description: string;
}

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────

const METRIC_ICONS: Record<string, React.ElementType> = {
  "AI Tokens": Sparkles,
  "API Calls": Zap,
  "Storage": HardDrive,
  Agents: Bot,
  "Team Members": TrendingUp,
  Projects: BarChart3,
};

const METRIC_COLORS: Record<string, string> = {
  "AI Tokens": "from-purple-500 to-violet-500",
  "API Calls": "from-cyan-500 to-blue-500",
  Storage: "from-amber-500 to-orange-500",
  Agents: "from-pink-500 to-rose-500",
  "Team Members": "from-emerald-500 to-green-500",
  Projects: "from-blue-500 to-indigo-500",
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-500/20 text-green-300 border-green-500/30",
  trial: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  past_due: "bg-red-500/20 text-red-300 border-red-500/30",
  canceled: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  paid: "bg-green-500/20 text-green-300 border-green-500/30",
  pending: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  failed: "bg-red-500/20 text-red-300 border-red-500/30",
  Active: "bg-green-500/20 text-green-300 border-green-500/30",
  Inactive: "bg-gray-500/20 text-gray-300 border-gray-500/30",
};

const INVOICES_PER_PAGE = 8;

// ─────────────────────────────────────────────
//  Stagger Animation
// ─────────────────────────────────────────────

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getUsageBarColor(percentage: number): string {
  if (percentage > 85) return "bg-red-500";
  if (percentage > 60) return "bg-amber-500";
  return "bg-green-500";
}

function getUsageTextColor(percentage: number): string {
  if (percentage > 85) return "text-red-400";
  if (percentage > 60) return "text-amber-400";
  return "text-green-400";
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

// ─────────────────────────────────────────────
//  Loading Skeleton: Overview Tab
// ─────────────────────────────────────────────

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      {/* Current Plan Card Skeleton */}
      <Card className="glass border-purple-500/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-5 w-16 mb-1" />
            <Skeleton className="h-6 w-20 rounded-full ml-2" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Usage Meters Skeleton */}
      <Card className="glass border-purple-500/10">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Quick Stats Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="glass border-purple-500/10">
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Loading Skeleton: Plans Tab
// ─────────────────────────────────────────────

function PlansSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="glass border-purple-500/10">
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="glass border-purple-500/10">
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-6 w-28" />
              <div className="flex items-end gap-1">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-4 w-16 mb-1" />
              </div>
              <div className="space-y-2 pt-2">
                {[1, 2, 3, 4, 5].map((j) => (
                  <div key={j} className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-10 w-full rounded-lg" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Loading Skeleton: Entitlements Tab
// ─────────────────────────────────────────────

function EntitlementsSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="glass border-purple-500/10">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <Skeleton className="h-10 flex-1 max-w-sm" />
            <Skeleton className="h-10 w-40" />
          </div>
          <div className="rounded-lg border border-purple-500/10 overflow-hidden">
            <div className="bg-purple-500/5 px-4 py-3 flex gap-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-32" />
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-4 py-3 flex gap-4 border-t border-purple-500/10">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-2 flex-1 self-center" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Loading Skeleton: Invoices Tab
// ─────────────────────────────────────────────

function InvoicesSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="glass border-purple-500/10">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-purple-500/10 overflow-hidden">
            <div className="bg-purple-500/5 px-4 py-3 flex gap-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-4 py-3 flex gap-4 border-t border-purple-500/10">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-8 w-20 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────

export function BillingView() {
  const { activeOrgId, navigate } = useApp();

  // --- Data State ---
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [usage, setUsage] = useState<UsageMetric[]>([]);
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // --- UI State ---
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [invoicePage, setInvoicePage] = useState(1);
  const [entitlementSearch, setEntitlementSearch] = useState("");

  // --- Data Fetching ---
  const fetchAllData = useCallback(async () => {
    if (!activeOrgId) return;

    setLoading(true);
    setError(null);

    const baseUrl = `/api/organizations/${activeOrgId}/billing`;

    try {
      const endpoints = [
        `${baseUrl}/subscription`,
        `${baseUrl}/plans`,
        `${baseUrl}/usage`,
        `${baseUrl}/entitlements`,
        `${baseUrl}/invoices`,
      ];

      const results = await Promise.allSettled(
        endpoints.map((url) => fetch(url).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        }))
      );

      // Check for failures
      const failedIndices = results
        .map((r, i) => (r.status === "rejected" ? i : -1))
        .filter((i) => i !== -1);

      if (failedIndices.length === endpoints.length) {
        throw new Error("Failed to load billing data. Please try again.");
      }

      // Process successful results
      const [subRes, plansRes, usageRes, entRes, invRes] = results;

      if (subRes.status === "fulfilled" && subRes.value?.subscription) {
        setSubscription(subRes.value.subscription);
      }

      if (plansRes.status === "fulfilled" && plansRes.value?.plans) {
        setPlans(plansRes.value.plans);
      }

      if (usageRes.status === "fulfilled" && usageRes.value?.usage) {
        setUsage(usageRes.value.usage);
      }

      if (entRes.status === "fulfilled" && entRes.value?.entitlements) {
        setEntitlements(entRes.value.entitlements);
      }

      if (invRes.status === "fulfilled" && invRes.value?.invoices) {
        setInvoices(invRes.value.invoices);
      }

      // If some endpoints failed, show a warning but don't block the view
      if (failedIndices.length > 0 && failedIndices.length < endpoints.length) {
        setError("Some billing data could not be loaded. Showing available data.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, [activeOrgId]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Reset invoice page when data changes
  useEffect(() => {
    setInvoicePage(1);
  }, [invoices]);

  // --- Checkout Handler ---
  const handleCheckout = async (planId: string) => {
    if (!activeOrgId) return;

    setCheckoutLoading(planId);
    try {
      const res = await fetch(`/api/organizations/${activeOrgId}/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      if (!res.ok) throw new Error("Checkout failed");

      const data = await res.json();
      if (data.url) {
        window.location.assign(data.url);
      }
    } catch {
      // Could show a toast here in a production app
    } finally {
      setCheckoutLoading(null);
    }
  };

  // --- Computed Values ---
  const filteredEntitlements = useMemo(() => {
    if (!entitlementSearch.trim()) return entitlements;
    const q = entitlementSearch.toLowerCase();
    return entitlements.filter((e) =>
      e.feature.toLowerCase().includes(q)
    );
  }, [entitlements, entitlementSearch]);

  const totalInvoicesPages = Math.max(1, Math.ceil(invoices.length / INVOICES_PER_PAGE));
  const paginatedInvoices = invoices.slice(
    (invoicePage - 1) * INVOICES_PER_PAGE,
    invoicePage * INVOICES_PER_PAGE
  );

  const totalSpend = useMemo(() => {
    return invoices
      .filter((inv) => inv.status === "paid")
      .reduce((sum, inv) => sum + inv.amount, 0);
  }, [invoices]);

  const currentPlan = useMemo(() => {
    if (!subscription) return null;
    return plans.find((p) => p.name === subscription.planName);
  }, [subscription, plans]);

  const subscriptionStatus = subscription?.status?.toLowerCase() || "";

  // ─────────────────────────────────────────────
  //  Org Guard
  // ─────────────────────────────────────────────

  if (!activeOrgId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            <span className="gradient-text">Billing</span> & Subscription
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select an organization to manage billing.
          </p>
        </div>
        <Card className="glass border-purple-500/10 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 mx-auto mb-4">
            <Building2 className="h-8 w-8 text-purple-400" />
          </div>
          <h3 className="font-bold text-lg mb-2">Select an Organization</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
            Select an organization to manage billing
          </p>
          <Button
            onClick={() => navigate("organizations")}
            className="btn-gradient text-white"
          >
            <Building2 className="mr-2 h-4 w-4" />
            Go to Organizations
          </Button>
        </Card>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  //  Loading State
  // ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-80 mt-2" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <Skeleton className="h-10 w-96" />
        <OverviewSkeleton />
      </div>
    );
  }

  // ─────────────────────────────────────────────
  //  Main Render
  // ─────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            <span className="gradient-text">Billing</span> & Subscription
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your organization&apos;s subscription, usage, and payment history.
          </p>
        </div>
        <Button
          variant="outline"
          className="border-purple-500/20 hover:bg-purple-500/10"
          onClick={() => fetchAllData()}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass border-red-500/20 bg-red-500/5">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-300 truncate">{error}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-red-500/30 hover:bg-red-500/10 text-red-300 flex-shrink-0"
                onClick={() => fetchAllData()}
              >
                <RefreshCw className="mr-1 h-3 w-3" />
                Retry
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Tabs ── */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="glass border-purple-500/10 bg-purple-500/5">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-purple-500/15 data-[state=active]:text-purple-300"
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="plans"
            className="data-[state=active]:bg-purple-500/15 data-[state=active]:text-purple-300"
          >
            <Star className="mr-2 h-4 w-4" />
            Plans
          </TabsTrigger>
          <TabsTrigger
            value="entitlements"
            className="data-[state=active]:bg-purple-500/15 data-[state=active]:text-purple-300"
          >
            <Shield className="mr-2 h-4 w-4" />
            Entitlements
          </TabsTrigger>
          <TabsTrigger
            value="invoices"
            className="data-[state=active]:bg-purple-500/15 data-[state=active]:text-purple-300"
          >
            <Receipt className="mr-2 h-4 w-4" />
            Invoices
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════
            Tab 1: Overview
        ══════════════════════════════════════ */}
        <TabsContent value="overview">
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-6"
          >
            {/* Current Plan Card */}
            <motion.div variants={item}>
              <Card className="glass border-purple-500/10">
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500">
                          <Crown className="h-4 w-4 text-white" />
                        </div>
                        Current Plan
                      </CardTitle>
                      {subscription && (
                        <CardDescription className="mt-1">
                          {subscription.currentPeriodEnd
                            ? `Next billing: ${formatDate(subscription.currentPeriodEnd)}`
                            : "No billing period"}
                        </CardDescription>
                      )}
                    </div>
                    {subscription && (
                      <Badge
                        className={
                          STATUS_STYLES[subscriptionStatus] ||
                          STATUS_STYLES[subscription.status] ||
                          "bg-gray-500/20 text-gray-300 border-gray-500/30"
                        }
                      >
                        <Check className="mr-1 h-3 w-3" />
                        {subscription.status}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {subscription && currentPlan ? (
                    <>
                      <div className="flex items-end gap-2 mb-2">
                        <span className="text-4xl font-bold">{formatCurrency(currentPlan.price)}</span>
                        <span className="text-muted-foreground mb-1">
                          /{currentPlan.interval}
                        </span>
                        <Badge
                          variant="outline"
                          className="ml-2 border-purple-500/20 text-purple-300"
                        >
                          {currentPlan.name}
                        </Badge>
                      </div>

                      {subscription.trialEnd && new Date(subscription.trialEnd) > new Date() && (
                        <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <Clock className="h-4 w-4 text-amber-400" />
                          <span className="text-sm text-amber-300">
                            Trial ends {formatDate(subscription.trialEnd)}
                          </span>
                        </div>
                      )}

                      {/* Renewal Info */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>
                          Period: {formatDate(subscription.currentPeriodStart)} — {" "}
                          {formatDate(subscription.currentPeriodEnd)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center py-6 text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/10 to-cyan-500/10 mb-4">
                        <CreditCard className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="font-semibold text-lg mb-1">No Active Plan</h3>
                      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                        Your organization doesn&apos;t have an active subscription. Choose a plan to get started.
                      </p>
                      <Button
                        className="btn-gradient text-white"
                        onClick={() =>
                          document.querySelector('[data-state="active"][value="plans"]') ||
                          document.querySelector('[value="plans"]')
                        }
                      >
                        <Star className="mr-2 h-4 w-4" />
                        Choose a Plan
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Usage Meters */}
            <motion.div variants={item}>
              <Card className="glass border-purple-500/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-violet-500">
                      <Zap className="h-4 w-4 text-white" />
                    </div>
                    Usage This Period
                  </CardTitle>
                  <CardDescription>
                    {subscription
                      ? `${formatDate(subscription.currentPeriodStart)} — ${formatDate(subscription.currentPeriodEnd)}`
                      : "Resource consumption across your organization"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {usage.length > 0 ? (
                    <div className="space-y-5">
                      {usage.map((metric) => {
                        const IconComp =
                          METRIC_ICONS[metric.metric] || Sparkles;
                        const colorClass =
                          METRIC_COLORS[metric.metric] ||
                          "from-purple-500 to-cyan-500";
                        const percentage =
                          metric.limit > 0
                            ? Math.round((metric.used / metric.limit) * 100)
                            : 0;

                        return (
                          <div key={metric.metric} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${colorClass}`}
                                >
                                  <IconComp className="h-4 w-4 text-white" />
                                </div>
                                <span className="text-sm font-medium">
                                  {metric.metric}
                                </span>
                              </div>
                              <span
                                className={`text-sm font-medium ${getUsageTextColor(percentage)}`}
                              >
                                {formatNumber(metric.used)} /{" "}
                                {formatNumber(metric.limit)} {metric.unit}
                              </span>
                            </div>
                            <div className="relative">
                              <div className="w-full h-2 rounded-full bg-purple-500/10 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${getUsageBarColor(percentage)}`}
                                  style={{ width: `${Math.min(percentage, 100)}%` }}
                                />
                              </div>
                            </div>
                            <div className="flex justify-between">
                              <span
                                className={`text-[10px] ${getUsageTextColor(percentage)}`}
                              >
                                {percentage}% used
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {formatNumber(Math.max(0, metric.limit - metric.used))}{" "}
                                {metric.unit} remaining
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No usage data available for this period.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Quick Stats Row */}
            <motion.div
              variants={item}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            >
              {/* This Period */}
              <Card className="glass border-purple-500/10 card-hover">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-cyan-500 to-blue-500">
                      <Calendar className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      This Period
                    </span>
                  </div>
                  <p className="text-2xl font-bold">
                    {subscription
                      ? formatDate(subscription.currentPeriodStart)
                      : "N/A"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Period start date
                  </p>
                </CardContent>
              </Card>

              {/* Next Billing */}
              <Card className="glass border-purple-500/10 card-hover">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-purple-500 to-violet-500">
                      <Clock className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Next Billing
                    </span>
                  </div>
                  <p className="text-2xl font-bold">
                    {subscription?.currentPeriodEnd
                      ? formatDate(subscription.currentPeriodEnd)
                      : "N/A"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {subscription?.currentPeriodEnd
                      ? (() => {
                          const days = Math.max(
                            0,
                            Math.ceil(
                              (new Date(subscription.currentPeriodEnd).getTime() -
                                Date.now()) /
                                (1000 * 60 * 60 * 24)
                            )
                          );
                          return `${days} day${days !== 1 ? "s" : ""} remaining`;
                        })()
                      : "No active subscription"}
                  </p>
                </CardContent>
              </Card>

              {/* Total Spend */}
              <Card className="glass border-purple-500/10 card-hover">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-pink-500 to-rose-500">
                      <DollarSign className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Total Spend
                    </span>
                  </div>
                  <p className="text-2xl font-bold">
                    {formatCurrency(totalSpend)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Across {invoices.filter((i) => i.status === "paid").length} paid invoice(s)
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </TabsContent>

        {/* ══════════════════════════════════════
            Tab 2: Plans
        ══════════════════════════════════════ */}
        <TabsContent value="plans">
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-6"
          >
            <motion.div variants={item}>
              <Card className="glass border-purple-500/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500">
                      <Star className="h-4 w-4 text-white" />
                    </div>
                    Available Plans
                  </CardTitle>
                  <CardDescription>
                    Choose the plan that best fits your organization&apos;s needs. Upgrade or downgrade at any time.
                  </CardDescription>
                </CardHeader>
              </Card>
            </motion.div>

            {plans.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {plans.map((plan, index) => {
                  const isCurrentPlan =
                    subscription?.planName === plan.name;
                  // Highlight the next tier above current as "recommended"
                  const currentPlanIndex = plans.findIndex(
                    (p) => p.name === subscription?.planName
                  );
                  const isRecommended =
                    !isCurrentPlan && index === currentPlanIndex + 1;

                  return (
                    <motion.div
                      key={plan.id}
                      variants={item}
                      className={
                        isRecommended
                          ? "relative"
                          : undefined
                      }
                    >
                      {/* Recommended glow border */}
                      {isRecommended && (
                        <div className="absolute -inset-px rounded-xl bg-gradient-to-br from-purple-500 via-cyan-500 to-pink-500 opacity-60 blur-sm" />
                      )}

                      <Card
                        className={
                          `relative glass border-purple-500/10 card-hover ${
                            isCurrentPlan
                              ? "border-purple-500/30 bg-purple-500/5"
                              : isRecommended
                                ? "border-purple-500/20"
                                : ""
                          }`
                        }
                      >
                        <CardContent className="p-6">
                          {/* Plan Header */}
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold">{plan.name}</h3>
                            {isCurrentPlan && (
                              <Badge className="bg-gradient-to-r from-purple-500 to-cyan-500 text-white border-0">
                                Current Plan
                              </Badge>
                            )}
                            {isRecommended && (
                              <Badge className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-0">
                                Recommended
                              </Badge>
                            )}
                          </div>

                          {/* Price */}
                          <div className="flex items-end gap-1 mb-1">
                            <span className="text-3xl font-bold">
                              {formatCurrency(plan.price)}
                            </span>
                            <span className="text-sm text-muted-foreground mb-1">
                              /{plan.interval}
                            </span>
                          </div>

                          {/* Features */}
                          <div className="space-y-2.5 mt-5 mb-6">
                            {plan.features.map((feature) => (
                              <div
                                key={feature}
                                className="flex items-start gap-2"
                              >
                                <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                                <span className="text-sm text-muted-foreground">
                                  {feature}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* CTA Button */}
                          {isCurrentPlan ? (
                            <Button
                              variant="outline"
                              className="w-full border-purple-500/20 text-purple-300"
                              disabled
                            >
                              <Check className="mr-2 h-4 w-4" />
                              Current Plan
                            </Button>
                          ) : (
                            <Button
                              className={`w-full ${
                                isRecommended
                                  ? "btn-gradient text-white"
                                  : "border-purple-500/20 hover:bg-purple-500/10"
                              }`}
                              variant={isRecommended ? "default" : "outline"}
                              onClick={() => handleCheckout(plan.id)}
                              disabled={checkoutLoading === plan.id}
                            >
                              {checkoutLoading === plan.id ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Processing...
                                </>
                              ) : (
                                <>
                                  {plan.price > (currentPlan?.price || 0) ? (
                                    <>
                                      <ArrowRight className="mr-2 h-4 w-4" />
                                      Upgrade
                                    </>
                                  ) : (
                                    <>
                                      <ArrowRight className="mr-2 h-4 w-4 rotate-90" />
                                      Downgrade
                                    </>
                                  )}
                                </>
                              )}
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <Card className="glass border-purple-500/10 p-8 text-center">
                <Star className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-bold text-lg mb-2">No Plans Available</h3>
                <p className="text-sm text-muted-foreground">
                  No subscription plans are currently available. Please contact support.
                </p>
              </Card>
            )}
          </motion.div>
        </TabsContent>

        {/* ══════════════════════════════════════
            Tab 3: Entitlements
        ══════════════════════════════════════ */}
        <TabsContent value="entitlements">
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-6"
          >
            <motion.div variants={item}>
              <Card className="glass border-purple-500/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-green-500">
                      <Shield className="h-4 w-4 text-white" />
                    </div>
                    Entitlements
                  </CardTitle>
                  <CardDescription>
                    Resource limits and feature access included in your current plan.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Search / Filter */}
                  <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search entitlements..."
                        value={entitlementSearch}
                        onChange={(e) =>
                          setEntitlementSearch(e.target.value)
                        }
                        className="pl-9 bg-purple-500/5 border-purple-500/10 focus:border-purple-500/30"
                      />
                    </div>
                  </div>

                  {filteredEntitlements.length > 0 ? (
                    <div className="rounded-lg border border-purple-500/10 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-purple-500/10 hover:bg-transparent bg-purple-500/5">
                            <TableHead>Feature</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Usage</TableHead>
                            <TableHead className="w-48">
                              Progress
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredEntitlements.map((ent) => {
                            const pct =
                              ent.limit > 0
                                ? Math.round((ent.used / ent.limit) * 100)
                                : 0;
                            const isActive =
                              ent.status?.toLowerCase() === "active";

                            return (
                              <TableRow
                                key={ent.feature}
                                className="border-purple-500/10 hover:bg-purple-500/5"
                              >
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-purple-500/20 to-cyan-500/20">
                                      <Shield className="h-3.5 w-3.5 text-purple-400" />
                                    </div>
                                    {ent.feature}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className={
                                      isActive
                                        ? STATUS_STYLES["active"] ||
                                          STATUS_STYLES["Active"]
                                        : STATUS_STYLES["canceled"] ||
                                          STATUS_STYLES["Inactive"]
                                    }
                                  >
                                    {isActive ? (
                                      <Check className="mr-1 h-3 w-3" />
                                    ) : (
                                      <X className="mr-1 h-3 w-3" />
                                    )}
                                    {isActive ? "Active" : "Inactive"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">
                                  <span
                                    className={
                                      pct > 85
                                        ? "text-red-400"
                                        : pct > 60
                                          ? "text-amber-400"
                                          : "text-muted-foreground"
                                    }
                                  >
                                    {ent.used} / {ent.limit}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                      <div className="w-full h-1.5 rounded-full bg-purple-500/10 overflow-hidden">
                                        <div
                                          className={`h-full rounded-full transition-all duration-500 ${getUsageBarColor(pct)}`}
                                          style={{
                                            width: `${Math.min(pct, 100)}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground w-8 text-right">
                                      {pct}%
                                    </span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Shield className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {entitlementSearch
                          ? "No entitlements match your search."
                          : "No entitlement data available."}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </TabsContent>

        {/* ══════════════════════════════════════
            Tab 4: Invoices
        ══════════════════════════════════════ */}
        <TabsContent value="invoices">
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-6"
          >
            <motion.div variants={item}>
              <Card className="glass border-purple-500/10">
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-rose-500">
                          <Receipt className="h-4 w-4 text-white" />
                        </div>
                        Invoice History
                      </CardTitle>
                      <CardDescription>
                        Download past invoices for your records.
                      </CardDescription>
                    </div>
                    {invoices.length > 0 && (
                      <Badge variant="outline" className="border-purple-500/20 text-purple-300">
                        {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {invoices.length > 0 ? (
                    <>
                      <div className="rounded-lg border border-purple-500/10 overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-purple-500/10 hover:bg-transparent bg-purple-500/5">
                              <TableHead>Date</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">
                                Action
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedInvoices.map((invoice) => {
                              const invStatus =
                                invoice.status?.toLowerCase() || "";

                              return (
                                <TableRow
                                  key={invoice.id}
                                  className="border-purple-500/10 hover:bg-purple-500/5"
                                >
                                  <TableCell className="text-sm text-muted-foreground">
                                    {formatDate(invoice.date)}
                                  </TableCell>
                                  <TableCell className="text-sm font-medium">
                                    {invoice.description}
                                  </TableCell>
                                  <TableCell className="text-sm font-medium">
                                    {formatCurrency(invoice.amount)}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      className={
                                        STATUS_STYLES[invStatus] ||
                                        STATUS_STYLES[invoice.status] ||
                                        "bg-gray-500/20 text-gray-300 border-gray-500/30"
                                      }
                                    >
                                      {invoice.status === "paid" && (
                                        <Check className="mr-1 h-3 w-3" />
                                      )}
                                      {invoice.status === "failed" && (
                                        <X className="mr-1 h-3 w-3" />
                                      )}
                                      {invoice.status === "pending" && (
                                        <Clock className="mr-1 h-3 w-3" />
                                      )}
                                      {invoice.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-xs text-purple-400 hover:text-purple-300"
                                    >
                                      <Download className="mr-1 h-3 w-3" />
                                      PDF
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Pagination */}
                      {totalInvoicesPages > 1 && (
                        <div className="flex items-center justify-between mt-4">
                          <p className="text-xs text-muted-foreground">
                            Page {invoicePage} of {totalInvoicesPages}
                          </p>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-purple-500/20 hover:bg-purple-500/10"
                              disabled={invoicePage <= 1}
                              onClick={() =>
                                setInvoicePage((p) => Math.max(1, p - 1))
                              }
                            >
                              <ChevronLeft className="h-4 w-4" />
                              Previous
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-purple-500/20 hover:bg-purple-500/10"
                              disabled={invoicePage >= totalInvoicesPages}
                              onClick={() =>
                                setInvoicePage((p) =>
                                  Math.min(totalInvoicesPages, p + 1)
                                )
                              }
                            >
                              Next
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 mx-auto mb-4">
                        <Receipt className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="font-bold text-lg mb-2">
                        No Invoices Yet
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                        Invoices will appear here once your subscription is active and billing begins.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
