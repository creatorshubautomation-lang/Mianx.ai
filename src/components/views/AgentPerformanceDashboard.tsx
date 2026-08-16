"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  BarChart3,
  Brain,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Zap,
  Target,
  Award,
  ChevronRight,
  ArrowLeft,
  Wrench,
  Hash,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Gauge,
  Timer,
  Sparkles,
  Flame,
  Medal,
  Filter,
  ArrowUpDown,
  Eye,
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

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

interface AgentPerfSummary {
  name: string;
  team: string;
  icon: string;
  color: string;
  totalMissions: number;
  activeMissions: number;
  completedMissions: number;
  failedMissions: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  runningTasks: number;
  successRate: number;
  avgTaskDurationMs: number;
  totalCostUsd: number;
  avgCostPerMission: number;
  totalToolCalls: number;
  toolCallSuccessRate: number;
  totalTokensUsed: number;
  avgTokensPerTask: number;
  avgReflectionScore: number;
  retryRate: number;
  mostUsedTools: { name: string; count: number }[];
  dailyActivity: { date: string; tasks: number; cost: number }[];
}

interface PerformanceOverview {
  agents: AgentPerfSummary[];
  totals: {
    totalAgents: number;
    totalMissions: number;
    totalTasks: number;
    avgSuccessRate: number;
    totalCost: number;
    totalTokens: number;
  };
  topPerformers: {
    fastest: string | null;
    mostReliable: string | null;
    mostUsed: string | null;
    mostEfficient: string | null;
  };
  timestamp: string;
}

interface AgentDetail {
  agent: {
    name: string;
    team: string;
    role: string;
    description: string;
    icon: string;
    color: string;
    capabilities: string;
  };
  summary: {
    totalMissions: number;
    activeMissions: number;
    completedMissions: number;
    failedMissions: number;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    runningTasks: number;
    successRate: number;
    avgTaskDurationMs: number;
    medianTaskDurationMs: number;
    p95TaskDurationMs: number;
    totalCostUsd: number;
    avgCostPerMission: number;
    avgCostPerTask: number;
    totalToolCalls: number;
    toolCallSuccessRate: number;
    totalTokensUsed: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    avgTokensPerTask: number;
    avgReflectionScore: number;
    retryRate: number;
    tasksWithRetries: number;
  };
  recentMissions: {
    id: string;
    title: string;
    status: string;
    progress: number;
    spentUsd: number;
    budgetUsd: number | null;
    totalTasks: number;
    completedTasks: number;
    createdAt: string;
    completedAt: string | null;
  }[];
  recentTasks: {
    id: string;
    title: string;
    status: string;
    missionTitle: string;
    durationMs: number | null;
    retryCount: number;
    riskLevel: string;
    outputType: string | null;
    startedAt: string | null;
    completedAt: string | null;
  }[];
  toolBreakdown: {
    toolName: string;
    totalCalls: number;
    successCalls: number;
    failedCalls: number;
    successRate: number;
    avgDurationMs: number;
    totalDurationMs: number;
  }[];
  tokenUsageOverTime: {
    date: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
  }[];
  statusDistribution: { status: string; count: number }[];
  riskDistribution: { risk: string; count: number }[];
  activityByHour: { hour: number; tasks: number }[];
  topMissionsByCost: {
    id: string;
    title: string;
    status: string;
    spentUsd: number;
    budgetUsd: number | null;
  }[];
}

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return ms + "ms";
  if (ms < 60_000) return (ms / 1000).toFixed(1) + "s";
  if (ms < 3_600_000) return Math.floor(ms / 60_000) + "m " + Math.floor((ms % 60_000) / 1000) + "s";
  return Math.floor(ms / 3_600_000) + "h " + Math.floor((ms % 3_600_000) / 60_000) + "m";
}

function formatCost(usd: number): string {
  return "$" + usd.toFixed(2);
}

function getSuccessColor(rate: number): string {
  if (rate >= 90) return "text-emerald-400";
  if (rate >= 70) return "text-yellow-400";
  return "text-red-400";
}

function getSuccessBg(rate: number): string {
  if (rate >= 90) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (rate >= 70) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  return "bg-red-500/20 text-red-400 border-red-500/30";
}

function getStatusIcon(status: string) {
  switch (status) {
    case "COMPLETED": return <CheckCircle className="h-4 w-4 text-emerald-400" />;
    case "FAILED": return <XCircle className="h-4 w-4 text-red-400" />;
    case "RUNNING": return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />;
    case "PENDING": case "READY": return <Clock className="h-4 w-4 text-muted-foreground" />;
    default: return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "COMPLETED": return "bg-emerald-500/20 text-emerald-400";
    case "FAILED": return "bg-red-500/20 text-red-400";
    case "RUNNING": return "bg-blue-500/20 text-blue-400";
    case "PENDING": case "READY": return "bg-muted text-muted-foreground";
    default: return "bg-yellow-500/20 text-yellow-400";
  }
}

function getRiskColor(risk: string): string {
  switch (risk) {
    case "LOW": return "bg-emerald-500/20 text-emerald-400";
    case "MEDIUM": return "bg-yellow-500/20 text-yellow-400";
    case "HIGH": return "bg-orange-500/20 text-orange-400";
    case "CRITICAL": return "bg-red-500/20 text-red-400";
    default: return "bg-muted text-muted-foreground";
  }
}

// Mini bar chart component (CSS only)
function MiniBarChart({ data, maxValue, height = 40, colorClass = "bg-purple-500" }: {
  data: number[];
  maxValue: number;
  height?: number;
  colorClass?: string;
}) {
  if (data.length === 0) return <div className="text-xs text-muted-foreground">No data</div>;
  const max = maxValue || Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[2px]" style={{ height }}>
      {data.map((val, i) => (
        <Tooltip key={i}>
          <TooltipTrigger>
            <div
              className={`${colorClass} rounded-t-sm min-w-[4px] flex-1 transition-all hover:opacity-80`}
              style={{ height: `${(val / max) * 100}%` }}
            />
          </TooltipTrigger>
          <TooltipContent className="text-xs">
            {val} ({data.length - i}d ago)
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

// Horizontal bar for distributions
function DistributionBar({ label, value, max, color }: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-24 text-right text-muted-foreground shrink-0">{label}</span>
      <div className="flex-1 h-5 bg-muted/50 rounded-sm overflow-hidden">
        <motion.div
          className={`h-full rounded-sm ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
      <span className="w-10 text-right font-mono text-xs">{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Sortable Table Header
// ─────────────────────────────────────────────

type SortKey = "name" | "team" | "totalTasks" | "successRate" | "avgTaskDurationMs" | "totalCostUsd" | "totalToolCalls" | "totalTokensUsed" | "totalMissions";

function SortableHeader({ label, sortKey, currentSort, currentDir, onSort }: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey | null;
  currentDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
}) {
  return (
    <button
      className="flex items-center gap-1 hover:text-purple-400 transition-colors text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
      onClick={() => onSort(sortKey)}
    >
      {label}
      {currentSort === sortKey && (
        <ArrowUpDown className="h-3 w-3" />
      )}
    </button>
  );
}

// ─────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────

export function AgentPerformanceDashboard() {
  const { navigate, selectedAgentName, setSelectedAgentName } = useApp();
  const [overview, setOverview] = useState<PerformanceOverview | null>(null);
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [period, setPeriod] = useState("30d");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("totalTasks");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [error, setError] = useState<string | null>(null);

  // ── Fetch overview data ──
  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/performance?period=${period}`);
      if (!res.ok) throw new Error("Failed to fetch performance data");
      const data = await res.json();
      setOverview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [period]);

  // ── Fetch agent detail ──
  const fetchDetail = useCallback(async (agentName: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/agents/performance/${encodeURIComponent(agentName)}?period=${period}`);
      if (!res.ok) throw new Error("Failed to fetch agent detail");
      const data = await res.json();
      setDetail(data);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    if (selectedAgentName) {
      fetchDetail(selectedAgentName);
    } else {
      setDetail(null);
    }
  }, [selectedAgentName, fetchDetail]);

  // ── Handle agent selection ──
  const handleAgentClick = (agentName: string) => {
    setSelectedAgentName(agentName);
    navigate("agentPerformance", { name: agentName });
  };

  const handleBack = () => {
    setSelectedAgentName(null);
    navigate("agentPerformance");
  };

  // ── Sorting ──
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  // ── Filtered + sorted agents ──
  const filteredAgents = useMemo(() => {
    if (!overview) return [];
    let agents = [...overview.agents];

    if (teamFilter !== "all") {
      agents = agents.filter((a) => a.team === teamFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      agents = agents.filter(
        (a) => a.name.toLowerCase().includes(q) || a.team.toLowerCase().includes(q)
      );
    }

    agents.sort((a, b) => {
      let aVal: string | number = a[sortKey] ?? "";
      let bVal: string | number = b[sortKey] ?? "";
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      if (sortDir === "asc") return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    });

    return agents;
  }, [overview, teamFilter, searchQuery, sortKey, sortDir]);

  // ── Unique teams ──
  const teams = useMemo(() => {
    if (!overview) return [];
    return [...new Set(overview.agents.map((a) => a.team))].sort();
  }, [overview]);

  // ─────────────────────────────────────────────
  //  LOADING STATE
  // ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <Skeleton className="h-7 w-48 mb-1" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="h-12 w-12 text-yellow-400" />
        <p className="text-lg font-medium">{error}</p>
        <Button onClick={fetchOverview} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  //  AGENT DETAIL VIEW
  // ─────────────────────────────────────────────

  if (selectedAgentName && detail) {
    const s = detail.summary;
    const maxDailyActivity = Math.max(...detail.tokenUsageOverTime.map((d) => d.inputTokens + d.outputTokens), 1);
    const maxHourlyActivity = Math.max(...detail.activityByHour.map((h) => h.tasks), 1);
    const maxStatusCount = Math.max(...detail.statusDistribution.map((d) => d.count), 1);
    const maxRiskCount = Math.max(...detail.riskDistribution.map((d) => d.count), 1);

    return (
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack} className="shrink-0">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-8" />
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${detail.agent.color} flex items-center justify-center shrink-0`}>
              <span className="text-2xl">{detail.agent.icon}</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold truncate">{detail.agent.name}</h2>
              <p className="text-sm text-muted-foreground">{detail.agent.role} &middot; {detail.agent.team}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{detail.agent.team}</Badge>
              <Badge className={`${getSuccessBg(s.successRate)} border`}>
                {s.successRate}% success
              </Badge>
            </div>
          </div>
        </div>

        {/* Description */}
        <Card className="glass-card">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{detail.agent.description}</p>
            {detail.agent.capabilities && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {(() => {
                  try {
                    const caps = JSON.parse(detail.agent.capabilities);
                    return caps.slice(0, 8).map((c: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
                    ));
                  } catch { return null; }
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { icon: Target, label: "Missions", value: s.totalMissions, sub: `${s.activeMissions} active`, color: "text-purple-400" },
            { icon: CheckCircle, label: "Tasks", value: s.totalTasks, sub: `${s.completedTasks} done`, color: "text-emerald-400" },
            { icon: TrendingUp, label: "Success Rate", value: `${s.successRate}%`, sub: `${s.retryRate}% retry rate`, color: getSuccessColor(s.successRate) },
            { icon: Clock, label: "Avg Duration", value: formatDuration(s.avgTaskDurationMs), sub: `P95: ${formatDuration(s.p95TaskDurationMs)}`, color: "text-blue-400" },
            { icon: DollarSign, label: "Total Cost", value: formatCost(s.totalCostUsd), sub: `${formatCost(s.avgCostPerMission)}/mission`, color: "text-yellow-400" },
            { icon: Wrench, label: "Tool Calls", value: s.totalToolCalls, sub: `${s.toolCallSuccessRate}% success`, color: "text-cyan-400" },
            { icon: Hash, label: "Tokens Used", value: formatNumber(s.totalTokensUsed), sub: `${formatNumber(s.avgTokensPerTask)}/task`, color: "text-violet-400" },
            { icon: Brain, label: "Reflection", value: s.avgReflectionScore > 0 ? s.avgReflectionScore.toFixed(2) : "N/A", sub: "Avg score", color: "text-pink-400" },
            { icon: Flame, label: "Running", value: s.runningTasks, sub: `${s.failedTasks} failed`, color: "text-orange-400" },
            { icon: Zap, label: "Median Time", value: formatDuration(s.medianTaskDurationMs), sub: `of completed tasks`, color: "text-lime-400" },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card className="glass-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                    <span className="text-xs text-muted-foreground">{stat.label}</span>
                  </div>
                  <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{stat.sub}</div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Token Usage Over Time */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Hash className="h-4 w-4 text-violet-400" />
                Token Usage (14 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MiniBarChart
                data={detail.tokenUsageOverTime.map((d) => d.inputTokens + d.outputTokens)}
                maxValue={maxDailyActivity}
                height={80}
                colorClass="bg-violet-500"
              />
              <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                {detail.tokenUsageOverTime.filter((_, i) => i % 3 === 0).map((d, i) => (
                  <span key={i}>{d.date.slice(5)}</span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Activity by Hour */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-400" />
                Task Activity by Hour
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-[2px] h-[80px]">
                {detail.activityByHour.map((h, i) => (
                  <Tooltip key={i}>
                    <TooltipTrigger>
                      <div
                        className={`rounded-t-sm min-w-[6px] flex-1 transition-all hover:opacity-80 ${
                          h.tasks > 0 ? "bg-blue-500" : "bg-muted/30"
                        }`}
                        style={{ height: `${(h.tasks / maxHourlyActivity) * 100}%` }}
                      />
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">
                      {h.hour}:00 — {h.tasks} tasks
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>23:00</span>
              </div>
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-400" />
                Task Status Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {detail.statusDistribution.map((d) => (
                <DistributionBar
                  key={d.status}
                  label={d.status}
                  value={d.count}
                  max={maxStatusCount}
                  color={getStatusColor(d.status)}
                />
              ))}
            </CardContent>
          </Card>

          {/* Risk Distribution */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
                Risk Level Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {detail.riskDistribution.map((d) => (
                <DistributionBar
                  key={d.risk}
                  label={d.risk}
                  value={d.count}
                  max={maxRiskCount}
                  color={getRiskColor(d.risk)}
                />
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Tool Breakdown */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wrench className="h-4 w-4 text-cyan-400" />
              Tool Usage Breakdown
            </CardTitle>
            <CardDescription>Tools this agent uses, sorted by call frequency</CardDescription>
          </CardHeader>
          <CardContent>
            {detail.toolBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No tool calls recorded in this period</p>
            ) : (
              <div className="space-y-3">
                {detail.toolBreakdown.map((tool) => (
                  <div key={tool.toolName} className="flex items-center gap-4">
                    <div className="w-36 text-sm font-mono truncate">{tool.toolName}</div>
                    <div className="flex-1">
                      <div className="flex gap-1 h-6">
                        <Tooltip>
                          <TooltipTrigger>
                            <motion.div
                              className="bg-emerald-500 rounded-l-sm h-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${tool.successRate}%` }}
                              transition={{ duration: 0.5 }}
                            />
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">{tool.successCalls} success</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger>
                            <motion.div
                              className="bg-red-500 rounded-r-sm h-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${100 - tool.successRate}%` }}
                              transition={{ duration: 0.5 }}
                            />
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">{tool.failedCalls} failed</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                    <div className="w-20 text-right text-xs text-muted-foreground">
                      {tool.totalCalls} calls
                    </div>
                    <div className="w-24 text-right text-xs text-muted-foreground">
                      avg {formatDuration(tool.avgDurationMs)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Missions */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-purple-400" />
              Recent Missions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {detail.recentMissions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No missions in this period</p>
            ) : (
              <ScrollArea className="max-h-64">
                <div className="space-y-2">
                  {detail.recentMissions.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      {getStatusIcon(m.status)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.totalTasks} tasks &middot; {m.completedTasks} done &middot; {formatCost(m.spentUsd)}
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-xs ${getStatusColor(m.status)}`}>
                        {m.status}
                      </Badge>
                      <Progress value={m.progress} className="w-16 h-2" />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Recent Tasks */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-400" />
              Recent Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {detail.recentTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No tasks in this period</p>
            ) : (
              <ScrollArea className="max-h-80">
                <div className="space-y-1.5">
                  {detail.recentTasks.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors text-sm">
                      {getStatusIcon(t.status)}
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{t.title}</p>
                        <p className="text-xs text-muted-foreground">{t.missionTitle}</p>
                      </div>
                      <Badge variant="outline" className={`text-xs shrink-0 ${getStatusColor(t.status)}`}>
                        {t.status}
                      </Badge>
                      {t.retryCount > 0 && (
                        <Badge variant="outline" className="text-xs text-orange-400 border-orange-500/30 shrink-0">
                          {t.retryCount} retries
                        </Badge>
                      )}
                      <Badge variant="outline" className={`text-xs shrink-0 ${getRiskColor(t.riskLevel)}`}>
                        {t.riskLevel}
                      </Badge>
                      {t.durationMs && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatDuration(t.durationMs)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  //  OVERVIEW VIEW
  // ─────────────────────────────────────────────

  const topPerformerIcons: Record<string, typeof Flame> = {
    fastest: Gauge,
    mostReliable: Medal,
    mostUsed: Flame,
    mostEfficient: Sparkles,
  };

  const topPerformerLabels: Record<string, string> = {
    fastest: "Fastest Agent",
    mostReliable: "Most Reliable",
    mostUsed: "Most Active",
    mostEfficient: "Most Cost-Efficient",
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Agent Performance Dashboard</h2>
            <p className="text-sm text-muted-foreground">
              Per-agent analytics across missions, tasks, tools, and costs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="flex items-center bg-muted/50 rounded-lg p-0.5">
            {["7d", "30d", "90d", "all"].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  period === p
                    ? "bg-purple-500 text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p === "all" ? "All Time" : p === "7d" ? "7 Days" : p === "30d" ? "30 Days" : "90 Days"}
              </button>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={fetchOverview} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview stat cards */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { icon: Sparkles, label: "Total Agents", value: overview.totals.totalAgents, color: "text-purple-400" },
            { icon: Target, label: "Total Missions", value: formatNumber(overview.totals.totalMissions), color: "text-cyan-400" },
            { icon: Zap, label: "Total Tasks", value: formatNumber(overview.totals.totalTasks), color: "text-emerald-400" },
            { icon: TrendingUp, label: "Avg Success", value: `${overview.totals.avgSuccessRate}%`, color: getSuccessColor(overview.totals.avgSuccessRate) },
            { icon: DollarSign, label: "Total Cost", value: formatCost(overview.totals.totalCost), color: "text-yellow-400" },
            { icon: Hash, label: "Total Tokens", value: formatNumber(overview.totals.totalTokens), color: "text-violet-400" },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="glass-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                    <span className="text-xs text-muted-foreground">{stat.label}</span>
                  </div>
                  <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Top performers */}
      {overview && (overview.topPerformers.fastest || overview.topPerformers.mostReliable) && (
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Award className="h-4 w-4 text-yellow-400" />
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Object.entries(overview.topPerformers).map(([key, name]) => {
                const Icon = topPerformerIcons[key] || Sparkles;
                return (
                  <button
                    key={key}
                    onClick={() => name && handleAgentClick(name)}
                    disabled={!name}
                    className={`text-left p-3 rounded-lg border border-purple-500/20 hover:border-purple-500/40 transition-all hover:bg-purple-500/5 ${!name ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-4 w-4 text-yellow-400" />
                      <span className="text-xs text-muted-foreground">{topPerformerLabels[key]}</span>
                    </div>
                    <div className="text-sm font-semibold text-purple-300 truncate">{name || "N/A"}</div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Filter:</span>
        </div>
        <div className="flex items-center bg-muted/50 rounded-lg p-0.5">
          <button
            onClick={() => setTeamFilter("all")}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              teamFilter === "all" ? "bg-purple-500 text-white" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All Teams
          </button>
          {teams.map((team) => (
            <button
              key={team}
              onClick={() => setTeamFilter(team)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                teamFilter === team ? "bg-purple-500 text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {team}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search agents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3 py-1.5 text-xs bg-muted/50 border border-purple-500/20 rounded-lg focus:outline-none focus:border-purple-500/50 w-48"
        />
        <span className="text-xs text-muted-foreground ml-auto">
          {filteredAgents.length} agent{filteredAgents.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Agent comparison table */}
      <Card className="glass-card overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-purple-500/10">
                  <th className="text-left p-3 w-48">
                    <SortableHeader label="Agent" sortKey="name" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-left p-3 w-28">
                    <SortableHeader label="Team" sortKey="team" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-right p-3 w-24">
                    <SortableHeader label="Missions" sortKey="totalMissions" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-right p-3 w-24">
                    <SortableHeader label="Tasks" sortKey="totalTasks" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-right p-3 w-28">
                    <SortableHeader label="Success %" sortKey="successRate" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-right p-3 w-28">
                    <SortableHeader label="Avg Time" sortKey="avgTaskDurationMs" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-right p-3 w-28">
                    <SortableHeader label="Cost" sortKey="totalCostUsd" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-right p-3 w-24">
                    <SortableHeader label="Tools" sortKey="totalToolCalls" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-right p-3 w-24">
                    <SortableHeader label="Tokens" sortKey="totalTokensUsed" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-center p-3 w-32">Activity (14d)</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredAgents.map((agent, i) => {
                    const maxDaily = Math.max(...agent.dailyActivity.map((d) => d.tasks), 1);
                    return (
                      <motion.tr
                        key={agent.name}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="border-b border-purple-500/5 hover:bg-purple-500/5 transition-colors cursor-pointer group"
                        onClick={() => handleAgentClick(agent.name)}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${agent.color} flex items-center justify-center shrink-0 text-sm`}>
                              {agent.icon}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate group-hover:text-purple-400 transition-colors">
                                {agent.name}
                              </div>
                              <div className="text-[10px] text-muted-foreground">{agent.runningTasks} running</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-xs">{agent.team}</Badge>
                        </td>
                        <td className="p-3 text-right">
                          <div className="text-sm font-mono">{agent.totalMissions}</div>
                          <div className="text-[10px] text-emerald-400">{agent.completedMissions} done</div>
                        </td>
                        <td className="p-3 text-right">
                          <div className="text-sm font-mono">{agent.totalTasks}</div>
                          <div className="text-[10px] text-muted-foreground">{agent.completedTasks}/{agent.totalTasks}</div>
                        </td>
                        <td className="p-3 text-right">
                          <span className={`text-sm font-mono font-medium ${getSuccessColor(agent.successRate)}`}>
                            {agent.successRate}%
                          </span>
                          <Progress value={agent.successRate} className="h-1 mt-1" />
                        </td>
                        <td className="p-3 text-right text-sm text-muted-foreground">
                          {agent.avgTaskDurationMs > 0 ? formatDuration(agent.avgTaskDurationMs) : "—"}
                        </td>
                        <td className="p-3 text-right text-sm font-mono text-yellow-400">
                          {agent.totalCostUsd > 0 ? formatCost(agent.totalCostUsd) : "—"}
                        </td>
                        <td className="p-3 text-right text-sm font-mono text-muted-foreground">
                          {agent.totalToolCalls > 0 ? formatNumber(agent.totalToolCalls) : "—"}
                        </td>
                        <td className="p-3 text-right text-sm font-mono text-muted-foreground">
                          {agent.totalTokensUsed > 0 ? formatNumber(agent.totalTokensUsed) : "—"}
                        </td>
                        <td className="p-3">
                          <MiniBarChart
                            data={agent.dailyActivity.map((d) => d.tasks)}
                            maxValue={maxDaily}
                            height={24}
                            colorClass="bg-purple-500/60"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-purple-400 transition-colors" />
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
                {filteredAgents.length === 0 && (
                  <tr>
                    <td colSpan={11} className="p-12 text-center text-muted-foreground">
                      <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No agents match your filters</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Agent cards (detailed view) */}
      {filteredAgents.length > 0 && filteredAgents.length <= 8 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredAgents.map((agent, i) => {
              const maxDaily = Math.max(...agent.dailyActivity.map((d) => d.tasks), 1);
              return (
                <motion.div
                  key={agent.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card
                    className="glass-card cursor-pointer hover:border-purple-500/30 transition-all group"
                    onClick={() => handleAgentClick(agent.name)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${agent.color} flex items-center justify-center shrink-0`}>
                          <span className="text-lg">{agent.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-sm group-hover:text-purple-400 transition-colors truncate">
                            {agent.name}
                          </CardTitle>
                          <CardDescription className="text-xs">{agent.team} &middot; {agent.totalMissions} missions</CardDescription>
                        </div>
                        <Badge className={`${getSuccessBg(agent.successRate)} border text-xs`}>
                          {agent.successRate}%
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Mini stats */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-sm font-bold text-emerald-400">{agent.completedTasks}</div>
                          <div className="text-[10px] text-muted-foreground">Completed</div>
                        </div>
                        <div>
                          <div className="text-sm font-bold text-blue-400">
                            {agent.avgTaskDurationMs > 0 ? formatDuration(agent.avgTaskDurationMs) : "—"}
                          </div>
                          <div className="text-[10px] text-muted-foreground">Avg Time</div>
                        </div>
                        <div>
                          <div className="text-sm font-bold text-yellow-400">
                            {agent.totalCostUsd > 0 ? formatCost(agent.totalCostUsd) : "—"}
                          </div>
                          <div className="text-[10px] text-muted-foreground">Cost</div>
                        </div>
                      </div>

                      {/* Activity sparkline */}
                      <MiniBarChart
                        data={agent.dailyActivity.map((d) => d.tasks)}
                        maxValue={maxDaily}
                        height={24}
                        colorClass="bg-purple-500/60"
                      />

                      {/* Top tools */}
                      {agent.mostUsedTools.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {agent.mostUsedTools.slice(0, 3).map((tool, j) => (
                            <Badge key={j} variant="secondary" className="text-[10px]">
                              <Wrench className="h-3 w-3 mr-1" />
                              {tool.name}
                              <span className="ml-1 text-muted-foreground">({tool.count})</span>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
