"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Brain,
  Cpu,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Target,
  ShieldCheck,
  Rocket,
  RefreshCw,
  Loader2,
  TrendingUp,
  TrendingDown,
  Pause,
  Play,
  Eye,
  Wrench,
  ArrowRight,
  BarChart3,
  Layers,
  Gauge,
  Timer,
  Sparkles,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MISSION_STATUS_CONFIG,
  RISK_LEVEL_CONFIG,
  type MissionStatus,
} from "@/lib/mission-types";

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

interface PlatformStats {
  totalMissions: number;
  activeMissions: number;
  completedMissions: number;
  failedMissions: number;
  totalTasks: number;
  completedTasks: number;
  runningTasks: number;
  totalSpent: number;
  totalBudget: number;
  approvalPending: number;
  avgSuccessRate: number;
  agentLoopRuns: number;
  avgLoopIterations: number;
  avgReflectionScore: number;
  recentEvents: CommandEvent[];
  activeMissionList: ActiveMissionSummary[];
}

interface CommandEvent {
  id: string;
  missionId: string;
  eventType: string;
  title: string;
  description: string | null;
  level: string;
  missionTitle?: string;
  createdAt: string;
}

interface ActiveMissionSummary {
  id: string;
  title: string;
  status: MissionStatus;
  progress: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  spentUsd: number;
  budgetUsd: number | null;
  startedAt: string | null;
  currentTask?: string;
  agentName?: string;
}

// ─────────────────────────────────────────────
//  Animated number counter
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
//  Main Component
// ─────────────────────────────────────────────

export function CommandCenter() {
  const { navigate } = useApp();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch platform stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/missions/command-center");
      if (!res.ok) return;
      const data = await res.json();
      setStats(data);
      setLastRefresh(new Date());
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);

    if (autoRefresh) {
      pollRef.current = setInterval(fetchStats, 5000);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [autoRefresh, fetchStats]);

  // Navigate to mission detail
  const goToMission = (missionId: string) => {
    navigate("missionDetail", { id: missionId });
  };

  const goToApprovals = () => {
    navigate("approvals");
  };

  const goToMissions = () => {
    navigate("missions");
  };

  // ─────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-500/30">
            <Activity className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Command Center</h1>
            <p className="text-xs text-muted-foreground">
              Real-time autonomous mission control
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-[10px] text-muted-foreground">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`h-8 gap-1.5 text-xs ${autoRefresh ? "text-emerald-400" : "text-muted-foreground"}`}
              >
                <RefreshCw className={`h-3 w-3 ${autoRefresh ? "animate-spin" : ""} ${autoRefresh ? "animate-[spin_3s_linear_infinite]" : ""}`} />
                {autoRefresh ? "Live" : "Paused"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {autoRefresh ? "Auto-refreshing every 5s" : "Click to enable auto-refresh"}
            </TooltipContent>
          </Tooltip>
          <Button variant="ghost" size="sm" onClick={fetchStats} className="h-8 gap-1.5 text-xs">
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>
        </div>
      </div>

      {loading && !stats ? (
        <LoadingSkeleton />
      ) : stats ? (
        <div className="space-y-4">
          {/* ─── Top KPI Cards ─── */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <KPICard
              icon={<Rocket className="h-4 w-4" />}
              label="Total Missions"
              value={stats.totalMissions}
              color="text-purple-400"
              bgColor="bg-purple-500/15"
              borderColor="border-purple-500/30"
            />
            <KPICard
              icon={<Activity className="h-4 w-4" />}
              label="Active"
              value={stats.activeMissions}
              color="text-cyan-400"
              bgColor="bg-cyan-500/15"
              borderColor="border-cyan-500/30"
              pulse={stats.activeMissions > 0}
            />
            <KPICard
              icon={<CheckCircle className="h-4 w-4" />}
              label="Completed"
              value={stats.completedMissions}
              color="text-emerald-400"
              bgColor="bg-emerald-500/15"
              borderColor="border-emerald-500/30"
            />
            <KPICard
              icon={<XCircle className="h-4 w-4" />}
              label="Failed"
              value={stats.failedMissions}
              color="text-red-400"
              bgColor="bg-red-500/15"
              borderColor="border-red-500/30"
            />
            <KPICard
              icon={<DollarSign className="h-4 w-4" />}
              label="Total Spent"
              value={stats.totalSpent}
              decimals={2}
              prefix="$"
              color="text-amber-400"
              bgColor="bg-amber-500/15"
              borderColor="border-amber-500/30"
            />
            <KPICard
              icon={<Target className="h-4 w-4" />}
              label="Success Rate"
              value={stats.avgSuccessRate}
              decimals={0}
              suffix="%"
              color={stats.avgSuccessRate >= 70 ? "text-emerald-400" : stats.avgSuccessRate >= 40 ? "text-amber-400" : "text-red-400"}
              bgColor={stats.avgSuccessRate >= 70 ? "bg-emerald-500/15" : stats.avgSuccessRate >= 40 ? "bg-amber-500/15" : "bg-red-500/15"}
              borderColor={stats.avgSuccessRate >= 70 ? "border-emerald-500/30" : stats.avgSuccessRate >= 40 ? "border-amber-500/30" : "border-red-500/30"}
            />
          </div>

          {/* ─── Middle Row: Active Missions + Task Stats ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Active Missions Panel */}
            <Card className="lg:col-span-2 border-purple-500/20">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-cyan-400" />
                    Active Missions
                    {stats.activeMissions > 0 && (
                      <Badge variant="secondary" className="text-xs bg-cyan-500/20 text-cyan-400">
                        {stats.activeMissions} live
                      </Badge>
                    )}
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={goToMissions} className="h-7 text-xs gap-1">
                    View All <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {stats.activeMissionList.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <Rocket className="h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">No active missions</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Create a mission to see it here in real-time
                    </p>
                    <Button variant="outline" size="sm" onClick={goToMissions} className="mt-3 gap-1.5 text-xs">
                      <Rocket className="h-3.5 w-3.5" /> Create Mission
                    </Button>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[340px]">
                    <div className="space-y-2">
                      {stats.activeMissionList.map((mission) => (
                        <ActiveMissionCard
                          key={mission.id}
                          mission={mission}
                          onClick={() => goToMission(mission.id)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Task Stats + Agent Loop Stats */}
            <div className="space-y-4">
              {/* Task Stats */}
              <Card className="border-purple-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5 text-purple-400" />
                    Task Execution
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Total Tasks</span>
                    <span className="font-mono font-bold text-white">{stats.totalTasks}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Completed</span>
                    <span className="font-mono font-bold text-emerald-400">{stats.completedTasks}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Running</span>
                    <span className="font-mono font-bold text-cyan-400">{stats.runningTasks}</span>
                  </div>
                  <Separator className="bg-border/50" />
                  {/* Task progress bar */}
                  <div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Completion</span>
                      <span>{stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}%</span>
                    </div>
                    <Progress
                      value={stats.totalTasks > 0 ? (stats.completedTasks / stats.totalTasks) * 100 : 0}
                      className="h-1.5"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Agent Loop Stats */}
              <Card className="border-purple-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Cpu className="h-3.5 w-3.5 text-purple-400" />
                    Agent Loop (Phase 6)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Loop Runs</span>
                    <span className="font-mono font-bold text-purple-400">{stats.agentLoopRuns}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Avg Iterations</span>
                    <span className="font-mono font-bold text-cyan-400">{stats.avgLoopIterations}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Avg Quality Score</span>
                    <span className={`font-mono font-bold ${stats.avgReflectionScore >= 70 ? "text-emerald-400" : "text-amber-400"}`}>
                      {stats.avgReflectionScore}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Approval Queue Quick View */}
              <Card
                className="border-amber-500/20 cursor-pointer hover:border-amber-500/40 transition-colors"
                onClick={goToApprovals}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-amber-400" />
                      <span className="text-xs font-medium">Pending Approvals</span>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${stats.approvalPending > 0 ? "bg-amber-500/20 text-amber-400" : "bg-muted text-muted-foreground"}`}
                    >
                      {stats.approvalPending}
                    </Badge>
                  </div>
                  {stats.approvalPending > 0 && (
                    <p className="text-[10px] text-amber-400/60 mt-1.5">
                      {stats.approvalPending} item{stats.approvalPending > 1 ? "s" : ""} awaiting your review
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ─── Bottom Row: Budget + Live Feed ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Budget Burn Rate */}
            <Card className="border-purple-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="h-3.5 w-3.5 text-amber-400" />
                  Budget Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Total Budget</span>
                  <span className="font-mono font-bold text-white">${stats.totalBudget.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Total Spent</span>
                  <span className="font-mono font-bold text-amber-400">${stats.totalSpent.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Remaining</span>
                  <span className={`font-mono font-bold ${(stats.totalBudget - stats.totalSpent) / stats.totalBudget < 0.2 ? "text-red-400" : "text-emerald-400"}`}>
                    ${(stats.totalBudget - stats.totalSpent).toFixed(2)}
                  </span>
                </div>
                <Separator className="bg-border/50" />
                <div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Budget Used</span>
                    <span>{stats.totalBudget > 0 ? Math.round((stats.totalSpent / stats.totalBudget) * 100) : 0}%</span>
                  </div>
                  <Progress
                    value={stats.totalBudget > 0 ? Math.min((stats.totalSpent / stats.totalBudget) * 100, 100) : 0}
                    className={`h-2 ${stats.totalSpent / stats.totalBudget > 0.8 ? "[&>div]:bg-red-500" : stats.totalSpent / stats.totalBudget > 0.5 ? "[&>div]:bg-amber-500" : ""}`}
                  />
                </div>
                {/* Budget health indicator */}
                <div className="flex items-center gap-1.5">
                  {stats.totalBudget > 0 && stats.totalSpent / stats.totalBudget < 0.5 ? (
                    <>
                      <TrendingUp className="h-3 w-3 text-emerald-400" />
                      <span className="text-[10px] text-emerald-400">Budget healthy</span>
                    </>
                  ) : stats.totalBudget > 0 && stats.totalSpent / stats.totalBudget < 0.8 ? (
                    <>
                      <AlertTriangle className="h-3 w-3 text-amber-400" />
                      <span className="text-[10px] text-amber-400">Approaching limit</span>
                    </>
                  ) : stats.totalBudget > 0 ? (
                    <>
                      <XCircle className="h-3 w-3 text-red-400" />
                      <span className="text-[10px] text-red-400">Budget critical</span>
                    </>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">No budget set</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Live Event Feed */}
            <Card className="lg:col-span-2 border-purple-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Timer className="h-3.5 w-3.5 text-cyan-400" />
                  Live Event Feed
                  {stats.recentEvents.length > 0 && (
                    <Badge variant="secondary" className="text-xs bg-cyan-500/20 text-cyan-400">
                      {stats.recentEvents.length} recent
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.recentEvents.length === 0 ? (
                  <div className="flex flex-col items-center py-6 text-center">
                    <Clock className="h-6 w-6 text-muted-foreground/30 mb-1" />
                    <p className="text-xs text-muted-foreground">No recent events</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[220px]">
                    <div className="space-y-0 pl-4 relative">
                      {/* Timeline line */}
                      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border/50" />
                      {stats.recentEvents.slice(0, 15).map((event, idx) => (
                        <motion.div
                          key={event.id}
                          className="relative flex gap-3 pb-2.5 last:pb-0"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.02 }}
                        >
                          <div className="relative z-10 mt-0.5">
                            <div className={`h-[13px] w-[13px] rounded-full border-2 flex items-center justify-center ${
                              event.level === "success" ? "border-emerald-500/50 bg-emerald-500/20" :
                              event.level === "error" ? "border-red-500/50 bg-red-500/20" :
                              event.level === "warn" ? "border-amber-500/50 bg-amber-500/20" :
                              "border-blue-500/50 bg-blue-500/20"
                            }`}>
                              <div className="scale-[0.5]">
                                {event.level === "success" ? <CheckCircle className="h-2 w-2 text-emerald-400" /> :
                                 event.level === "error" ? <XCircle className="h-2 w-2 text-red-400" /> :
                                 event.level === "warn" ? <AlertTriangle className="h-2 w-2 text-amber-400" /> :
                                 <Clock className="h-2 w-2 text-blue-400" />}
                              </div>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium truncate text-foreground/90">{event.title}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {event.missionTitle && (
                                <span className="text-[9px] text-purple-400 truncate max-w-[100px]">{event.missionTitle}</span>
                              )}
                              <span className="text-[9px] text-muted-foreground">{timeAgo(event.createdAt)}</span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground text-sm">Failed to load command center data</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  KPI Card
// ─────────────────────────────────────────────

function KPICard({ icon, label, value, decimals = 0, prefix = "", suffix = "", color, bgColor, borderColor, pulse }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  color: string;
  bgColor: string;
  borderColor: string;
  pulse?: boolean;
}) {
  return (
    <Card className={`border ${borderColor}`}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className={`p-1.5 rounded-lg ${bgColor}`}>
            {icon}
          </div>
          {pulse && (
            <div className="flex items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[9px] text-cyan-400">LIVE</span>
            </div>
          )}
        </div>
        <p className={`text-lg font-bold font-mono ${color}`}>
          <AnimatedCounter value={value} decimals={decimals} prefix={prefix} suffix={suffix} />
        </p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
//  Active Mission Card
// ─────────────────────────────────────────────

function ActiveMissionCard({ mission, onClick }: {
  mission: ActiveMissionSummary;
  onClick: () => void;
}) {
  const statusConfig = MISSION_STATUS_CONFIG[mission.status];
  const progressPercent = mission.totalTasks > 0
    ? Math.round(((mission.completedTasks + mission.failedTasks) / mission.totalTasks) * 100)
    : 0;

  return (
    <motion.div
      whileHover={{ scale: 1.005 }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      className="p-3 rounded-lg border border-border/50 hover:border-purple-500/30 cursor-pointer transition-colors bg-card/50"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className={`h-2 w-2 rounded-full ${
            mission.status === "EXECUTING" ? "bg-cyan-400 animate-pulse" :
            mission.status === "PAUSED" ? "bg-yellow-400" :
            mission.status === "REPAIRING" ? "bg-orange-400 animate-pulse" :
            "bg-purple-400"
          }`} />
          <p className="text-sm font-medium truncate">{mission.title}</p>
        </div>
        <Badge
          variant="secondary"
          className={`text-[10px] shrink-0 ${statusConfig?.bgColor || ""} ${statusConfig?.color || ""}`}
        >
          {statusConfig?.label || mission.status}
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
          <span>{mission.completedTasks}/{mission.totalTasks} tasks</span>
          <span>{progressPercent}%</span>
        </div>
        <Progress value={progressPercent} className="h-1" />
      </div>

      {/* Meta info */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <div className="flex items-center gap-2">
          {mission.currentTask && (
            <span className="flex items-center gap-1">
              <Cpu className="h-2.5 w-2.5" />
              <span className="truncate max-w-[120px]">{mission.currentTask}</span>
            </span>
          )}
          {mission.spentUsd > 0 && (
            <span className="flex items-center gap-0.5">
              <DollarSign className="h-2.5 w-2.5" />
              {mission.spentUsd.toFixed(2)}
              {mission.budgetUsd && ` / $${mission.budgetUsd.toFixed(0)}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Eye className="h-2.5 w-2.5" />
          View
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
//  Loading Skeleton
// ─────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="border-border/50">
            <CardContent className="p-3">
              <Skeleton className="h-8 w-8 rounded-lg mb-2" />
              <Skeleton className="h-6 w-16 mb-1" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-border/50">
          <CardContent className="p-4">
            <Skeleton className="h-4 w-32 mb-4" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full mb-2 rounded-lg" />
            ))}
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <Skeleton className="h-4 w-24 mb-4" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full mb-2" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}
