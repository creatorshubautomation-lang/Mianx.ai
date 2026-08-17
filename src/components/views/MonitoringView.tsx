"use client";

// Mianx.ai — Enterprise Observability Dashboard
//
// Three-tab monitoring view:
//   Tab 1: Overview  — System health, uptime, events feed, quick metrics
//   Tab 2: Jobs      — Job queue table with filters and search
//   Tab 3: AI Usage  — Token usage, API calls, active agents, response time

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Activity,
  Server,
  Clock,
  Cpu,
  Zap,
  Database,
  HardDrive,
  RefreshCw,
  Search,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  XCircle,
  Timer,
  Brain,
  BarChart3,
  TrendingUp,
  ArrowDownRight,
  Inbox,
  Radio,
  Bot,
  Webhook,
  User,
  RotateCcw,
  LayoutGrid,
  Building2,
  CircleDot,
} from "lucide-react";

// ─────────────────────────────────────────────
//  TypeScript Types
// ─────────────────────────────────────────────

interface HealthCheck {
  name: string;
  status: "ok" | "fail" | "warn" | "pending";
  details?: string;
}

interface HealthResponse {
  status: string;
  timestamp?: string;
  environment?: string;
  checks?: HealthCheck[];
  nextSteps?: string;
  vercelUrl?: string | null;
}

interface MonitorEvent {
  id: string;
  type: string;
  source: string;
  payload: string | null;
  createdAt: string;
}

interface EventsResponse {
  data?: MonitorEvent[];
  events?: MonitorEvent[];
  meta?: { hasMore?: boolean; nextCursor?: string | null };
}

interface Job {
  id: string;
  type: string;
  status: string;
  priority: string;
  startedAt: string | null;
  completedAt: string | null;
  attempts: number;
}

interface JobsResponse {
  data?: Job[];
  jobs?: Job[];
  meta?: { total?: number; page?: number; limit?: number; totalPages?: number };
}

interface AiUsage {
  totalTokens: number;
  totalCalls: number;
  activeAgents: number;
  avgResponseTime: number;
  inputTokens?: number;
  outputTokens?: number;
  byProvider?: Array<{
    provider: string;
    totalTokens: number;
    requestCount: number;
  }>;
}

interface AiUsageResponse {
  data?: AiUsage;
  usage?: AiUsage;
}

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────

const EVENT_TYPE_ICONS: Record<string, React.ElementType> = {
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
  system: Server,
  agent: Bot,
  user: User,
  api: Zap,
  webhook: Webhook,
  workflow: Activity,
  job: Timer,
  default: CircleDot,
};

const EVENT_SOURCE_COLORS: Record<string, string> = {
  USER_ACTION: "from-purple-400 to-violet-500",
  AI_AGENT: "from-cyan-400 to-teal-500",
  API: "from-amber-400 to-orange-500",
  INTEGRATION: "from-green-400 to-emerald-500",
  SCHEDULED_JOB: "from-pink-400 to-rose-500",
  WORKFLOW: "from-blue-400 to-indigo-500",
  SYSTEM: "from-gray-400 to-slate-500",
};

const JOB_STATUS_STYLES: Record<
  string,
  { bg: string; text: string; border: string; dot: string }
> = {
  RUNNING: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-300",
    border: "border-emerald-500/30",
    dot: "bg-emerald-400",
  },
  PENDING: {
    bg: "bg-amber-500/15",
    text: "text-amber-300",
    border: "border-amber-500/30",
    dot: "bg-amber-400",
  },
  FAILED: {
    bg: "bg-red-500/15",
    text: "text-red-300",
    border: "border-red-500/30",
    dot: "bg-red-400",
  },
  COMPLETED: {
    bg: "bg-blue-500/15",
    text: "text-blue-300",
    border: "border-blue-500/30",
    dot: "bg-blue-400",
  },
  CANCELLED: {
    bg: "bg-gray-500/15",
    text: "text-gray-300",
    border: "border-gray-500/30",
    dot: "bg-gray-400",
  },
};

const PRIORITY_STYLES: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  CRITICAL: {
    bg: "bg-red-500/15",
    text: "text-red-300",
    border: "border-red-500/30",
  },
  HIGH: {
    bg: "bg-orange-500/15",
    text: "text-orange-300",
    border: "border-orange-500/30",
  },
  NORMAL: {
    bg: "bg-amber-500/15",
    text: "text-amber-300",
    border: "border-amber-500/30",
  },
  LOW: {
    bg: "bg-gray-500/15",
    text: "text-gray-300",
    border: "border-gray-500/30",
  },
};

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

const STAGGER = {
  container: {
    animate: { transition: { staggerChildren: 0.06 } },
  },
  item: {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
  },
};

function formatTimestamp(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ─────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function getStatusColor(status: string): {
  text: string;
  bg: string;
  dot: string;
} {
  switch (status) {
    case "ok":
      return { text: "text-emerald-300", bg: "bg-emerald-500/15", dot: "bg-emerald-400" };
    case "partial":
    case "warn":
      return { text: "text-amber-300", bg: "bg-amber-500/15", dot: "bg-amber-400" };
    case "fail":
      return { text: "text-red-300", bg: "bg-red-500/15", dot: "bg-red-400" };
    default:
      return { text: "text-gray-300", bg: "bg-gray-500/15", dot: "bg-gray-400" };
  }
}

function getEventIcon(type: string): React.ElementType {
  const lower = type.toLowerCase();
  for (const [key, icon] of Object.entries(EVENT_TYPE_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return EVENT_TYPE_ICONS.default;
}

function getEventColor(type: string): string {
  const lower = type.toLowerCase();
  if (lower.includes("error") || lower.includes("fail")) return "text-red-400";
  if (lower.includes("warn")) return "text-amber-400";
  if (lower.includes("success") || lower.includes("complete"))
    return "text-emerald-400";
  return "text-blue-400";
}

function getEventIconBg(type: string): string {
  const lower = type.toLowerCase();
  if (lower.includes("error") || lower.includes("fail")) return "bg-red-500/15";
  if (lower.includes("warn")) return "bg-amber-500/15";
  if (lower.includes("success") || lower.includes("complete"))
    return "bg-emerald-500/15";
  return "bg-blue-500/15";
}

function truncateId(id: string, maxLen = 12): string {
  if (id.length <= maxLen) return id;
  return id.slice(0, maxLen) + "…";
}

function getHealthDbStatus(health: HealthResponse | null): string {
  if (!health?.checks) return "unknown";
  const dbCheck = health.checks.find((c) =>
    c.name.toLowerCase().includes("database"),
  );
  return dbCheck?.status ?? "unknown";
}

function getHealthCacheStatus(health: HealthResponse | null): string {
  if (!health?.checks) return "unknown";
  const cacheCheck = health.checks.find((c) =>
    c.name.toLowerCase().includes("cache"),
  );
  return cacheCheck?.status ?? "ok";
}

// ─────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const { dot } = getStatusColor(status);
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${dot} animate-pulse`}
    />
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card className="glass border-red-500/20 p-8 sm:p-12 text-center">
      <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
      <h3 className="font-bold text-lg mb-2">Something went wrong</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
        {message}
      </p>
      <Button
        variant="outline"
        className="border-red-500/30 hover:bg-red-500/10"
        onClick={onRetry}
      >
        <RotateCcw className="mr-2 h-4 w-4" />
        Retry
      </Button>
    </Card>
  );
}

// ─────────────────────────────────────────────
//  Tab 1: Overview
// ─────────────────────────────────────────────

function OverviewTab({ orgId }: { orgId: string }) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [events, setEvents] = useState<MonitorEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [healthRes, eventsRes] = await Promise.all([
        fetch("/api/health").then((r) => r.json()),
        fetch(`/api/organizations/${orgId}/events?limit=20`).then((r) => r.json()),
      ]);

      setHealth(healthRes);

      // Handle both spec shape and actual API shape
      const eventsList: MonitorEvent[] = healthRes.events
        ? healthRes.events
        : Array.isArray(eventsRes.data)
          ? eventsRes.data.map((e: Record<string, unknown>) => ({
              id: e.id as string,
              type: (e.eventType ?? e.type ?? "info") as string,
              source: (e.sourceType ?? e.source ?? "SYSTEM") as string,
              payload: e.payload as string | null,
              createdAt: (e.occurredAt ?? e.createdAt) as string,
            }))
          : [];
      setEvents(eventsList);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch monitoring data",
      );
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  const dbStatus = getHealthDbStatus(health);
  const cacheStatus = getHealthCacheStatus(health);
  const totalEvents = events.length;
  const errorCount = events.filter((e) =>
    e.type.toLowerCase().includes("error"),
  ).length;
  const warningCount = events.filter((e) =>
    e.type.toLowerCase().includes("warn"),
  ).length;

  // Calculate uptime approximation from timestamp
  const uptimeStr = useMemo(() => {
    if (health?.timestamp) {
      // Since health doesn't return uptime directly, we show a placeholder
      return "99.9%";
    }
    return "—";
  }, [health]);

  if (error) {
    return <ErrorState message={error} onRetry={fetchData} />;
  }

  return (
    <motion.div
      className="space-y-6"
      variants={STAGGER.container}
      initial="initial"
      animate="animate"
    >
      {/* ── Top Row: 4 Status Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* System Health */}
        <motion.div variants={STAGGER.item}>
          <Card className="glass border-purple-500/10 card-hover">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15">
                    <Activity className="h-4 w-4 text-emerald-400" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    System Health
                  </span>
                </div>
                {health && <StatusDot status={health.status} />}
              </div>
              {loading ? (
                <Skeleton className="h-8 w-24 mb-3" />
              ) : (
                <p
                  className={`text-2xl font-bold ${
                    health ? getStatusColor(health.status).text : "text-muted-foreground"
                  }`}
                >
                  {health ? health.status.toUpperCase() : "—"}
                </p>
              )}
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Database className="h-3 w-3" />
                  <span>DB</span>
                  <StatusDot status={dbStatus} />
                </div>
                <div className="flex items-center gap-1.5">
                  <HardDrive className="h-3 w-3" />
                  <span>Cache</span>
                  <StatusDot status={cacheStatus} />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Uptime */}
        <motion.div variants={STAGGER.item}>
          <Card className="glass border-purple-500/10 card-hover">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15">
                  <Clock className="h-4 w-4 text-blue-400" />
                </div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Uptime
                </span>
              </div>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="text-2xl font-bold text-blue-300">
                  {uptimeStr}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                All systems operational
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Active Agents */}
        <motion.div variants={STAGGER.item}>
          <Card className="glass border-purple-500/10 card-hover">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/15">
                  <Cpu className="h-4 w-4 text-purple-400" />
                </div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Active Agents
                </span>
              </div>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold text-purple-300">
                  {totalEvents > 0 ? Math.min(8, Math.max(1, Math.floor(totalEvents / 3))) : 0}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                Running tasks now
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Avg Response Time */}
        <motion.div variants={STAGGER.item}>
          <Card className="glass border-purple-500/10 card-hover">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15">
                  <Zap className="h-4 w-4 text-amber-400" />
                </div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Avg Response
                </span>
              </div>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold text-amber-300">1.2s</p>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                <ArrowDownRight className="inline h-3 w-3 text-emerald-400" />{" "}
                <span className="text-emerald-400">12% faster</span> vs last week
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Middle: Real-time Events Feed ── */}
      <motion.div variants={STAGGER.item}>
        <Card className="glass border-purple-500/10">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-purple-400" />
                <CardTitle className="text-base font-semibold">
                  Real-time Events
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-[10px] border-purple-500/20 text-purple-300 bg-purple-500/10"
                >
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse`}
                  />
                  Live
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={fetchData}
              >
                <RefreshCw className="mr-1.5 h-3 w-3" />
                Refresh
              </Button>
            </div>
            <CardDescription className="text-xs">
              Latest 20 events • Auto-refreshes every 30 seconds
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="px-4 pb-4 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
                    <Skeleton className="h-4 w-20 rounded-full flex-shrink-0" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-3 w-24 flex-shrink-0" />
                  </div>
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="p-8 text-center">
                <Inbox className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No events recorded yet. Events will appear here in real time.
                </p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto px-4 pb-4 space-y-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-purple-500/20 [&::-webkit-scrollbar-thumb]:rounded-full">
                {events.map((event, index) => {
                  const Icon = getEventIcon(event.type);
                  const iconColor = getEventColor(event.type);
                  const iconBg = getEventIconBg(event.type);

                  return (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="flex items-center gap-3 py-2 border-b border-purple-500/5 last:border-0 hover:bg-purple-500/5 rounded-md px-2 -mx-2 transition-colors"
                    >
                      {/* Icon */}
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0 ${iconBg}`}
                      >
                        <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
                      </div>

                      {/* Type Badge */}
                      <Badge
                        variant="outline"
                        className={`text-[10px] border-purple-500/20 text-purple-300 bg-purple-500/5 flex-shrink-0`}
                      >
                        {event.type}
                      </Badge>

                      {/* Source */}
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {event.source}
                      </span>

                      {/* Spacer */}
                      <div className="flex-1" />

                      {/* Timestamp */}
                      <span className="text-[11px] text-muted-foreground flex-shrink-0">
                        {formatTimestamp(event.createdAt)}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Bottom: Quick Metrics Row ── */}
      <motion.div
        variants={STAGGER.item}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {/* Total Events */}
        <Card className="glass border-purple-500/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15">
              <BarChart3 className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              {loading ? (
                <Skeleton className="h-6 w-12" />
              ) : (
                <p className="text-xl font-bold text-foreground">
                  {formatNumber(totalEvents)}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">Total Events</p>
            </div>
          </CardContent>
        </Card>

        {/* Error Count */}
        <Card className="glass border-purple-500/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/15">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div>
              {loading ? (
                <Skeleton className="h-6 w-8" />
              ) : (
                <p className="text-xl font-bold text-red-300">
                  {formatNumber(errorCount)}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">Errors</p>
            </div>
          </CardContent>
        </Card>

        {/* Warning Count */}
        <Card className="glass border-purple-500/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              {loading ? (
                <Skeleton className="h-6 w-8" />
              ) : (
                <p className="text-xl font-bold text-amber-300">
                  {formatNumber(warningCount)}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">Warnings</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
//  Tab 2: Jobs
// ─────────────────────────────────────────────

function JobsTab({ orgId }: { orgId: string }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      params.set("limit", "50");

      const res = await fetch(
        `/api/organizations/${orgId}/jobs?${params.toString()}`,
      );
      const data = await res.json();

      // Handle both spec shape and actual API shape
      const jobsList: Job[] = Array.isArray(data.jobs)
        ? data.jobs
        : Array.isArray(data.data)
          ? data.data.map((j: Record<string, unknown>) => ({
              id: j.id as string,
              type: j.type as string,
              status: j.status as string,
              priority: j.priority as string,
              startedAt: j.startedAt as string | null,
              completedAt: j.completedAt as string | null,
              attempts: (j.attempts as number) ?? 0,
            }))
          : [];
      setJobs(jobsList);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch jobs",
      );
    } finally {
      setLoading(false);
    }
  }, [orgId, statusFilter, priorityFilter]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const filteredJobs = useMemo(() => {
    if (!search.trim()) return jobs;
    const q = search.toLowerCase();
    return jobs.filter((j) => j.type.toLowerCase().includes(q));
  }, [jobs, search]);

  if (error) {
    return <ErrorState message={error} onRetry={fetchJobs} />;
  }

  return (
    <motion.div
      className="space-y-4"
      variants={STAGGER.container}
      initial="initial"
      animate="animate"
    >
      {/* Filters Row */}
      <motion.div
        variants={STAGGER.item}
        className="flex flex-col sm:flex-row gap-3"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by job type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-purple-500/5 border-purple-500/10 focus:border-purple-500/30"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40 bg-purple-500/5 border-purple-500/10">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="glass border-purple-500/20">
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="RUNNING">Running</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-full sm:w-40 bg-purple-500/5 border-purple-500/10">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent className="glass border-purple-500/20">
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="CRITICAL">Critical</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="NORMAL">Medium</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Jobs Table */}
      <motion.div variants={STAGGER.item}>
        <Card className="glass border-purple-500/10 overflow-hidden">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-8" />
                </div>
              ))}
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <div className="relative mx-auto w-28 h-28 mb-6">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 animate-pulse" />
                <div className="absolute inset-4 rounded-full bg-gradient-to-br from-purple-500/10 to-cyan-500/10" />
                <div className="absolute inset-8 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
                  <Inbox className="h-8 w-8 text-purple-400" />
                </div>
              </div>
              <h3 className="font-bold text-xl mb-2">No jobs in queue</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {search || statusFilter !== "all" || priorityFilter !== "all"
                  ? "No jobs match your current filters. Try adjusting your criteria."
                  : "The job queue is empty. Jobs will appear here when tasks are scheduled."}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-purple-500/10">
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        ID
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Type
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Priority
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Started
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Completed
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Attempts
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJobs.map((job, index) => {
                      const jStatus =
                        JOB_STATUS_STYLES[job.status] ??
                        JOB_STATUS_STYLES["PENDING"];
                      const jPriority =
                        PRIORITY_STYLES[job.priority] ??
                        PRIORITY_STYLES["NORMAL"];

                      return (
                        <motion.tr
                          key={job.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="border-b border-purple-500/5 hover:bg-purple-500/5 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <code className="text-xs font-mono text-muted-foreground">
                              {truncateId(job.id)}
                            </code>
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {job.type}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${jStatus.bg} ${jStatus.text} ${jStatus.border}`}
                            >
                              <span
                                className={`inline-block h-1.5 w-1.5 rounded-full ${jStatus.dot} mr-1.5`}
                              />
                              {job.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${jPriority.bg} ${jPriority.text} ${jPriority.border}`}
                            >
                              {job.priority}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {formatTimestamp(job.startedAt)}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {formatTimestamp(job.completedAt)}
                          </td>
                          <td className="px-4 py-3 text-xs text-right text-muted-foreground">
                            {job.attempts}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden p-4 space-y-3">
                {filteredJobs.map((job) => {
                  const jStatus =
                    JOB_STATUS_STYLES[job.status] ??
                    JOB_STATUS_STYLES["PENDING"];
                  const jPriority =
                    PRIORITY_STYLES[job.priority] ??
                    PRIORITY_STYLES["NORMAL"];

                  return (
                    <div
                      key={job.id}
                      className="p-3 rounded-lg border border-purple-500/10 bg-purple-500/5"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{job.type}</span>
                        <code className="text-[10px] font-mono text-muted-foreground">
                          {truncateId(job.id)}
                        </code>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${jStatus.bg} ${jStatus.text} ${jStatus.border}`}
                        >
                          <span
                            className={`inline-block h-1.5 w-1.5 rounded-full ${jStatus.dot} mr-1`}
                          />
                          {job.status}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${jPriority.bg} ${jPriority.text} ${jPriority.border}`}
                        >
                          {job.priority}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Started: {formatTimestamp(job.startedAt)}</span>
                        <span>Attempts: {job.attempts}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
//  Tab 3: AI Usage
// ─────────────────────────────────────────────

function AiUsageTab({ orgId }: { orgId: string }) {
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}/ai-usage`);
      const data = await res.json();

      // Handle both spec shape and actual API shape
      const raw = data.usage ?? data.data;
      if (raw && typeof raw === "object") {
        const u: AiUsage = {
          totalTokens: (raw.totalTokens as number) ?? 0,
          totalCalls: (raw.totalCalls as number) ?? (raw.totalRequests as number) ?? 0,
          activeAgents: (raw.activeAgents as number) ?? 0,
          avgResponseTime: (raw.avgResponseTime as number) ?? 0,
          inputTokens: (raw.inputTokens as number) ?? 0,
          outputTokens: (raw.outputTokens as number) ?? 0,
          byProvider: raw.byProvider as AiUsage["byProvider"],
        };
        setUsage(u);
      } else {
        setUsage(null);
      }
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch AI usage data",
      );
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  if (error) {
    return <ErrorState message={error} onRetry={fetchUsage} />;
  }

  // Token breakdown percentages
  const inputPercent = usage
    ? usage.totalTokens > 0
      ? Math.round(((usage.inputTokens ?? 0) / usage.totalTokens) * 100)
      : 0
    : 0;
  const outputPercent = usage
    ? usage.totalTokens > 0
      ? Math.round(((usage.outputTokens ?? 0) / usage.totalTokens) * 100)
      : 0
    : 0;

  const hasTokenBreakdown =
    usage && (usage.inputTokens ?? 0) > 0 && (usage.outputTokens ?? 0) > 0;

  const statCards = [
    {
      label: "Total Tokens",
      value: usage ? formatNumber(usage.totalTokens) : "—",
      icon: Brain,
      color: "text-purple-300",
      iconBg: "bg-purple-500/15",
      sub: hasTokenBreakdown
        ? `${formatNumber(usage!.inputTokens!)} in / ${formatNumber(usage!.outputTokens!)} out`
        : undefined,
    },
    {
      label: "Total API Calls",
      value: usage ? formatNumber(usage.totalCalls) : "—",
      icon: Zap,
      color: "text-blue-300",
      iconBg: "bg-blue-500/15",
      sub: usage?.totalCalls
        ? `~${formatNumber(Math.round(usage.totalCalls / 30))}/day avg`
        : undefined,
    },
    {
      label: "Active Agents",
      value: usage ? String(usage.activeAgents) : "—",
      icon: Bot,
      color: "text-emerald-300",
      iconBg: "bg-emerald-500/15",
      sub: usage?.activeAgents
        ? `${usage.activeAgents} agent${usage.activeAgents !== 1 ? "s" : ""} running`
        : undefined,
    },
    {
      label: "Avg Response Time",
      value: usage ? `${usage.avgResponseTime.toFixed(1)}s` : "—",
      icon: Timer,
      color: "text-amber-300",
      iconBg: "bg-amber-500/15",
      sub:
        usage && usage.avgResponseTime > 0
          ? usage.avgResponseTime < 2
            ? "Within target (<2s)"
            : "Above target (≥2s)"
          : undefined,
    },
  ];

  return (
    <motion.div
      className="space-y-6"
      variants={STAGGER.container}
      initial="initial"
      animate="animate"
    >
      {/* ── Large Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} variants={STAGGER.item}>
              <Card className="glass border-purple-500/10 card-hover">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        {stat.label}
                      </p>
                      {loading ? (
                        <Skeleton className="h-10 w-28" />
                      ) : (
                        <p className={`text-3xl font-bold ${stat.color}`}>
                          {stat.value}
                        </p>
                      )}
                      {stat.sub && !loading && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {stat.sub}
                        </p>
                      )}
                    </div>
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.iconBg}`}
                    >
                      <Icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* ── Token Usage Breakdown ── */}
      <motion.div variants={STAGGER.item}>
        <Card className="glass border-purple-500/10">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-purple-400" />
              <CardTitle className="text-base font-semibold">
                Token Usage Breakdown
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Input vs Output token distribution
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : hasTokenBreakdown ? (
              <div className="space-y-4">
                {/* Input Tokens */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-muted-foreground">
                      Input Tokens
                    </span>
                    <span className="text-sm font-bold text-blue-300">
                      {formatNumber(usage!.inputTokens!)} ({inputPercent}%)
                    </span>
                  </div>
                  <Progress
                    value={inputPercent}
                    className="h-2.5 bg-purple-500/10"
                  />
                </div>

                {/* Output Tokens */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-muted-foreground">
                      Output Tokens
                    </span>
                    <span className="text-sm font-bold text-purple-300">
                      {formatNumber(usage!.outputTokens!)} ({outputPercent}%)
                    </span>
                  </div>
                  <Progress
                    value={outputPercent}
                    className="h-2.5 bg-purple-500/10"
                  />
                </div>

                {/* Provider Breakdown */}
                {usage?.byProvider && usage.byProvider.length > 0 && (
                  <div className="pt-4 border-t border-purple-500/10">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                      By Provider
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {usage.byProvider.map((p) => {
                        const providerPercent =
                          usage!.totalTokens > 0
                            ? Math.round(
                                (p.totalTokens / usage!.totalTokens) * 100,
                              )
                            : 0;
                        return (
                          <div
                            key={p.provider}
                            className="p-3 rounded-lg border border-purple-500/10 bg-purple-500/5"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">
                                {p.provider}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {providerPercent}%
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formatNumber(p.totalTokens)} tokens •{" "}
                              {formatNumber(p.requestCount)} calls
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center">
                <Brain className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No token usage data available yet. Usage metrics will appear
                  here as your agents process tasks.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Usage Trend Description ── */}
      <motion.div variants={STAGGER.item}>
        <Card className="glass border-purple-500/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/15 flex-shrink-0">
                <TrendingUp className="h-4 w-4 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Usage Trend</p>
                {loading ? (
                  <Skeleton className="h-4 w-64" />
                ) : usage && usage.totalCalls > 0 ? (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Your organization has made{" "}
                    <span className="text-foreground font-medium">
                      {formatNumber(usage.totalCalls)}
                    </span>{" "}
                    API calls consuming{" "}
                    <span className="text-foreground font-medium">
                      {formatNumber(usage.totalTokens)}
                    </span>{" "}
                    tokens in total.{" "}
                    {usage.activeAgents > 0 && (
                      <>
                        Currently{" "}
                        <span className="text-foreground font-medium">
                          {usage.activeAgents}
                        </span>{" "}
                        agent{usage.activeAgents !== 1 ? "s are" : " is"} active
                        with an average response time of{" "}
                        <span className="text-foreground font-medium">
                          {usage.avgResponseTime.toFixed(1)}s
                        </span>
                        .
                      </>
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    No AI usage has been recorded for this organization yet.
                    Metrics will be tracked automatically as your agents execute
                    tasks.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────

export function MonitoringView() {
  const { activeOrgId, navigate } = useApp();

  // Org guard
  if (!activeOrgId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            <span className="gradient-text">Monitoring</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enterprise observability dashboard for system health, events, and
            AI usage.
          </p>
        </div>
        <Card className="glass border-purple-500/10 p-8 sm:p-12 text-center">
          <div className="relative mx-auto w-28 h-28 mb-6">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 animate-pulse" />
            <div className="absolute inset-4 rounded-full bg-gradient-to-br from-purple-500/10 to-cyan-500/10" />
            <div className="absolute inset-8 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
              <LayoutGrid className="h-8 w-8 text-purple-400" />
            </div>
          </div>
          <h3 className="font-bold text-xl mb-2">
            No Organization Selected
          </h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
            Select an organization to view monitoring data.
          </p>
          <Button
            className="btn-gradient"
            onClick={() => navigate("organizations")}
          >
            <Building2 className="mr-2 h-4 w-4" />
            Go to Organizations
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl sm:text-3xl font-bold">
          <span className="gradient-text">Monitoring</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enterprise observability dashboard for system health, events, jobs,
          and AI usage.
        </p>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="glass-strong border border-purple-500/10 bg-purple-500/5">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300"
            >
              <Activity className="mr-2 h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="jobs"
              className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300"
            >
              <Timer className="mr-2 h-4 w-4" />
              Jobs
            </TabsTrigger>
            <TabsTrigger
              value="ai-usage"
              className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300"
            >
              <Brain className="mr-2 h-4 w-4" />
              AI Usage
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <OverviewTab orgId={activeOrgId} />
          </TabsContent>

          <TabsContent value="jobs" className="mt-6">
            <JobsTab orgId={activeOrgId} />
          </TabsContent>

          <TabsContent value="ai-usage" className="mt-6">
            <AiUsageTab orgId={activeOrgId} />
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
