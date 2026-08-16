"use client";

// Mianx.ai — Phase 9: Trust & Audit Center
//
// Comprehensive trust/security dashboard showing:
//   - Overall Trust Score (0-100) with weighted breakdown
//   - Trust Grade (A-F) with animated badge
//   - Mission success, verification, tool reliability scores
//   - Risk distribution visualization
//   - Real-time audit log timeline with type filters
//   - Security events panel
//   - Top tools usage ranking
//   - Approval response metrics
//   - Agent Loop quality metrics

import { useEffect, useState, useCallback, useMemo } from "react";
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
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
  Filter,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  Zap,
  Wrench,
  FileCheck,
  Award,
  BarChart3,
  ChevronRight,
  ChevronLeft,
  Lock,
  Unlock,
  Info,
  Layers,
  Cpu,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

interface TrustStats {
  trustScore: number;
  trustGrade: string;
  trustBreakdown: {
    missionSuccess: number;
    verificationRate: number;
    toolReliability: number;
    budgetAdherence: number;
    approvalResponse: number;
  };
  totalMissions: number;
  completedMissions: number;
  failedMissions: number;
  successRate: number;
  totalTasks: number;
  verifiedTasks: number;
  failedVerification: number;
  verificationRate: number;
  totalApprovals: number;
  approvedCount: number;
  rejectedCount: number;
  pendingApprovals: number;
  totalToolCalls: number;
  successfulToolCalls: number;
  failedToolCalls: number;
  toolSuccessRate: number;
  topTools: { toolName: string; calls: number }[];
  riskBreakdown: { riskLevel: string; count: number; percent: number }[];
  avgReflectionScore: number;
  loopCompletedCount: number;
  securityEventCount: number;
  recentSecurityEvents: {
    id: string;
    eventType: string;
    title: string;
    level: string;
    missionTitle?: string;
    createdAt: string;
  }[];
  totalAuditEvents: number;
  auditEventsByType: { eventType: string; count: number }[];
}

interface AuditEvent {
  id: string;
  source: string;
  action: string;
  title: string;
  description: string;
  level: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  missionTitle?: string;
  missionStatus?: string;
  taskTitle?: string;
}

interface AuditLogResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  events: AuditEvent[];
}

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────

const TRUST_GRADE_COLORS: Record<string, { text: string; bg: string; border: string; glow: string }> = {
  A: { text: "text-emerald-300", bg: "bg-emerald-500/20", border: "border-emerald-500/40", glow: "shadow-emerald-500/20" },
  B: { text: "text-blue-300", bg: "bg-blue-500/20", border: "border-blue-500/40", glow: "shadow-blue-500/20" },
  C: { text: "text-amber-300", bg: "bg-amber-500/20", border: "border-amber-500/40", glow: "shadow-amber-500/20" },
  D: { text: "text-orange-300", bg: "bg-orange-500/20", border: "border-orange-500/40", glow: "shadow-orange-500/20" },
  F: { text: "text-red-300", bg: "bg-red-500/20", border: "border-red-500/40", glow: "shadow-red-500/20" },
};

const RISK_COLORS: Record<string, { text: string; bg: string; bar: string }> = {
  LOW: { text: "text-emerald-400", bg: "bg-emerald-500/20", bar: "bg-emerald-500" },
  MEDIUM: { text: "text-amber-400", bg: "bg-amber-500/20", bar: "bg-amber-500" },
  HIGH: { text: "text-orange-400", bg: "bg-orange-500/20", bar: "bg-orange-500" },
  CRITICAL: { text: "text-red-400", bg: "bg-red-500/20", bar: "bg-red-500" },
};

const EVENT_LEVEL_ICONS: Record<string, { icon: typeof Info; color: string }> = {
  info: { icon: Info, color: "text-blue-400" },
  warn: { icon: AlertTriangle, color: "text-amber-400" },
  error: { icon: XCircle, color: "text-red-400" },
  success: { icon: CheckCircle, color: "text-emerald-400" },
};

const AUDIT_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "MISSION", label: "Missions" },
  { key: "TOOL", label: "Tools" },
  { key: "APPROVAL", label: "Approvals" },
  { key: "VERIFICATION", label: "Verify" },
  { key: "BUDGET", label: "Budget" },
  { key: "AGENT", label: "Agent Loop" },
];

// ─────────────────────────────────────────────
//  Trust Score Ring
// ─────────────────────────────────────────────

function TrustScoreRing({ score, grade }: { score: number; grade: string }) {
  const colors = TRUST_GRADE_COLORS[grade] || TRUST_GRADE_COLORS.C;
  const size = 160;
  const strokeWidth = 10;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const scoreColor = score >= 90 ? "#10b981" : score >= 80 ? "#3b82f6" : score >= 70 ? "#f59e0b" : score >= 60 ? "#f97316" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-3">
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
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={scoreColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            style={{ filter: `drop-shadow(0 0 8px ${scoreColor}60)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className={`text-3xl font-bold ${colors.text}`}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            {score}
          </motion.span>
          <span className="text-[10px] text-muted-foreground">out of 100</span>
        </div>
      </div>

      <motion.div
        className={`px-4 py-1.5 rounded-full border ${colors.bg} ${colors.border} ${colors.glow} shadow-lg`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <span className={`text-lg font-bold ${colors.text}`}>
          Trust Grade: {grade}
        </span>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Trust Breakdown Bars
// ─────────────────────────────────────────────

function TrustBreakdown({
  breakdown,
}: {
  breakdown: TrustStats["trustBreakdown"];
}) {
  const metrics = [
    { label: "Mission Success", value: breakdown.missionSuccess, icon: Target, weight: "30%" },
    { label: "Verification Rate", value: breakdown.verificationRate, icon: FileCheck, weight: "25%" },
    { label: "Tool Reliability", value: breakdown.toolReliability, icon: Wrench, weight: "20%" },
    { label: "Budget Adherence", value: breakdown.budgetAdherence, icon: Layers, weight: "15%" },
    { label: "Approval Response", value: breakdown.approvalResponse, icon: ShieldCheck, weight: "10%" },
  ];

  return (
    <div className="space-y-3">
      {metrics.map((m) => (
        <div key={m.label} className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <m.icon className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">{m.label}</span>
              <span className="text-[9px] text-purple-400/60">({m.weight})</span>
            </div>
            <span className={`font-medium ${m.value >= 80 ? "text-emerald-400" : m.value >= 60 ? "text-amber-400" : "text-red-400"}`}>
              {m.value}%
            </span>
          </div>
          <Progress
            value={m.value}
            className={`h-1.5 ${
              m.value >= 80
                ? "[&>div]:bg-emerald-500"
                : m.value >= 60
                  ? "[&>div]:bg-amber-500"
                  : "[&>div]:bg-red-500"
            }`}
          />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
//  Audit Timeline Item
// ─────────────────────────────────────────────

function AuditTimelineItem({ event, index }: { event: AuditEvent; index: number }) {
  const levelConfig = EVENT_LEVEL_ICONS[event.level] || EVENT_LEVEL_ICONS.info;
  const IconComponent = levelConfig.icon;
  const timeAgo = getTimeAgo(event.createdAt);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02 }}
      className="relative flex gap-3 pb-4"
    >
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
          event.level === "error" ? "bg-red-500/20" :
          event.level === "warn" ? "bg-amber-500/20" :
          event.level === "success" ? "bg-emerald-500/20" :
          "bg-blue-500/20"
        }`}>
          <IconComponent className={`h-3.5 w-3.5 ${levelConfig.color}`} />
        </div>
        {index < 19 && (
          <div className="w-px flex-1 bg-purple-500/10 mt-1" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground truncate">
              {event.title}
            </p>
            {event.description && (
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                {event.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1">
              {event.missionTitle && (
                <span className="text-[9px] text-purple-400/70 truncate max-w-[120px]">
                  🚀 {event.missionTitle}
                </span>
              )}
              <Badge
                variant="outline"
                className="text-[8px] px-1 py-0 h-3.5 bg-purple-500/5 border-purple-500/15 text-muted-foreground"
              >
                {event.action}
              </Badge>
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
            {timeAgo}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

// ─────────────────────────────────────────────
//  Loading Skeleton
// ─────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl bg-purple-500/10" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="h-72 rounded-xl bg-purple-500/10" />
        <Skeleton className="h-72 rounded-xl bg-purple-500/10" />
        <Skeleton className="h-72 rounded-xl bg-purple-500/10" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Main TrustCenter Component
// ─────────────────────────────────────────────

export function TrustCenter() {
  const { navigate } = useApp();
  const [stats, setStats] = useState<TrustStats | null>(null);
  const [auditLog, setAuditLog] = useState<AuditLogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);

  // Audit log filters
  const [auditFilter, setAuditFilter] = useState("ALL");
  const [auditPage, setAuditPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch trust stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/trust/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch audit log
  const fetchAuditLog = useCallback(async (page = 1, filter = "ALL", search = "") => {
    setAuditLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        type: filter,
        search,
      });
      const res = await fetch(`/api/trust/audit-log?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAuditLog(data);
      }
    } catch {
      // Silent
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchAuditLog();
  }, [fetchStats, fetchAuditLog]);

  // Handle filter change
  const handleFilterChange = (filter: string) => {
    setAuditFilter(filter);
    setAuditPage(1);
    fetchAuditLog(1, filter, searchQuery);
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setAuditPage(page);
    fetchAuditLog(page, auditFilter, searchQuery);
  };

  // Handle search
  const handleSearch = () => {
    setAuditPage(1);
    fetchAuditLog(1, auditFilter, searchQuery);
  };

  // Navigate to mission
  const goToMission = (missionId: string) => {
    navigate("missionDetail", { id: missionId });
  };

  // ─────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-blue-500/30">
            <Shield className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Trust & Audit Center</h1>
            <p className="text-xs text-muted-foreground">
              Security posture, trust scores, and complete audit trail
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={fetchStats} className="h-8 gap-1.5 text-xs">
                <RefreshCw className="h-3 w-3" />
                Refresh
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh trust data</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* ─── Loading ─── */}
      {loading && !stats ? (
        <LoadingSkeleton />
      ) : stats ? (
        <div className="space-y-4">
          {/* ─── KPI Cards ─── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              {
                icon: <Target className="h-4 w-4" />,
                label: "Mission Success",
                value: `${stats.successRate}%`,
                sub: `${stats.completedMissions}/${stats.totalMissions}`,
                color: stats.successRate >= 80 ? "from-emerald-500/15 to-emerald-500/5 border-emerald-500/20" : "from-amber-500/15 to-amber-500/5 border-amber-500/20",
                textColor: stats.successRate >= 80 ? "text-emerald-400" : "text-amber-400",
              },
              {
                icon: <FileCheck className="h-4 w-4" />,
                label: "Verification Rate",
                value: `${stats.verificationRate}%`,
                sub: `${stats.failedVerification} failed`,
                color: stats.verificationRate >= 80 ? "from-blue-500/15 to-blue-500/5 border-blue-500/20" : "from-amber-500/15 to-amber-500/5 border-amber-500/20",
                textColor: stats.verificationRate >= 80 ? "text-blue-400" : "text-amber-400",
              },
              {
                icon: <Wrench className="h-4 w-4" />,
                label: "Tool Reliability",
                value: `${stats.toolSuccessRate}%`,
                sub: `${stats.failedToolCalls} failures`,
                color: stats.toolSuccessRate >= 90 ? "from-purple-500/15 to-purple-500/5 border-purple-500/20" : "from-amber-500/15 to-amber-500/5 border-amber-500/20",
                textColor: stats.toolSuccessRate >= 90 ? "text-purple-400" : "text-amber-400",
              },
              {
                icon: <ShieldCheck className="h-4 w-4" />,
                label: "Approvals",
                value: `${stats.approvedCount}/${stats.totalApprovals}`,
                sub: `${stats.pendingApprovals} pending`,
                color: "from-cyan-500/15 to-cyan-500/5 border-cyan-500/20",
                textColor: "text-cyan-400",
              },
              {
                icon: <AlertTriangle className="h-4 w-4" />,
                label: "Security Events",
                value: `${stats.securityEventCount}`,
                sub: "last 30 days",
                color: stats.securityEventCount === 0
                  ? "from-emerald-500/15 to-emerald-500/5 border-emerald-500/20"
                  : "from-red-500/15 to-red-500/5 border-red-500/20",
                textColor: stats.securityEventCount === 0 ? "text-emerald-400" : "text-red-400",
              },
            ].map((kpi, i) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className={`bg-gradient-to-br ${kpi.color}`}>
                  <CardContent className="p-3">
                    <div className={`flex items-center gap-1.5 mb-1.5 ${kpi.textColor}`}>
                      {kpi.icon}
                      <span className="text-[10px] text-muted-foreground">{kpi.label}</span>
                    </div>
                    <div className="text-lg font-bold text-white">{kpi.value}</div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{kpi.sub}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* ─── Main Grid ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* ─── Left: Trust Score + Breakdown ─── */}
            <div className="lg:col-span-1 space-y-4">
              {/* Trust Score */}
              <Card className="border-purple-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Award className="h-4 w-4 text-purple-400" />
                    Overall Trust Score
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Weighted metric across 5 trust dimensions
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center pb-6">
                  <TrustScoreRing score={stats.trustScore} grade={stats.trustGrade} />
                </CardContent>
              </Card>

              {/* Trust Breakdown */}
              <Card className="border-purple-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-purple-400" />
                    Score Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TrustBreakdown breakdown={stats.trustBreakdown} />
                </CardContent>
              </Card>

              {/* Risk Distribution */}
              <Card className="border-purple-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Layers className="h-4 w-4 text-purple-400" />
                    Risk Distribution
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Tasks by risk level
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {stats.riskBreakdown.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No task data yet
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {stats.riskBreakdown.map((r) => {
                        const colors = RISK_COLORS[r.riskLevel] || RISK_COLORS.LOW;
                        return (
                          <div key={r.riskLevel} className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <div className="flex items-center gap-1.5">
                                <div className={`w-2 h-2 rounded-full ${colors.bar}`} />
                                <span className={colors.text}>{r.riskLevel}</span>
                              </div>
                              <span className="text-muted-foreground">
                                {r.count} tasks ({r.percent}%)
                              </span>
                            </div>
                            <Progress
                              value={r.percent}
                              className={`h-1.5 [&>div]:${colors.bar}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Agent Loop Quality */}
              <Card className="border-purple-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-purple-400" />
                    Agent Loop Quality
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Avg Reflection Score</span>
                    <span className={`font-medium ${stats.avgReflectionScore >= 70 ? "text-emerald-400" : stats.avgReflectionScore >= 50 ? "text-amber-400" : "text-red-400"}`}>
                      {stats.avgReflectionScore}/100
                    </span>
                  </div>
                  <Progress
                    value={stats.avgReflectionScore}
                    className={`h-1.5 ${
                      stats.avgReflectionScore >= 70
                        ? "[&>div]:bg-emerald-500"
                        : stats.avgReflectionScore >= 50
                          ? "[&>div]:bg-amber-500"
                          : "[&>div]:bg-red-500"
                    }`}
                  />
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Completed Loops</span>
                    <span className="font-medium text-white">{stats.loopCompletedCount}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ─── Center + Right: Audit Log + Security + Top Tools ─── */}
            <div className="lg:col-span-2 space-y-4">
              {/* Security Events */}
              <Card className={`border ${stats.securityEventCount > 0 ? "border-red-500/20 bg-red-500/5" : "border-emerald-500/20 bg-emerald-500/5"}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    {stats.securityEventCount > 0 ? (
                      <ShieldAlert className="h-4 w-4 text-red-400" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    )}
                    Security Events
                    {stats.securityEventCount > 0 && (
                      <Badge className="bg-red-500/20 text-red-400 text-[10px] px-1.5">
                        {stats.securityEventCount}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.securityEventCount === 0 ? (
                    <div className="text-center py-4">
                      <ShieldCheck className="h-8 w-8 text-emerald-400/50 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">
                        No security events in the last 30 days
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="max-h-[150px]">
                      <div className="space-y-1.5">
                        {stats.recentSecurityEvents.map((evt) => (
                          <div
                            key={evt.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-red-500/10"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {evt.level === "error" ? (
                                <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                              ) : (
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                              )}
                              <span className="text-xs truncate">{evt.title}</span>
                              {evt.missionTitle && (
                                <span className="text-[9px] text-muted-foreground truncate">
                                  — {evt.missionTitle}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">
                              {getTimeAgo(evt.createdAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Audit Log */}
              <Card className="border-purple-500/20">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Eye className="h-4 w-4 text-purple-400" />
                        Audit Trail
                        {stats.totalAuditEvents > 0 && (
                          <Badge variant="outline" className="text-[9px] px-1.5 bg-purple-500/5 border-purple-500/15 text-muted-foreground">
                            {formatNumber(stats.totalAuditEvents)} events
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        Complete log of all platform actions
                      </CardDescription>
                    </div>
                  </div>

                  {/* Filters + Search */}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <div className="flex gap-1 overflow-x-auto no-scrollbar flex-1">
                      {AUDIT_FILTERS.map((f) => (
                        <Button
                          key={f.key}
                          variant={auditFilter === f.key ? "default" : "ghost"}
                          size="sm"
                          onClick={() => handleFilterChange(f.key)}
                          className={`h-6 text-[10px] px-2 flex-shrink-0 ${
                            auditFilter === f.key
                              ? "bg-purple-500/20 text-purple-300 hover:bg-purple-500/30"
                              : "text-muted-foreground"
                          }`}
                        >
                          {f.label}
                        </Button>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        className="h-6 w-28 text-[10px] px-2 rounded-md bg-purple-500/5 border border-purple-500/15 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-purple-500/30"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSearch}
                        className="h-6 w-6 p-0"
                      >
                        <Search className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {auditLoading ? (
                    <div className="space-y-3 py-4">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex gap-3">
                          <Skeleton className="w-7 h-7 rounded-full bg-purple-500/10 flex-shrink-0" />
                          <div className="flex-1 space-y-1">
                            <Skeleton className="h-3 w-3/4 bg-purple-500/10" />
                            <Skeleton className="h-2 w-1/2 bg-purple-500/10" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : auditLog && auditLog.events.length > 0 ? (
                    <div>
                      <ScrollArea className="max-h-[400px]">
                        <div className="pr-2">
                          {auditLog.events.map((event, idx) => (
                            <AuditTimelineItem key={event.id} event={event} index={idx} />
                          ))}
                        </div>
                      </ScrollArea>

                      {/* Pagination */}
                      {auditLog.totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-purple-500/10">
                          <p className="text-[10px] text-muted-foreground">
                            Page {auditLog.page} of {auditLog.totalPages} ({formatNumber(auditLog.total)} events)
                          </p>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePageChange(auditPage - 1)}
                              disabled={auditPage <= 1}
                              className="h-6 w-6 p-0 text-xs"
                            >
                              <ChevronLeft className="h-3 w-3" />
                            </Button>
                            {Array.from(
                              { length: Math.min(auditLog.totalPages, 5) },
                              (_, i) => {
                                const start = Math.max(1, Math.min(auditPage - 2, auditLog.totalPages - 4));
                                const pageNum = start + i;
                                if (pageNum > auditLog.totalPages) return null;
                                return (
                                  <Button
                                    key={pageNum}
                                    variant={pageNum === auditPage ? "default" : "ghost"}
                                    size="sm"
                                    onClick={() => handlePageChange(pageNum)}
                                    className={`h-6 w-6 p-0 text-[10px] ${
                                      pageNum === auditPage
                                        ? "bg-purple-500/20 text-purple-300"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    {pageNum}
                                  </Button>
                                );
                              },
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePageChange(auditPage + 1)}
                              disabled={auditPage >= auditLog.totalPages}
                              className="h-6 w-6 p-0 text-xs"
                            >
                              <ChevronRight className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Eye className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">
                        {searchQuery ? "No events match your search" : "No audit events yet"}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Bottom: Top Tools + Event Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Top Tools */}
                <Card className="border-purple-500/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Zap className="h-4 w-4 text-cyan-400" />
                      Top Tools (30d)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stats.topTools.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No tool usage data yet
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {stats.topTools.slice(0, 8).map((tool, idx) => (
                          <div key={tool.toolName} className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold w-4 text-right ${
                              idx === 0 ? "text-amber-400" : idx === 1 ? "text-gray-300" : idx === 2 ? "text-orange-400" : "text-muted-foreground"
                            }`}>
                              {idx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center text-xs">
                                <span className="truncate">{tool.toolName}</span>
                                <span className="text-muted-foreground ml-2 flex-shrink-0">
                                  {formatNumber(tool.calls)}
                                </span>
                              </div>
                              {idx === 0 && (
                                <Progress
                                  value={100}
                                  className="mt-1 h-0.5 [&>div]:bg-amber-500/50"
                                />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Event Breakdown */}
                <Card className="border-purple-500/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Activity className="h-4 w-4 text-purple-400" />
                      Event Breakdown (30d)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stats.auditEventsByType.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No events recorded yet
                      </p>
                    ) : (
                      <ScrollArea className="max-h-[200px]">
                        <div className="space-y-1.5">
                          {stats.auditEventsByType.map((evt) => {
                            const maxCount = stats.auditEventsByType[0]?.count || 1;
                            const pct = (evt.count / maxCount) * 100;
                            const isSecurity = ["BUDGET_EXCEEDED", "VERIFICATION_FAILED", "REPAIR_STARTED", "ERROR", "MISSION_FAILED"].includes(evt.eventType);
                            return (
                              <div key={evt.eventType} className="space-y-0.5">
                                <div className="flex justify-between items-center text-xs">
                                  <div className="flex items-center gap-1.5">
                                    {isSecurity && (
                                      <AlertTriangle className="h-2.5 w-2.5 text-red-400" />
                                    )}
                                    <span className={`truncate max-w-[140px] ${isSecurity ? "text-red-300" : "text-muted-foreground"}`}>
                                      {evt.eventType.replace(/_/g, " ")}
                                    </span>
                                  </div>
                                  <span className="text-muted-foreground">{evt.count}</span>
                                </div>
                                <Progress
                                  value={pct}
                                  className={`h-0.5 ${
                                    isSecurity ? "[&>div]:bg-red-500/50" : "[&>div]:bg-purple-500/30"
                                  }`}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <Shield className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">
            Unable to load trust data. Click refresh to try again.
          </p>
          <Button variant="outline" size="sm" onClick={fetchStats} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
