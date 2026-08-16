"use client";

// Mianx.ai — Phase 8: Budget Dashboard
//
// Comprehensive budget control UI showing:
//   - Monthly spend gauge with plan limits
//   - Per-mission budget utilization bars
//   - Daily spend trend chart (CSS-based)
//   - AI usage breakdown
//   - Budget alerts & warnings
//   - Cost efficiency metrics
//   - Settings panel (alerts, caps, auto-approval)

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Wallet,
  CreditCard,
  Zap,
  BarChart3,
  Calendar,
  Bell,
  BellOff,
  Settings,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Target,
  Clock,
  CheckCircle,
  XCircle,
  Flame,
  Shield,
  Rocket,
  Info,
  ChevronRight,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

interface BudgetStats {
  plan: string;
  planLimits: { maxMissionBudget: number; monthlySpendLimit: number };
  monthlySpend: number;
  monthlyLimit: number;
  monthlyUsagePercent: number;
  avgDailySpend: number;
  projectedMonthly: number;
  daysRemaining: number;
  allTimeSpend: number;
  aiCostThisMonth: number;
  totalTokens: number;
  totalAiCalls: number;
  missionsWithBudget: MissionBudgetItem[];
  budgetAlerts: BudgetAlert[];
  activeMissionsCount: number;
  spendByStatus: { status: string; spentUsd: number; missionCount: number }[];
  dailySpend: { date: string; amount: number }[];
}

interface MissionBudgetItem {
  id: string;
  title: string;
  status: string;
  budgetUsd: number | null;
  spentUsd: number;
  usagePercent: number;
  createdAt: string;
}

interface BudgetAlert {
  missionId: string;
  missionTitle: string;
  spentUsd: number;
  budgetUsd: number;
  usagePercent: number;
  isExceeded: boolean;
  isWarning: boolean;
}

interface BudgetSettings {
  alertThresholdPercent: number;
  alertEmailEnabled: boolean;
  alertInAppEnabled: boolean;
  autoApprovalRiskLevels: string[];
  requireApprovalAbove: number;
  dailySpendCap: number | null;
  monthlySpendCap: number | null;
  currency: string;
  timezone: string;
}

interface ApprovalPolicy {
  autoApproveRiskLevels: string[];
  requireApprovalRiskLevels: string[];
  requireAdminEscalation: string[];
  budgetThresholdPercent: number;
  timeoutMinutes: number;
}

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────

const PLAN_COLORS: Record<string, { gradient: string; text: string; bg: string }> = {
  FREE: { gradient: "from-gray-500 to-gray-600", text: "text-gray-400", bg: "bg-gray-500/15" },
  STARTER: { gradient: "from-blue-500 to-cyan-500", text: "text-blue-400", bg: "bg-blue-500/15" },
  PRO: { gradient: "from-purple-500 to-violet-500", text: "text-purple-400", bg: "bg-purple-500/15" },
  ENTERPRISE: { gradient: "from-amber-500 to-orange-500", text: "text-amber-400", bg: "bg-amber-500/15" },
};

const STATUS_COLORS: Record<string, string> = {
  EXECUTING: "text-purple-400",
  PLANNING: "text-blue-400",
  VERIFYING: "text-cyan-400",
  REPAIRING: "text-orange-400",
  COMPLETED: "text-emerald-400",
  FAILED: "text-red-400",
  PAUSED: "text-yellow-400",
  CANCELLED: "text-gray-500",
  DRAFT: "text-gray-400",
};

// ─────────────────────────────────────────────
//  Helper: Animated counter
// ─────────────────────────────────────────────

function AnimatedCounter({ value, decimals = 0, prefix = "", suffix = "" }: {
  value: number; decimals?: number; prefix?: string; suffix?: string;
}) {
  const [displayed, setDisplayed] = useState(0);
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
    const start = displayed;
    const diff = value - start;
    const steps = 20;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setDisplayed(start + (diff * step) / steps);
      if (step >= steps) clearInterval(timer);
    }, 20);
    return () => clearInterval(timer);
  }, [value, displayed]);

  return (
    <span>
      {prefix}{displayed.toFixed(decimals)}{suffix}
    </span>
  );
}

// ─────────────────────────────────────────────
//  Gauge Component (circular progress)
// ─────────────────────────────────────────────

function BudgetGauge({
  value,
  max,
  label,
  size = 120,
  colorClass,
}: {
  value: number;
  max: number;
  label: string;
  size?: number;
  colorClass: string;
}) {
  const percent = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const strokeWidth = 8;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  const getColor = () => {
    if (percent >= 100) return { stroke: "#ef4444", text: "text-red-400" };
    if (percent >= 80) return { stroke: "#f59e0b", text: "text-amber-400" };
    if (percent >= 60) return { stroke: "#a855f7", text: "text-purple-400" };
    return { stroke: "#10b981", text: "text-emerald-400" };
  };

  const colors = getColor();

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            className="text-purple-500/10"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
            style={{ filter: "drop-shadow(0 0 6px " + colors.stroke + "40)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-lg font-bold ${colors.text}`}>
            {percent.toFixed(0)}%
          </span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground text-center">{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Mini Bar Chart (CSS-based, no external libs)
// ─────────────────────────────────────────────

function MiniBarChart({ data, maxValue }: {
  data: { date: string; amount: number }[];
  maxValue?: number;
}) {
  const max = maxValue || Math.max(...data.map((d) => d.amount), 0.01);
  const chartHeight = 80;

  return (
    <div className="flex items-end gap-0.5 h-[100px]">
      {data.map((d, i) => {
        const height = Math.max((d.amount / max) * chartHeight, 2);
        const isLast = i === data.length - 1;
        return (
          <Tooltip key={d.date}>
            <TooltipTrigger asChild>
              <div className="flex-1 flex flex-col items-center gap-1">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height }}
                  transition={{ duration: 0.5, delay: i * 0.01 }}
                  className={`w-full rounded-t-sm min-w-[2px] ${
                    isLast
                      ? "bg-gradient-to-t from-purple-500 to-cyan-500"
                      : d.amount / max > 0.8
                        ? "bg-amber-500/60"
                        : "bg-purple-500/30"
                  }`}
                  style={{ height: `${height}px` }}
                />
                <span className="text-[8px] text-muted-foreground opacity-0 group-hover:opacity-100">
                  {d.date.slice(5)}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">{d.date}: ${d.amount.toFixed(2)}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
//  Loading skeleton
// ─────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl bg-purple-500/10" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl bg-purple-500/10" />
      <Skeleton className="h-48 rounded-xl bg-purple-500/10" />
    </div>
  );
}

// ─────────────────────────────────────────────
//  Main BudgetDashboard Component
// ─────────────────────────────────────────────

export function BudgetDashboard() {
  const { navigate } = useApp();
  const [stats, setStats] = useState<BudgetStats | null>(null);
  const [settings, setSettings] = useState<BudgetSettings | null>(null);
  const [approvalPolicy, setApprovalPolicy] = useState<ApprovalPolicy | null>(null);
  const [plan, setPlan] = useState("FREE");
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<"7d" | "30d" | "90d">("30d");

  // Fetch budget stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/budget/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        setPlan(data.plan);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/budget/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setApprovalPolicy(data.approvalPolicy);
      }
    } catch {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchSettings();
  }, [fetchStats, fetchSettings]);

  // Auto-refresh every 10s
  useEffect(() => {
    const timer = setInterval(fetchStats, 10000);
    return () => clearInterval(timer);
  }, [fetchStats]);

  // Save settings
  const saveSettings = async (updated: Partial<BudgetSettings>) => {
    try {
      const res = await fetch("/api/budget/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        toast.success("Budget settings updated");
      }
    } catch {
      toast.error("Failed to update settings");
    }
  };

  // Navigate to mission
  const goToMission = (missionId: string) => {
    navigate("missionDetail", { id: missionId });
  };

  const goToMissions = () => {
    navigate("missions");
  };

  // Filtered daily spend
  const filteredDailySpend = useMemo(() => {
    if (!stats?.dailySpend) return [];
    const days = selectedPeriod === "7d" ? 7 : selectedPeriod === "90d" ? 30 : 30;
    return stats.dailySpend.slice(-days);
  }, [stats?.dailySpend, selectedPeriod]);

  // Plan color config
  const planColor = PLAN_COLORS[plan] || PLAN_COLORS.FREE;

  // ─────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30">
            <Wallet className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Budget Control</h1>
            <p className="text-xs text-muted-foreground">
              Track spending, set limits, and optimize AI costs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`${planColor.bg} ${planColor.text} border-0 px-2.5 py-1 text-[10px] font-bold uppercase`}>
            <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${planColor.gradient} mr-1.5`} />
            {plan} Plan
          </Badge>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={() => { fetchStats(); fetchSettings(); }} className="h-8 gap-1.5 text-xs">
                <RefreshCw className="h-3 w-3" />
                Refresh
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh budget data</TooltipContent>
          </Tooltip>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSettingsOpen(true)}
            className="h-8 gap-1.5 text-xs text-purple-400"
          >
            <Settings className="h-3 w-3" />
            Settings
          </Button>
        </div>
      </div>

      {/* ─── Loading ─── */}
      {loading && !stats ? (
        <LoadingSkeleton />
      ) : stats ? (
        <div className="space-y-4">
          {/* ─── Top KPI Cards ─── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 }}
            >
              <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs text-muted-foreground">Monthly Spend</span>
                  </div>
                  <div className="text-xl font-bold text-white">
                    $<AnimatedCounter value={stats.monthlySpend} decimals={2} />
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[10px] text-muted-foreground">
                      of ${stats.monthlyLimit} limit
                    </span>
                    {stats.monthlyUsagePercent > 80 && (
                      <AlertTriangle className="h-3 w-3 text-amber-400" />
                    )}
                  </div>
                  <Progress
                    value={Math.min(stats.monthlyUsagePercent, 100)}
                    className="mt-2 h-1.5"
                  />
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="h-4 w-4 text-purple-400" />
                    <span className="text-xs text-muted-foreground">Avg Daily</span>
                  </div>
                  <div className="text-xl font-bold text-white">
                    $<AnimatedCounter value={stats.avgDailySpend} decimals={2} />
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[10px] text-muted-foreground">
                      projected ${stats.projectedMonthly.toFixed(0)}/mo
                    </span>
                    {stats.projectedMonthly > stats.monthlyLimit && (
                      <TrendingUp className="h-3 w-3 text-red-400" />
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border-cyan-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-cyan-400" />
                    <span className="text-xs text-muted-foreground">AI Tokens</span>
                  </div>
                  <div className="text-xl font-bold text-white">
                    <AnimatedCounter value={stats.totalTokens} />
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[10px] text-muted-foreground">
                      {stats.totalAiCalls} calls this month
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-amber-400" />
                    <span className="text-xs text-muted-foreground">All-Time</span>
                  </div>
                  <div className="text-xl font-bold text-white">
                    $<AnimatedCounter value={stats.allTimeSpend} decimals={2} />
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[10px] text-muted-foreground">
                      {stats.daysRemaining} days left this month
                    </span>
                    <Clock className="h-3 w-3 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* ─── Main Dashboard Grid ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* ─── Left: Gauges + Alerts ─── */}
            <div className="lg:col-span-1 space-y-4">
              {/* Budget Gauges */}
              <Card className="border-purple-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-400" />
                    Budget Utilization
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Current spending vs plan limits
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-around">
                    <BudgetGauge
                      value={stats.monthlySpend}
                      max={stats.monthlyLimit}
                      label="Monthly"
                      size={100}
                      colorClass=""
                    />
                    <BudgetGauge
                      value={stats.aiCostThisMonth}
                      max={stats.monthlyLimit}
                      label="AI Costs"
                      size={100}
                      colorClass=""
                    />
                  </div>

                  <Separator className="bg-purple-500/10" />

                  {/* Plan limits */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Per-Mission Limit</span>
                      <span className="font-medium text-white">
                        ${stats.planLimits.maxMissionBudget}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Monthly Limit</span>
                      <span className="font-medium text-white">
                        ${stats.planLimits.monthlySpendLimit}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Active Missions</span>
                      <span className="font-medium text-purple-400">
                        {stats.activeMissionsCount}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Budget Alerts */}
              <Card className={`border ${stats.budgetAlerts.length > 0 ? "border-amber-500/30 bg-amber-500/5" : "border-purple-500/20"}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    {stats.budgetAlerts.length > 0 ? (
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                    )}
                    Budget Alerts
                    {stats.budgetAlerts.length > 0 && (
                      <Badge className="bg-amber-500/20 text-amber-400 text-[10px] px-1.5">
                        {stats.budgetAlerts.length}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.budgetAlerts.length === 0 ? (
                    <div className="text-center py-4">
                      <CheckCircle className="h-8 w-8 text-emerald-400/50 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">
                        All missions within budget
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="max-h-[200px]">
                      <div className="space-y-2">
                        {stats.budgetAlerts.map((alert) => (
                          <motion.button
                            key={alert.missionId}
                            onClick={() => goToMission(alert.missionId)}
                            className="w-full p-2.5 rounded-lg bg-background/50 border border-amber-500/20 hover:border-amber-500/40 transition-colors text-left"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium truncate max-w-[150px]">
                                {alert.missionTitle}
                              </span>
                              {alert.isExceeded ? (
                                <Badge className="bg-red-500/20 text-red-400 text-[10px]">
                                  EXCEEDED
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-500/20 text-amber-400 text-[10px]">
                                  WARNING
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress
                                value={Math.min(alert.usagePercent, 100)}
                                className="flex-1 h-1.5"
                              />
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                ${alert.spentUsd.toFixed(2)} / ${alert.budgetUsd}
                              </span>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Spending by Status */}
              <Card className="border-purple-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4 text-purple-400" />
                    Spend by Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.spendByStatus.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No spending data yet
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {stats.spendByStatus
                        .sort((a, b) => b.spentUsd - a.spentUsd)
                        .map((item) => {
                          const totalSpend = stats.spendByStatus.reduce((s, i) => s + i.spentUsd, 0);
                          const pct = totalSpend > 0 ? (item.spentUsd / totalSpend) * 100 : 0;
                          return (
                            <div key={item.status} className="space-y-1">
                              <div className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[item.status]?.replace("text-", "bg-") || "bg-gray-400"}`} />
                                  <span className="text-muted-foreground">{item.status}</span>
                                </div>
                                <span className="font-medium text-white">
                                  ${item.spentUsd.toFixed(2)}
                                  <span className="text-muted-foreground ml-1">
                                    ({item.missionCount})
                                  </span>
                                </span>
                              </div>
                              <Progress value={pct} className="h-1" />
                            </div>
                          );
                        })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ─── Center + Right: Chart + Missions ─── */}
            <div className="lg:col-span-2 space-y-4">
              {/* Daily Spend Trend */}
              <Card className="border-purple-500/20">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-purple-400" />
                        Daily Spend Trend
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        AI cost over time
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      {(["7d", "30d", "90d"] as const).map((p) => (
                        <Button
                          key={p}
                          variant={selectedPeriod === p ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setSelectedPeriod(p)}
                          className={`h-6 text-[10px] px-2 ${
                            selectedPeriod === p
                              ? "bg-purple-500/20 text-purple-300 hover:bg-purple-500/30"
                              : "text-muted-foreground"
                          }`}
                        >
                          {p}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredDailySpend.length === 0 ? (
                    <div className="h-[100px] flex items-center justify-center">
                      <p className="text-xs text-muted-foreground">No spending data for this period</p>
                    </div>
                  ) : (
                    <MiniBarChart data={filteredDailySpend} />
                  )}

                  {/* Quick stats below chart */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-purple-500/10">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground">Period Total</p>
                        <p className="text-sm font-bold text-white">
                          ${filteredDailySpend.reduce((s, d) => s + d.amount, 0).toFixed(2)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground">Peak Day</p>
                        <p className="text-sm font-bold text-white">
                          ${Math.max(...filteredDailySpend.map((d) => d.amount), 0).toFixed(2)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground">Avg Day</p>
                        <p className="text-sm font-bold text-white">
                          ${(filteredDailySpend.reduce((s, d) => s + d.amount, 0) / (filteredDailySpend.length || 1)).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <div className="w-2 h-2 rounded-full bg-purple-500/30" />
                      <span>Normal</span>
                      <div className="w-2 h-2 rounded-full bg-amber-500/60 ml-2" />
                      <span>High</span>
                      <div className="w-2 h-2 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 ml-2" />
                      <span>Today</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Mission Budget Table */}
              <Card className="border-purple-500/20">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Rocket className="h-4 w-4 text-purple-400" />
                        Mission Budgets
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        Per-mission spending breakdown
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={goToMissions}
                      className="h-7 text-[10px] text-purple-400"
                    >
                      View All
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {stats.missionsWithBudget.length === 0 ? (
                    <div className="text-center py-8">
                      <Wallet className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">
                        No missions with budget tracking yet
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={goToMissions}
                        className="mt-3 h-7 text-xs"
                      >
                        Create a Mission
                      </Button>
                    </div>
                  ) : (
                    <ScrollArea className="max-h-[350px]">
                      <div className="space-y-2">
                        {stats.missionsWithBudget.map((mission, idx) => (
                          <motion.button
                            key={mission.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.03 }}
                            onClick={() => goToMission(mission.id)}
                            className="w-full p-3 rounded-lg bg-background/30 border border-purple-500/10 hover:border-purple-500/30 transition-colors text-left group"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm font-medium truncate group-hover:text-purple-300 transition-colors">
                                  {mission.title}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={`${STATUS_COLORS[mission.status]?.replace("text-", "text-")} text-[10px] px-1.5`}
                                >
                                  {mission.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-white whitespace-nowrap">
                                  ${mission.spentUsd.toFixed(2)}
                                </span>
                                {mission.budgetUsd && (
                                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                    / ${mission.budgetUsd}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Progress
                                value={Math.min(mission.usagePercent, 100)}
                                className={`flex-1 h-1.5 ${
                                  mission.usagePercent >= 100
                                    ? "[&>div]:bg-red-500"
                                    : mission.usagePercent >= 80
                                      ? "[&>div]:bg-amber-500"
                                      : "[&>div]:bg-purple-500"
                                }`}
                              />
                              <span className={`text-[10px] font-medium ${
                                mission.usagePercent >= 100
                                  ? "text-red-400"
                                  : mission.usagePercent >= 80
                                    ? "text-amber-400"
                                    : "text-muted-foreground"
                              }`}>
                                {mission.usagePercent}%
                              </span>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* AI Cost Efficiency */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-purple-500/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Zap className="h-4 w-4 text-cyan-400" />
                      AI Cost Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">This Month</span>
                      <span className="font-medium text-white">${stats.aiCostThisMonth.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Total Tokens</span>
                      <span className="font-medium text-white">
                        {(stats.totalTokens / 1000).toFixed(1)}K
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">API Calls</span>
                      <span className="font-medium text-white">{stats.totalAiCalls}</span>
                    </div>
                    <Separator className="bg-purple-500/10" />
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Cost per 1K tokens</span>
                      <span className="font-medium text-white">
                        ${stats.totalTokens > 0
                          ? ((stats.aiCostThisMonth / stats.totalTokens) * 1000).toFixed(4)
                          : "0.0000"
                        }
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Cost per Call</span>
                      <span className="font-medium text-white">
                        ${stats.totalAiCalls > 0
                          ? (stats.aiCostThisMonth / stats.totalAiCalls).toFixed(4)
                          : "0.0000"
                        }
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-purple-500/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Flame className="h-4 w-4 text-orange-400" />
                      Cost Optimization Tips
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-2">
                      <Info className="h-3.5 w-3.5 text-purple-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        Use <span className="text-purple-300">LOW risk</span> tasks when possible — they auto-approve and execute faster.
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <Info className="h-3.5 w-3.5 text-purple-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        Set mission budgets to prevent runaway spending on complex objectives.
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <Info className="h-3.5 w-3.5 text-purple-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        Break large missions into smaller ones to better track and control costs.
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <Info className="h-3.5 w-3.5 text-purple-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        Upgrade your plan to increase monthly limits and reduce per-mission caps.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <Wallet className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">
            Unable to load budget data. Click refresh to try again.
          </p>
          <Button variant="outline" size="sm" onClick={fetchStats} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      )}

      {/* ─── Settings Dialog ─── */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="glass border-purple-500/20 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-purple-400" />
              Budget Settings
            </DialogTitle>
            <DialogDescription>
              Configure spending alerts, approval thresholds, and cost caps.
            </DialogDescription>
          </DialogHeader>

          {settings && approvalPolicy && (
            <div className="space-y-5 mt-2">
              {/* Alert Threshold */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Alert Threshold ({settings.alertThresholdPercent}%)
                </Label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={50}
                    max={100}
                    step={5}
                    value={settings.alertThresholdPercent}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        alertThresholdPercent: parseInt(e.target.value),
                      })
                    }
                    className="flex-1 accent-purple-500"
                  />
                  <span className="text-sm font-mono text-purple-300 w-10 text-right">
                    {settings.alertThresholdPercent}%
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Get notified when a mission uses this % of its budget
                </p>
              </div>

              <Separator className="bg-purple-500/10" />

              {/* Notification Preferences */}
              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground">Notifications</Label>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-foreground">In-App Alerts</span>
                  </div>
                  <Switch
                    checked={settings.alertInAppEnabled}
                    onCheckedChange={(v) =>
                      setSettings({ ...settings, alertInAppEnabled: v })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BellOff className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-foreground">Email Alerts</span>
                  </div>
                  <Switch
                    checked={settings.alertEmailEnabled}
                    onCheckedChange={(v) =>
                      setSettings({ ...settings, alertEmailEnabled: v })
                    }
                  />
                </div>
              </div>

              <Separator className="bg-purple-500/10" />

              {/* Approval Threshold */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Require Approval Above ($)
                </Label>
                <Input
                  type="number"
                  value={settings.requireApprovalAbove}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      requireApprovalAbove: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="bg-purple-500/5 border-purple-500/20"
                  min={0}
                  step={1}
                />
                <p className="text-[10px] text-muted-foreground">
                  Actions estimated above this cost will require manual approval
                </p>
              </div>

              <Separator className="bg-purple-500/10" />

              {/* Daily Spend Cap */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Daily Spend Cap ($)
                </Label>
                <Input
                  type="number"
                  value={settings.dailySpendCap || ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      dailySpendCap: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  placeholder="No limit"
                  className="bg-purple-500/5 border-purple-500/20"
                  min={0}
                  step={1}
                />
                <p className="text-[10px] text-muted-foreground">
                  Leave empty for no daily cap. System will pause missions if exceeded.
                </p>
              </div>

              <Separator className="bg-purple-500/10" />

              {/* Plan Policy (read-only info) */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Current Plan Policy ({plan})
                </Label>
                <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/10 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Auto-Approve</span>
                    <span className="text-emerald-400">
                      {approvalPolicy.autoApproveRiskLevels.join(", ")}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Require Approval</span>
                    <span className="text-amber-400">
                      {approvalPolicy.requireApprovalRiskLevels.join(", ")}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Admin Escalation</span>
                    <span className="text-red-400">
                      {approvalPolicy.requireAdminEscalation.length > 0
                        ? approvalPolicy.requireAdminEscalation.join(", ")
                        : "None"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Budget Threshold</span>
                    <span className="text-purple-300">
                      {approvalPolicy.budgetThresholdPercent}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Save */}
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSettingsOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => saveSettings(settings)}
                  className="bg-gradient-to-r from-purple-500 to-cyan-500 text-white text-xs"
                >
                  Save Settings
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
