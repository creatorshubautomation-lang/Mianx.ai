"use client";

import { useApp } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Calendar,
  Clock,
  HardDrive,
  Sparkles,
  Crown,
  Check,
  Info,
  CreditCardIcon,
  Receipt,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import { motion } from "framer-motion";

// Placeholder data for billing (API routes not yet built for billing V2)
const CURRENT_PLAN = {
  name: "Pro",
  price: "$49",
  period: "/month",
  status: "active",
  nextBilling: "Jan 15, 2025",
  features: [
    "Up to 10 AI agents",
    "50,000 AI tokens/month",
    "100,000 API calls/month",
    "10 GB storage",
    "Priority support",
    "Custom domains",
  ],
};

const USAGE_METRICS = [
  {
    label: "AI Tokens",
    used: 32450,
    limit: 50000,
    icon: Sparkles,
    color: "from-purple-500 to-violet-500",
    unit: "tokens",
  },
  {
    label: "API Calls",
    used: 78230,
    limit: 100000,
    icon: Zap,
    color: "from-cyan-500 to-blue-500",
    unit: "calls",
  },
  {
    label: "Storage",
    used: 6.8,
    limit: 10,
    icon: HardDrive,
    color: "from-amber-500 to-orange-500",
    unit: "GB",
  },
];

const ENTITLEMENTS = [
  { name: "AI Agents", limit: 10, used: 6, icon: Sparkles },
  { name: "Domains", limit: 5, used: 3, icon: Crown },
  { name: "Team Members", limit: 25, used: 12, icon: TrendingUp },
  { name: "Projects", limit: 50, used: 18, icon: BarChart3 },
  { name: "API Integrations", limit: 10, used: 4, icon: Zap },
  { name: "Custom Workflows", limit: 20, used: 7, icon: Clock },
];

const INVOICES = [
  {
    id: "INV-2024-012",
    date: "Dec 15, 2024",
    amount: "$49.00",
    status: "paid",
    description: "Pro Plan - Monthly",
  },
  {
    id: "INV-2024-011",
    date: "Nov 15, 2024",
    amount: "$49.00",
    status: "paid",
    description: "Pro Plan - Monthly",
  },
  {
    id: "INV-2024-010",
    date: "Oct 15, 2024",
    amount: "$49.00",
    status: "paid",
    description: "Pro Plan - Monthly",
  },
  {
    id: "INV-2024-009",
    date: "Sep 15, 2024",
    amount: "$49.00",
    status: "paid",
    description: "Pro Plan - Monthly",
  },
  {
    id: "INV-2024-008",
    date: "Aug 15, 2024",
    amount: "$29.00",
    status: "paid",
    description: "Starter Plan - Monthly",
  },
];

const PLANS = [
  {
    name: "Starter",
    price: "$29",
    period: "/month",
    description: "For small projects & solo founders",
    cta: "Downgrade",
    ctaVariant: "outline" as const,
    popular: false,
  },
  {
    name: "Pro",
    price: "$49",
    period: "/month",
    description: "For growing teams & startups",
    cta: "Current Plan",
    ctaVariant: "default" as const,
    popular: true,
  },
  {
    name: "Enterprise",
    price: "$199",
    period: "/month",
    description: "For large teams & complex projects",
    cta: "Upgrade",
    ctaVariant: "outline" as const,
    popular: false,
  },
];

export function BillingView() {
  const { activeOrgId } = useApp();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            <span className="gradient-text">Billing</span> & Subscription
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activeOrgId
              ? "Manage your organization's subscription, usage, and payment methods."
              : "Select an organization to manage billing."}
          </p>
        </div>
        <Button variant="outline" className="border-purple-500/20 hover:bg-purple-500/10">
          <CreditCard className="mr-2 h-4 w-4" />
          Manage Payment
        </Button>
      </div>

      {!activeOrgId ? (
        <Card className="glass border-purple-500/10 p-8 text-center">
          <Crown className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-bold text-lg mb-2">No Organization Selected</h3>
          <p className="text-sm text-muted-foreground">
            Please select an organization from the switcher to view billing details.
          </p>
        </Card>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Current Plan */}
          <Card className="glass border-purple-500/10">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-amber-400" />
                    Current Plan
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Next billing date: {CURRENT_PLAN.nextBilling}
                  </CardDescription>
                </div>
                <Badge variant="default" className="bg-green-500/20 text-green-300 border-green-500/30">
                  <Check className="mr-1 h-3 w-3" />
                  Active
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2 mb-6">
                <span className="text-4xl font-bold">{CURRENT_PLAN.price}</span>
                <span className="text-muted-foreground mb-1">{CURRENT_PLAN.period}</span>
                <Badge variant="outline" className="ml-2 border-purple-500/20 text-purple-300">
                  {CURRENT_PLAN.name}
                </Badge>
              </div>

              {/* Plan Options */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {PLANS.map((plan) => (
                  <div
                    key={plan.name}
                    className={`p-4 rounded-lg border transition-colors ${
                      plan.popular
                        ? "border-purple-500/30 bg-purple-500/5"
                        : "border-purple-500/10 hover:border-purple-500/20"
                    }`}
                  >
                    {plan.popular && (
                      <Badge className="mb-2 bg-gradient-to-r from-purple-500 to-cyan-500 text-white border-0 text-[10px]">
                        Current
                      </Badge>
                    )}
                    <div className="flex items-end gap-1 mb-1">
                      <span className="text-xl font-bold">{plan.price}</span>
                      <span className="text-xs text-muted-foreground mb-0.5">
                        {plan.period}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{plan.description}</p>
                    <Button
                      variant={plan.popular ? "default" : "outline"}
                      size="sm"
                      disabled={plan.popular}
                      className={
                        plan.popular
                          ? "btn-gradient text-white w-full text-xs"
                          : "w-full text-xs border-purple-500/20 hover:bg-purple-500/10"
                      }
                    >
                      {plan.cta}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Usage Metrics */}
          <Card className="glass border-purple-500/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-400" />
                Usage This Period
              </CardTitle>
              <CardDescription>
                Current billing period: Dec 15, 2024 — Jan 15, 2025
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {USAGE_METRICS.map((metric) => (
                <div key={metric.label} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${metric.color}`}>
                        <metric.icon className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-sm font-medium">{metric.label}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {typeof metric.used === "number" && metric.used > 1000
                        ? (metric.used / 1000).toFixed(1) + "k"
                        : metric.used}
                      {" / "}
                      {typeof metric.limit === "number" && metric.limit > 1000
                        ? (metric.limit / 1000).toFixed(0) + "k"
                        : metric.limit}{" "}
                      {metric.unit}
                    </span>
                  </div>
                  <Progress
                    value={(metric.used / metric.limit) * 100}
                    className="h-2"
                  />
                  <div className="flex justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      {((metric.used / metric.limit) * 100).toFixed(1)}% used
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {Math.round(metric.limit - metric.used).toLocaleString()}{" "}
                      {metric.unit} remaining
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Entitlements */}
          <Card className="glass border-purple-500/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-purple-400" />
                Entitlements
              </CardTitle>
              <CardDescription>
                Resource limits included in your plan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ENTITLEMENTS.map((ent) => (
                  <div
                    key={ent.name}
                    className="flex items-center gap-3 p-3 rounded-lg border border-purple-500/10 bg-purple-500/5"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-500/10">
                      <ent.icon className="h-4 w-4 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{ent.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {ent.used} / {ent.limit} used
                      </div>
                    </div>
                    <Progress
                      value={(ent.used / ent.limit) * 100}
                      className="h-1.5 w-16"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Invoices */}
          <Card className="glass border-purple-500/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-purple-400" />
                Invoice History
              </CardTitle>
              <CardDescription>
                Download past invoices for your records
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-purple-500/10 hover:bg-transparent">
                    <TableHead>Invoice</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {INVOICES.map((invoice) => (
                    <TableRow
                      key={invoice.id}
                      className="border-purple-500/10 hover:bg-purple-500/5"
                    >
                      <TableCell className="font-mono text-xs">
                        {invoice.id}
                      </TableCell>
                      <TableCell className="text-sm">{invoice.description}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {invoice.date}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {invoice.amount}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-[10px] border-green-500/20 text-green-400"
                        >
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
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Payment Method */}
          <Card className="glass border-purple-500/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCardIcon className="h-5 w-5 text-purple-400" />
                Payment Method
              </CardTitle>
              <CardDescription>
                Manage your payment methods for subscription billing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 p-4 rounded-lg border border-purple-500/10 bg-purple-500/5">
                <div className="flex h-12 w-16 items-center justify-center rounded-md bg-gradient-to-br from-purple-500/20 to-violet-500/20 border border-purple-500/10">
                  <CreditCard className="h-6 w-6 text-purple-400" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">Visa ending in 4242</div>
                  <div className="text-xs text-muted-foreground">
                    Expires 12/2026
                  </div>
                </div>
                <Badge variant="outline" className="border-green-500/20 text-green-400 text-xs">
                  Default
                </Badge>
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
                  Update
                </Button>
              </div>
              <Button
                variant="outline"
                className="mt-3 border-purple-500/20 hover:bg-purple-500/10 text-xs"
              >
                <CreditCard className="mr-2 h-3 w-3" />
                Add Payment Method
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
